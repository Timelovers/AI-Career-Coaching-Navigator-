import React, { useState } from 'react';
import { JDData } from '../types';
import ErrorBanner from './ErrorBanner';
import { analyzeJdText } from '../services/career';
import { reportModelError } from '../services/errors';
import { createId } from '../services/modelJson';

interface Props {
  jds: JDData[];
  selectedJdId: string | null;
  onJDAdd: (jd: JDData) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNeedKey: (hint: string) => void;
}

const Step2JDInput: React.FC<Props> = ({ jds, selectedJdId, onJDAdd, onSelect, onDelete, onNeedKey }) => {
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = jds.find((jd) => jd.id === selectedJdId) || null;

  const handleSubmit = async () => {
    if (!jdText.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeJdText(jdText.trim());
      onJDAdd({ ...data, id: createId() });
      setJdText('');
    } catch (err) {
      setError(reportModelError(err, onNeedKey));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm lg:col-span-2">
        <h2 className="mb-2 text-2xl font-bold text-slate-800">解析新 JD</h2>
        <p className="mb-6 text-sm text-slate-500">粘贴职位描述。模型会抽出公司、职位、关键词和胜任力，供后面的简历和面试使用。</p>
        <ErrorBanner message={error} />
        <textarea
          data-testid="jd-input"
          className="mb-6 h-72 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="在此粘贴目标岗位的 JD 文本..."
          value={jdText}
          onChange={(event) => setJdText(event.target.value)}
        />
        <div className="flex justify-end">
          <button
            type="button"
            data-testid="jd-submit"
            onClick={handleSubmit}
            disabled={loading || !jdText.trim()}
            className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '解析中…' : '开始解析'}
          </button>
        </div>

        {selected && (
          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-500">当前目标</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{selected.company} · {selected.title}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {selected.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-white px-2 py-1 text-xs text-slate-700">{keyword}</span>
              ))}
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {selected.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="h-fit rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center justify-between font-bold text-slate-800">
          <span>职位库 ({jds.length})</span>
          <i className="fas fa-folder-open text-slate-300"></i>
        </h3>
        <div className="space-y-3">
          {jds.map((jd) => (
            <div
              key={jd.id}
              onClick={() => onSelect(jd.id)}
              className={`group cursor-pointer rounded-2xl border-2 p-4 transition-all ${selectedJdId === jd.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-50 bg-slate-50 hover:bg-slate-100'}`}
            >
              <div className="mb-2 flex items-start justify-between">
                <p className={`text-sm font-bold ${selectedJdId === jd.id ? 'text-blue-700' : 'text-slate-700'}`}>{jd.company}</p>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); onDelete(jd.id); }}
                  className="text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  aria-label={`删除 ${jd.company}`}
                >
                  <i className="fas fa-trash-alt text-xs"></i>
                </button>
              </div>
              <p className="mb-2 text-xs text-slate-500">{jd.title}</p>
              <div className="flex flex-wrap gap-1">
                {jd.keywords.slice(0, 3).map((keyword) => (
                  <span key={keyword} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600">{keyword}</span>
                ))}
              </div>
            </div>
          ))}
          {jds.length === 0 && <div className="py-10 text-center text-xs italic text-slate-400">还没有解析过的职位</div>}
        </div>
      </div>
    </div>
  );
};

export default Step2JDInput;
