
export enum AppStep {
  Discovery = 1,
  JDInput = 2,
  ResumeGen = 3,
  MockInterview = 4
}

export interface ProjectAsset {
  id: string;
  name: string;
  background: string;
  tasks: string;
  actions: string;
  results: string;
  techStack: string[];
  challenges: string;
}

export interface JDData {
  id: string;
  title: string;
  company: string;
  rawText: string;
  keywords: string[];
  requirements: string[];
}

export interface ResumeProject {
  name: string;
  description: string;
  matchScore: number;
}

export interface InterviewFeedback {
  question: string;
  userAnswer: string;
  gaps: string[];
  assetReferences: string[];
  improvement: string;
}

export interface AppState {
  currentStep: AppStep;
  assets: ProjectAsset[];
  jds: JDData[];
  selectedJdId: string | null;
  generatedResume: ResumeProject[];
  interviewHistory: InterviewFeedback[];
}
