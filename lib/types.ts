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

export type ExplanationLanguage = 
  | 'english' 
  | 'hindi' 
  | 'telugu' 
  | 'tamil' 
  | 'kannada' 
  | 'malayalam' 
  | 'marathi' 
  | 'bengali' 
  | 'gujarati' 
  | 'punjabi'
  | 'spanish'
  | 'french'
  | 'german'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'arabic'
  | 'portuguese'
  | 'russian';

export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

export type LearningMode = 
  | 'teacher'
  | 'think'
  | 'concept'
  | 'trace'
  | 'interview'
  | 'challenge';

export type ErrorType = 
  | 'syntax' 
  | 'runtime' 
  | 'logical' 
  | 'warning' 
  | 'bad_practice'
  | 'security'
  | 'performance'
  | 'memory'
  | 'type_error'
  | 'null_reference'
  | 'boundary'
  | 'concurrency'
  | 'resource_leak';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ErrorInfo {
  type: ErrorType;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: ErrorSeverity;
  severityScore: number; // 1-10 scale for precise scoring
  fix?: string; // The corrected version of the error line
  suggestion?: string; // Additional suggestion for improvement
  category?: string; // Category grouping (e.g., "Memory Management", "Input Validation")
  cweId?: string; // Common Weakness Enumeration ID for security issues
  impact?: string; // Description of the impact if not fixed
}

export interface CodeComplexity {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  nestingDepth: number;
  maintainabilityIndex: number; // 0-100 scale
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface SecurityAnalysis {
  vulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  securityScore: number; // 0-100 scale
  issues: Array<{
    type: string;
    severity: ErrorSeverity;
    line?: number;
    description: string;
    recommendation: string;
    cweId?: string;
  }>;
}

export interface CodeHealthScore {
  score: number;
  correct: number;
  errors: number;
  warnings: number;
  optimizations: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  complexity?: CodeComplexity;
  security?: SecurityAnalysis;
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
    youtubeLinks?: string[];
    youtubeSearchQueries?: string[];
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
