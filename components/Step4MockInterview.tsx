import React, { useState } from 'react';
import { AppState, ChatTurn, InterviewFeedback, JDData } from '../types';
import ErrorBanner from './ErrorBanner';
import { useDictation } from '../hooks/useDictation';
import { interviewReview, interviewTurn } from '../services/career';
import { reportModelError } from '../services/errors';
import { createId } from '../services/modelJson';

interface Props {
  state: AppState;
  jd: JDData | null;
  onFeedbackAdd: (feedback: InterviewFeedback) => void;
  onChatChange: (chat: ChatTurn[]) => void;
  onNeedKey: (hint: string) => void;
}

const Step4MockInterview: React.FC<Props> = ({ state, jd, onFeedbackAdd, onChatChange, onNeedKey }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dictation = useDictation((transcript) => setInput(transcript));
  const chat = state.interviewChat;
  const ready = state.assets.length > 0 || Boolean(jd);
  const canReview = chat.some((turn) => turn.role === 'user') && chat.some((turn) => turn.role === 'assistant');

  const context = { jd, assets: state.assets, resume: state.generatedResume };

  const runTurn = async (history: ChatTurn[]) => {
    setLoading(true);
    setError(null);
    try {
      const reply = await interviewTurn(history, context);
      onChatChange([...history, { id: createId(), role: 'assistant', content: reply }]);
    } catch (err) {
      setError(reportModelError(err, onNeedKey));
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || reviewing) return;
    dictation.stop();
    const next = [...chat, { id: createId(), role: 'user' as const, content: text }];
    onChatChange(next);
    setInput('');
    await runTurn(next);
  };

  const review = async () => {
    if (!canReview || reviewing) return;
    setReviewing(true);
    setError(null);
    try {
      const feedback = await interviewReview(chat, context);
      const firstQuestion = chat.find((turn) => turn.role === 'assistant')?.content ?? '模拟面试';
      const answers = chat.filter((turn) => turn.role === 'user').map((turn) => turn.content).join('\n');
      onFeedbackAdd({ question: firstQuestion, userAnswer: answers, ...feedback });
    } catch (err) {
      setError(reportModelError(err, onNeedKey));
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-slate-900">模拟面试</h2>
            <p className="mt-1 text-sm text-slate-500">
              {jd ? `围绕 ${jd.company} · ${jd.title} 提问，复盘时会引用你的素材库。` : '还没有选定 JD，面试会基于已有素材做通用追问。'}
            </p>
          </div>
          <ErrorBanner message={error || dictation.error} />

          {!ready ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
              请先沉淀至少一条项目素材，或解析并选中一个 JD。
            </div>
          ) : (
            <>
              <div className="mb-4 max-h-[460px] min-h-[280px] space-y-3 overflow-y-auto rounded-2xl bg-slate-950 p-4">
                {chat.length === 0 && (
                  <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-slate-300">
                    <i className="fas fa-comments mb-4 text-3xl text-blue-400"></i>
                    <p className="mb-4 max-w-sm text-sm">文字面试对 Gemini、DeepSeek 和自定义接口都可用。麦克风只负责把话写进输入框。</p>
                    <button type="button" data-testid="interview-start" disabled={loading} onClick={() => runTurn([])} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                      {loading ? '正在出题…' : '开始面试'}
                    </button>
                  </div>
                )}
                {chat.map((turn) => (
                  <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${turn.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-100'}`}>
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide opacity-60">{turn.role === 'user' ? '我' : '面试官'}</span>
                      {turn.content}
                    </div>
                  </div>
                ))}
                {loading && <p className="text-xs text-slate-400">面试官正在组织下一问…</p>}
              </div>

              {chat.length > 0 && (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <textarea
                      data-testid="interview-input"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      rows={3}
                      placeholder="回答当前问题。说不清的地方就直接说还没量化，不要临时编数字。"
                      className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2 sm:flex-col">
                      <button type="button" onClick={() => (dictation.listening ? dictation.stop() : dictation.start(input))} className={`rounded-xl px-4 py-2 text-sm font-bold ${dictation.listening ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <i className={`fas ${dictation.listening ? 'fa-stop' : 'fa-microphone'}`}></i>
                      </button>
                      <button type="button" data-testid="interview-send" onClick={send} disabled={loading || reviewing || !input.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                        回答
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" data-testid="interview-review" onClick={review} disabled={!canReview || loading || reviewing} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                      {reviewing ? '正在复盘…' : '结束并生成复盘'}
                    </button>
                    <button type="button" onClick={() => onChatChange([])} disabled={loading || reviewing} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400">
                      开始新一轮
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div>
          <h3 className="mb-4 text-lg font-bold text-slate-800">历史复盘</h3>
          <div className="flex flex-col gap-4">
            {state.interviewHistory.map((item, index) => (
              <article key={`${item.question}-${index}`} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">总体表现</p>
                <p className="mt-2 text-base font-semibold leading-relaxed text-slate-800">{item.summary || item.improvement}</p>
                {item.improvement && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.improvement}</p>
                )}
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                    <p className="mb-2 text-sm font-bold text-red-700">关键缺口</p>
                    <ul className="space-y-2 text-xs text-red-950">
                      {(item.gaps || []).map((gap) => <li key={gap}>{gap}</li>)}
                      {(item.gaps || []).length === 0 && <li>这一轮没有列出具体缺口。</li>}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                    <p className="mb-2 text-sm font-bold text-blue-700">可回扣的素材</p>
                    <ul className="space-y-2 text-xs text-blue-950">
                      {(item.assetReferences || []).map((ref) => <li key={ref}>{ref}</li>)}
                      {(item.assetReferences || []).length === 0 && <li>没有可引用的素材。</li>}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
            {state.interviewHistory.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
                完成一轮问答后，复盘会出现在这里，并在刷新后保留。
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="h-fit rounded-[2rem] bg-slate-900 p-6 text-white lg:sticky lg:top-24">
        <h3 className="mb-5 flex items-center gap-2 font-bold text-blue-300"><i className="fas fa-layer-group"></i> 核心素材库</h3>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {state.assets.map((asset) => (
            <div key={asset.id} className="rounded-2xl border border-white/10 border-l-4 border-l-blue-500 bg-white/5 p-4">
              <p className="mb-2 font-bold">{asset.name}</p>
              <p className="text-xs leading-relaxed text-slate-300">{asset.results || '还没有写结果'}</p>
              {asset.actions && <p className="mt-2 text-xs italic leading-relaxed text-slate-400">{asset.actions}</p>}
            </div>
          ))}
          {state.assets.length === 0 && <p className="text-sm text-slate-500">素材库是空的。复盘里的「可回扣的素材」需要这里有内容。</p>}
        </div>
      </aside>
    </div>
  );
};

export default Step4MockInterview;
