
import React, { useState } from 'react';
import { JDData } from '../types';
import { analyzeJD } from '../services/geminiService';

interface Props {
  jds: JDData[];
  selectedJdId: string | null;
  onJDAdd: (jd: JDData) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const Step2JDInput: React.FC<Props> = ({ jds, selectedJdId, onJDAdd, onSelect, onDelete }) => {
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!jdText.trim()) return;
    setLoading(true);
    try {
      const data = await analyzeJD(jdText);
      onJDAdd({ ...data, id: Date.now().toString() });
      setJdText('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 p-8 bg-white rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">解析新 JD</h2>
        <textarea
          className="w-full h-80 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none mb-6 text-sm"
          placeholder="在此粘贴目标岗位的 JD 文本..."
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading || !jdText}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            {loading ? <i className="fas fa-spinner animate-spin mr-2"></i> : null}
            开始解析
          </button>
        </div>
      </div>

      <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm h-fit">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>职位库 ({jds.length})</span>
          <i className="fas fa-folder-open text-slate-300"></i>
        </h3>
        <div className="space-y-3">
          {jds.map((j) => (
            <div 
              key={j.id} 
              onClick={() => onSelect(j.id)}
              className={`group p-4 rounded-2xl cursor-pointer transition-all border-2 ${selectedJdId === j.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-50 bg-slate-50 hover:bg-slate-100'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <p className={`text-sm font-bold ${selectedJdId === j.id ? 'text-blue-700' : 'text-slate-700'}`}>{j.company}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(j.id); }}
                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <i className="fas fa-trash-alt text-xs"></i>
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">{j.title}</p>
              <div className="flex flex-wrap gap-1">
                {j.keywords.slice(0, 3).map((k, ki) => (
                  <span key={ki} className="text-[9px] px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-600">{k}</span>
                ))}
              </div>
            </div>
          ))}
          {jds.length === 0 && <div className="py-10 text-center text-slate-400 text-xs italic">暂无记录</div>}
        </div>
      </div>
    </div>
  );
};

export default Step2JDInput;
