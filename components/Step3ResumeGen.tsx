import React, { useState } from 'react';
import { AppStep, JDData, ProjectAsset, ResumeProject } from '../types';
import ErrorBanner from './ErrorBanner';
import { generateResume } from '../services/career';
import { reportModelError } from '../services/errors';

interface Props {
  assets: ProjectAsset[];
  resume: ResumeProject[];
  jd: JDData | null;
  onResumeUpdate: (resume: ResumeProject[]) => void;
  onNeedKey: (hint: string) => void;
  onGoTo: (step: AppStep) => void;
  nextStep: () => void;
}

const Step3ResumeGen: React.FC<Props> = ({ assets, resume, jd, onResumeUpdate, onNeedKey, onGoTo, nextStep }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!jd || assets.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const items = await generateResume(assets, jd);
      if (items.length === 0) {
        setError('模型没有返回可用的项目描述，请再试一次。');
        return;
      }
      onResumeUpdate(items);
    } catch (err) {
      setError(reportModelError(err, onNeedKey));
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    const text = resume.map((item) => `${item.name}\n${item.description}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('复制失败，请手动选择文本。');
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">定制化简历描述</h2>
          <p className="text-slate-600">
            {jd ? `把 ${assets.length} 条素材对齐到 ${jd.company} · ${jd.title}` : '先选择一个目标职位'}
          </p>
        </div>
        <button type="button" onClick={handleGenerate} disabled={loading || !jd || assets.length === 0} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-40">
          <i className="fas fa-sync-alt"></i> {resume.length ? '重新生成' : '生成简历'}
        </button>
      </div>

      <ErrorBanner message={error} />

      {!jd || assets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-8 py-16 text-center">
          <p className="mb-6 text-slate-500">生成简历需要至少一条项目素材，以及一个已选中的 JD。</p>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => onGoTo(AppStep.Discovery)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">去补充素材</button>
            <button type="button" onClick={() => onGoTo(AppStep.JDInput)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">去选择 JD</button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-white py-20 shadow-sm">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-slate-600">正在按 STAR 整理，并只使用素材里已经写明的事实…</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="p-8 sm:p-10">
            <div className="mb-8 border-b-2 border-slate-900 pb-2">
              <h3 className="text-xl font-bold text-slate-900">项目经历 / PROJECT EXPERIENCE</h3>
            </div>
            {resume.map((project, index) => (
              <div key={`${project.name}-${index}`} className="mb-8">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-lg font-bold text-slate-800">{project.name}</h4>
                  <span className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-bold text-green-700">
                    JD 匹配度: {Math.round(project.matchScore * 100)}%
                  </span>
                </div>
                <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{project.description}</div>
              </div>
            ))}
            {resume.length === 0 && <div className="py-10 text-center italic text-slate-400">还没有生成文案。点击右上角「生成简历」。</div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 p-6">
            <p className="text-sm text-slate-500">占位符「待补充」表示素材里没有对应数字，请自行核实后再写进正式简历。</p>
            <div className="flex gap-2">
              <button type="button" onClick={copyAll} disabled={resume.length === 0} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-40">
                {copied ? '已复制' : '复制全部'}
              </button>
              <button type="button" onClick={nextStep} className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
                进入模拟面试 <i className="fas fa-chevron-right ml-2"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step3ResumeGen;
