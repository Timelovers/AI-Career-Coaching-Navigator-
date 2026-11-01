import React, { useEffect, useMemo, useState } from 'react';
import { AppState, AppStep, ChatTurn, InterviewFeedback, JDData, ProjectAsset, ResumeProject } from './types';
import Step1Discovery from './components/Step1Discovery';
import Step2JDInput from './components/Step2JDInput';
import Step3ResumeGen from './components/Step3ResumeGen';
import Step4MockInterview from './components/Step4MockInterview';
import SettingsModal from './components/SettingsModal';
import { loadSettings, resolveActive } from './services/settings';
import { defaultAppState, loadAppState, saveAppState } from './services/storage';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsHint, setSettingsHint] = useState<string | null>(null);
  const [settingsTick, setSettingsTick] = useState(0);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const active = useMemo(() => resolveActive(loadSettings()), [settingsTick]);
  const keyReady = Boolean(active.apiKey && active.model);

  const goToStep = (step: AppStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  };

  const askForKey = (hint: string) => {
    setSettingsHint(hint);
    setSettingsOpen(true);
  };

  const openSettings = () => {
    setSettingsHint(null);
    setSettingsOpen(true);
  };

  const addAssets = (newAssets: ProjectAsset[]) => {
    setState((prev) => ({ ...prev, assets: [...prev.assets, ...newAssets] }));
  };

  const deleteAsset = (id: string) => {
    setState((prev) => ({ ...prev, assets: prev.assets.filter((asset) => asset.id !== id) }));
  };

  const addJD = (jd: JDData) => {
    setState((prev) => ({ ...prev, jds: [jd, ...prev.jds], selectedJdId: jd.id, generatedResume: [] }));
  };

  const selectJD = (id: string) => {
    setState((prev) => ({
      ...prev,
      selectedJdId: id,
      generatedResume: prev.selectedJdId === id ? prev.generatedResume : [],
    }));
  };

  const deleteJD = (id: string) => {
    setState((prev) => ({
      ...prev,
      jds: prev.jds.filter((jd) => jd.id !== id),
      selectedJdId: prev.selectedJdId === id ? null : prev.selectedJdId,
      generatedResume: prev.selectedJdId === id ? [] : prev.generatedResume,
    }));
  };

  const updateResume = (resume: ResumeProject[]) => {
    setState((prev) => ({ ...prev, generatedResume: resume }));
  };

  const addInterviewFeedback = (feedback: InterviewFeedback) => {
    setState((prev) => ({ ...prev, interviewHistory: [feedback, ...prev.interviewHistory] }));
  };

  const setDiscoveryChat = (chat: ChatTurn[]) => {
    setState((prev) => ({ ...prev, discoveryChat: chat }));
  };

  const setInterviewChat = (chat: ChatTurn[]) => {
    setState((prev) => ({ ...prev, interviewChat: chat }));
  };

  const currentJd = state.jds.find((jd) => jd.id === state.selectedJdId) || null;

  const steps = [
    { id: AppStep.Discovery, name: '项目挖掘', icon: 'fa-comments' },
    { id: AppStep.JDInput, name: 'JD 解析', icon: 'fa-file-alt' },
    { id: AppStep.ResumeGen, name: '简历生成', icon: 'fa-pen-nib' },
    { id: AppStep.MockInterview, name: '模拟面试', icon: 'fa-comments' },
  ];

  const renderStep = () => {
    switch (state.currentStep) {
      case AppStep.Discovery:
        return (
          <Step1Discovery
            assets={state.assets}
            chat={state.discoveryChat}
            currentJd={currentJd}
            onAssetsAdd={addAssets}
            onAssetDelete={deleteAsset}
            onChatChange={setDiscoveryChat}
            onNeedKey={askForKey}
          />
        );
      case AppStep.JDInput:
        return (
          <Step2JDInput
            jds={state.jds}
            selectedJdId={state.selectedJdId}
            onJDAdd={addJD}
            onSelect={selectJD}
            onDelete={deleteJD}
            onNeedKey={askForKey}
          />
        );
      case AppStep.ResumeGen:
        return (
          <Step3ResumeGen
            assets={state.assets}
            resume={state.generatedResume}
            jd={currentJd}
            onResumeUpdate={updateResume}
            onNeedKey={askForKey}
            onGoTo={goToStep}
            nextStep={() => goToStep(AppStep.MockInterview)}
          />
        );
      case AppStep.MockInterview:
        return (
          <Step4MockInterview
            state={state}
            jd={currentJd}
            onFeedbackAdd={addInterviewFeedback}
            onChatChange={setInterviewChat}
            onNeedKey={askForKey}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <button type="button" className="flex items-center gap-2" onClick={() => goToStep(AppStep.Discovery)}>
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-lg font-bold text-white">智</div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800 sm:text-xl">AI 求职智航 <span className="text-blue-600">Pro</span></h1>
          </button>
          <nav className="hidden items-center gap-2 md:flex">
            {steps.map((step) => (
              <button
                key={step.id}
                type="button"
                data-testid={`step-${step.id}`}
                onClick={() => goToStep(step.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${state.currentStep === step.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${state.currentStep === step.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{step.id}</span>
                {step.name}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end border-r border-slate-200 pr-3 lg:flex">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">当前目标岗位</span>
              <span className="max-w-[150px] truncate text-xs font-bold text-slate-700">{currentJd ? `${currentJd.company} · ${currentJd.title}` : '未选择目标'}</span>
            </div>
            <button
              type="button"
              data-testid="open-settings"
              onClick={openSettings}
              className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-blue-700"
            >
              <span className={`h-2 w-2 rounded-full ${keyReady ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              <span className="hidden sm:inline">{keyReady ? `${active.label} · ${active.model}` : '设置密钥'}</span>
              <i className="fas fa-sliders-h"></i>
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => goToStep(step.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${state.currentStep === step.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {step.id}. {step.name}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-8">
        {renderStep()}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-5 text-[11px] text-slate-400">
        <div className="flex gap-6">
          <span>素材库 {state.assets.length}</span>
          <span>JD {state.jds.length}</span>
          <span>复盘 {state.interviewHistory.length}</span>
        </div>
        <div>密钥留在本机 · {keyReady ? active.label : '未配置模型'}</div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        hint={settingsHint}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setSettingsTick((value) => value + 1)}
        onClearData={() => setState(defaultAppState())}
      />
    </div>
  );
};

export default App;
