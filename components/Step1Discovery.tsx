import React, { useState } from 'react';
import { ChatTurn, JDData, ProjectAsset } from '../types';
import ErrorBanner from './ErrorBanner';
import { useDictation } from '../hooks/useDictation';
import { coachTurn, extractAssetsFromText } from '../services/career';
import { reportModelError } from '../services/errors';
import { createId } from '../services/modelJson';

interface Props {
  assets: ProjectAsset[];
  chat: ChatTurn[];
  currentJd: JDData | null;
  onAssetsAdd: (assets: ProjectAsset[]) => void;
  onAssetDelete: (id: string) => void;
  onChatChange: (chat: ChatTurn[]) => void;
  onNeedKey: (hint: string) => void;
}

const emptyManual = {
  name: '',
  background: '',
  tasks: '',
  actions: '',
  results: '',
  techStack: '',
  challenges: '',
};

const Step1Discovery: React.FC<Props> = ({ assets, chat, currentJd, onAssetsAdd, onAssetDelete, onChatChange, onNeedKey }) => {
  const [mode, setMode] = useState<'chat' | 'paste'>('chat');
  const [input, setInput] = useState('');
  const [paste, setPaste] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [manual, setManual] = useState(emptyManual);
  const dictation = useDictation((transcript) => setInput(transcript));

  const runCoach = async (history: ChatTurn[]) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const reply = await coachTurn(history, currentJd);
      onChatChange([...history, { id: createId(), role: 'assistant', content: reply }]);
    } catch (err) {
      setError(reportModelError(err, onNeedKey));
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    dictation.stop();
    const next = [...chat, { id: createId(), role: 'user' as const, content: text }];
    onChatChange(next);
    setInput('');
    await runCoach(next);
  };

  const extract = async (source: string) => {
    const text = source.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const extracted = await extractAssetsFromText(text);
      if (extracted.length === 0) {
        setInfo('没有识别到具体项目。请补充你做了什么、用了什么技术、结果如何。');
        return;
      }
      onAssetsAdd(extracted);
      setInfo(`已加入 ${extracted.length} 条项目素材。刷新页面后仍会保留。`);
      if (mode === 'paste') setPaste('');
    } catch (err) {
      setError(reportModelError(err, onNeedKey));
    } finally {
      setLoading(false);
    }
  };

  const addManual = () => {
    if (!manual.name.trim()) {
      setError('手动添加时至少填写项目名称。');
      return;
    }
    onAssetsAdd([{
      id: createId(),
      name: manual.name.trim(),
      background: manual.background.trim(),
      tasks: manual.tasks.trim(),
      actions: manual.actions.trim(),
      results: manual.results.trim() || '未提供量化结果',
      techStack: manual.techStack.split(/[,，、]/).map((item) => item.trim()).filter(Boolean),
      challenges: manual.challenges.trim(),
    }]);
    setManual(emptyManual);
    setError(null);
    setInfo('已手动加入素材库。');
  };

  const chatSource = chat.map((turn) => `${turn.role === 'user' ? '候选人' : '面试官'}：${turn.content}`).join('\n');

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2 lg:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">项目深度挖掘</h2>
          {currentJd ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
              <i className="fas fa-bullseye"></i> 正在针对 {currentJd.company} · {currentJd.title} 追问
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">可以先聊项目，也可以去「JD 解析」选定岗位后再回来，追问会更贴关键词。</p>
          )}
        </div>

        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => setMode('chat')} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === 'chat' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>对话挖掘</button>
          <button type="button" onClick={() => setMode('paste')} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === 'paste' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>粘贴经历</button>
        </div>

        <ErrorBanner message={error || dictation.error} />
        {info && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{info}</div>}

        {mode === 'chat' ? (
          <>
            <div className="mb-4 max-h-[420px] min-h-[240px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
              {chat.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">
                  <p className="mb-4">用文字把项目讲清楚。语音只是可选输入，麦克风不可用时直接打字。</p>
                  <button type="button" disabled={loading} onClick={() => runCoach([])} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-blue-600 shadow-sm">
                    让面试官先提问
                  </button>
                </div>
              )}
              {chat.map((turn) => (
                <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${turn.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>
                    {turn.content}
                  </div>
                </div>
              ))}
              {loading && <p className="text-xs text-slate-400">正在思考下一个问题…</p>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                data-testid="discovery-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                placeholder="例如：我在推荐系统里负责召回，把离线 AUC 从 0.71 做到 0.76……"
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 sm:flex-col">
                <button type="button" onClick={() => (dictation.listening ? dictation.stop() : dictation.start(input))} className={`rounded-xl px-4 py-2 text-sm font-bold ${dictation.listening ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`} title={dictation.supported ? '语音输入' : '当前浏览器不支持语音识别'}>
                  <i className={`fas ${dictation.listening ? 'fa-stop' : 'fa-microphone'}`}></i>
                </button>
                <button type="button" data-testid="discovery-send" onClick={send} disabled={loading || !input.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  发送
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" disabled={loading || chat.length === 0} onClick={() => extract(chatSource)} className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-40">
                从对话沉淀素材
              </button>
              <button type="button" disabled={loading || chat.length === 0} onClick={() => onChatChange([])} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400">
                清空对话
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              className="mb-4 h-64 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="把项目介绍、周报或口述记录贴在这里。模型只整理你写过的事实，不会编造指标。"
            />
            <button type="button" onClick={() => extract(paste)} disabled={loading || !paste.trim()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              {loading ? '整理中…' : '结构化并加入素材库'}
            </button>
          </>
        )}

        <details className="mt-6 rounded-2xl bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-600">手动补一条素材</summary>
          <div className="mt-4 grid gap-3">
            <input data-testid="asset-name" value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} placeholder="项目名称" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={manual.background} onChange={(event) => setManual({ ...manual, background: event.target.value })} placeholder="背景" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={manual.tasks} onChange={(event) => setManual({ ...manual, tasks: event.target.value })} placeholder="你的任务" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={manual.actions} onChange={(event) => setManual({ ...manual, actions: event.target.value })} placeholder="关键行动" rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={manual.results} onChange={(event) => setManual({ ...manual, results: event.target.value })} placeholder="结果（没有数字就留空）" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={manual.techStack} onChange={(event) => setManual({ ...manual, techStack: event.target.value })} placeholder="技术栈，用逗号分隔" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={manual.challenges} onChange={(event) => setManual({ ...manual, challenges: event.target.value })} placeholder="难点" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" data-testid="asset-save" onClick={addManual} className="justify-self-start rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">加入素材库</button>
          </div>
        </details>
      </div>

      <div className="h-fit rounded-3xl bg-slate-900 p-6 text-white lg:sticky lg:top-24">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold"><i className="fas fa-archive text-blue-400"></i> 已沉淀素材库 ({assets.length})</h3>
        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-blue-300">{asset.name}</p>
                <button type="button" onClick={() => onAssetDelete(asset.id)} className="text-slate-500 hover:text-red-300" aria-label={`删除 ${asset.name}`}>
                  <i className="fas fa-trash-alt text-xs"></i>
                </button>
              </div>
              {asset.results && <p className="mb-2 text-xs leading-relaxed text-slate-300">{asset.results}</p>}
              <div className="flex flex-wrap gap-1">
                {asset.techStack.map((stack) => <span key={stack} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{stack}</span>)}
              </div>
            </div>
          ))}
          {assets.length === 0 && <p className="py-10 text-center text-xs text-slate-500">还没有素材。对话、粘贴或手动添加后会出现在这里。</p>}
        </div>
      </div>
    </div>
  );
};

export default Step1Discovery;
