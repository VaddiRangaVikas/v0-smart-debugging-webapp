export type ProgrammingLanguage = 
  | 'auto'
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'sql';

export type ExplanationLanguage = 'english' | 'hindi' | 'tamil';

export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

export type LearningMode = 
  | 'teacher'
  | 'think'
  | 'concept'
  | 'trace'
  | 'interview'
  | 'challenge';

export interface ErrorInfo {
  type: 'syntax' | 'runtime' | 'logical' | 'warning' | 'bad_practice';
  line?: number;
  message: string;
  severity: number;
}

export interface CodeHealthScore {
  score: number;
  correct: number;
  errors: number;
  warnings: number;
  optimizations: number;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

export interface DebugResult {
  intent: string;
  actualBehavior: string;
  error: string;
  explanation: string;
  rootCause: string;
  learning: {
    whyItHappened: string;
    whenItHappens: string;
    howToAvoid: string;
    concept: string;
  };
  mentalModel: string;
  teacherMode?: string;
  thinkMode?: string;
  conceptBuilder?: string;
  debugTrace?: string;
  interviewMode?: string;
  challengeMode?: string;
  generalization: string;
  resources: {
    youtubeLinks: string[];
    documentationLinks: string[];
  };
  codeHealth: CodeHealthScore;
  correctedCode: string;
  diffView: DiffLine[];
  detectedLanguage: ProgrammingLanguage;
}

export interface DebugRequest {
  code: string;
  language: ProgrammingLanguage;
  explanationLanguage: ExplanationLanguage;
  userLevel: UserLevel;
  learningMode: LearningMode;
}
