
import React, { useState, useEffect } from 'react';
import { AppState, ResumeProject, JDData } from '../types';
import { generateResumeItems } from '../services/geminiService';

interface Props {
  state: AppState;
  // Fix: Added jd prop to Props interface as it is not part of AppState
  jd: JDData | null;
  onResumeUpdate: (resume: ResumeProject[]) => void;
  nextStep: () => void;
}

const Step3ResumeGen: React.FC<Props> = ({ state, jd, onResumeUpdate, nextStep }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fix: Updated state.jd to jd
    if (state.assets.length > 0 && jd && state.generatedResume.length === 0) {
      handleGenerate();
    }
  }, []);

  const handleGenerate = async () => {
    // Fix: Updated state.jd to jd
    if (!jd) return;
    setLoading(true);
    try {
      // Fix: Updated state.jd to jd
      const items = await generateResumeItems(state.assets, jd);
      onResumeUpdate(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">第三阶段：定制化简历描述</h2>
          {/* Fix: Updated state.jd to jd */}
          <p className="text-slate-600">已将 {state.assets.length} 个项目素材适配至 "{jd?.company}" 的职位要求</p>
        </div>
        <button
          onClick={handleGenerate}
          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <i className="fas fa-sync-alt"></i> 重新生成
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600">正在运用 STAR 法则和 JD 关键词进行深度融合...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-10">
            <div className="border-b-2 border-slate-900 pb-2 mb-8">
              <h3 className="text-xl font-bold text-slate-900">项目经历 / PROJECT EXPERIENCE</h3>
            </div>
            {state.generatedResume.map((proj, idx) => (
              <div key={idx} className="mb-8">
                <div className="flex justify-between items-baseline mb-2">
                  <h4 className="font-bold text-slate-800 text-lg">{proj.name}</h4>
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded border border-green-200 font-bold">JD 匹配度: {Math.round(proj.matchScore * 100)}%</span>
                </div>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-sans">
                  {proj.description}
                </div>
              </div>
            ))}
            
            {state.generatedResume.length === 0 && (
              <div className="text-center py-10 text-slate-400 italic">暂无简历文案，请确保已完成前面的步骤。</div>
            )}
          </div>
          
          <div className="bg-slate-50 p-6 flex justify-between items-center border-t border-slate-100">
            <p className="text-sm text-slate-500">以上是为您生成的简历核心模块预览。建议复制到正式简历中使用。</p>
            <button
              onClick={nextStep}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md"
            >
              进入模拟面试 <i className="fas fa-chevron-right ml-2"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step3ResumeGen;
