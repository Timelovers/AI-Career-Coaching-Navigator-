
import React, { useState } from 'react';
import { AppState, AppStep, ProjectAsset, JDData, ResumeProject, InterviewFeedback } from './types';
import Step1Discovery from './components/Step1Discovery';
import Step2JDInput from './components/Step2JDInput';
import Step3ResumeGen from './components/Step3ResumeGen';
import Step4MockInterview from './components/Step4MockInterview';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentStep: AppStep.Discovery,
    assets: [],
    jds: [],
    selectedJdId: null,
    generatedResume: [],
    interviewHistory: []
  });

  const goToStep = (step: AppStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const addAssets = (newAssets: ProjectAsset[]) => {
    setState(prev => ({ 
      ...prev, 
      assets: [...prev.assets, ...newAssets]
    }));
  };

  const addJD = (jd: JDData) => {
    setState(prev => ({ 
      ...prev, 
      jds: [jd, ...prev.jds],
      selectedJdId: jd.id
    }));
  };

  const selectJD = (id: string) => {
    setState(prev => ({ ...prev, selectedJdId: id, generatedResume: [] }));
  };

  const deleteJD = (id: string) => {
    setState(prev => ({
      ...prev,
      jds: prev.jds.filter(j => j.id !== id),
      selectedJdId: prev.selectedJdId === id ? null : prev.selectedJdId
    }));
  };

  const updateResume = (resume: ResumeProject[]) => {
    setState(prev => ({ ...prev, generatedResume: resume }));
  };

  const addInterviewFeedback = (feedback: InterviewFeedback) => {
    setState(prev => ({ ...prev, interviewHistory: [feedback, ...prev.interviewHistory] }));
  };

  const currentJd = state.jds.find(j => j.id === state.selectedJdId) || null;

  const renderStep = () => {
    switch (state.currentStep) {
      case AppStep.Discovery:
        return <Step1Discovery 
          onAssetsUpdate={addAssets} 
          currentJd={currentJd} 
          existingAssets={state.assets}
        />;
      case AppStep.JDInput:
        return <Step2JDInput 
          jds={state.jds}
          selectedJdId={state.selectedJdId}
          onJDAdd={addJD} 
          onSelect={selectJD}
          onDelete={deleteJD}
        />;
      case AppStep.ResumeGen:
        return <Step3ResumeGen 
          state={state} 
          jd={currentJd} 
          onResumeUpdate={updateResume} 
          nextStep={() => goToStep(AppStep.MockInterview)} 
        />;
      case AppStep.MockInterview:
        return <Step4MockInterview 
          state={state} 
          jd={currentJd} 
          onFeedbackAdd={addInterviewFeedback} 
        />;
      default:
        return null;
    }
  };

  const steps = [
    { id: AppStep.Discovery, name: '项目挖掘', icon: 'fa-microphone' },
    { id: AppStep.JDInput, name: 'JD 解析', icon: 'fa-file-alt' },
    { id: AppStep.ResumeGen, name: '简历生成', icon: 'fa-pen-nib' },
    { id: AppStep.MockInterview, name: '模拟面试', icon: 'fa-comments' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => goToStep(AppStep.Discovery)}>
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">智</div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">AI 求职智航 <span className="text-blue-600">Pro</span></h1>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {steps.map((s) => (
              <button 
                key={s.id} 
                onClick={() => goToStep(s.id)}
                className={`flex items-center gap-2 text-sm font-medium transition-all px-4 py-2 rounded-xl ${state.currentStep === s.id ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${state.currentStep === s.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-200 text-slate-600'}`}>
                  {s.id}
                </div>
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden lg:flex flex-col items-end border-r border-slate-200 pr-4 mr-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">当前目标岗位</span>
                <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{currentJd ? `${currentJd.company} · ${currentJd.title}` : '未选择目标'}</span>
             </div>
             <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400">
               <i className="fas fa-user-circle text-lg"></i>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full py-8 px-4">
        {renderStep()}
      </main>

      <footer className="bg-white border-t border-slate-100 py-6 px-8 text-slate-400 text-[10px] flex justify-between items-center">
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400"></span> 素材库: {state.assets.length} 个项目</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> 已解析 JD: {state.jds.length} 个</div>
        </div>
        <div className="uppercase tracking-widest font-bold opacity-60">
          AI Career Assistant Framework 2024
        </div>
      </footer>
    </div>
  );
};

export default App;
