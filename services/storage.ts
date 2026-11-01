import { AppState, AppStep, ChatTurn, InterviewFeedback, JDData, ProjectAsset, ResumeProject } from '../types';

export const STATE_STORAGE_KEY = 'career-coach.state';

export function defaultAppState(): AppState {
  return {
    currentStep: AppStep.Discovery,
    assets: [],
    jds: [],
    selectedJdId: null,
    generatedResume: [],
    interviewHistory: [],
    discoveryChat: [],
    interviewChat: [],
  };
}

function isStep(value: unknown): value is AppStep {
  return value === AppStep.Discovery || value === AppStep.JDInput || value === AppStep.ResumeGen || value === AppStep.MockInterview;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function loadAppState(): AppState {
  const initial = defaultAppState();
  try {
    if (typeof localStorage === 'undefined') return initial;
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const selectedJdId = typeof parsed.selectedJdId === 'string' ? parsed.selectedJdId : null;
    return {
      currentStep: isStep(parsed.currentStep) ? parsed.currentStep : initial.currentStep,
      assets: asArray<ProjectAsset>(parsed.assets),
      jds: asArray<JDData>(parsed.jds),
      selectedJdId,
      generatedResume: asArray<ResumeProject>(parsed.generatedResume),
      interviewHistory: asArray<InterviewFeedback>(parsed.interviewHistory),
      discoveryChat: asArray<ChatTurn>(parsed.discoveryChat),
      interviewChat: asArray<ChatTurn>(parsed.interviewChat),
    };
  } catch {
    return initial;
  }
}

export function saveAppState(state: AppState): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode: the in-memory session still works.
  }
}
