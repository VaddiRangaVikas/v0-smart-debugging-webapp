'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Code2, Globe, User, Sparkles } from 'lucide-react';
import type { ProgrammingLanguage, ExplanationLanguage, UserLevel, LearningMode } from '@/lib/types';

interface ControlPanelProps {
  language: ProgrammingLanguage;
  explanationLanguage: ExplanationLanguage;
  userLevel: UserLevel;
  learningMode: LearningMode;
  detectedLanguage?: ProgrammingLanguage;
  onLanguageChange: (value: ProgrammingLanguage) => void;
  onExplanationLanguageChange: (value: ExplanationLanguage) => void;
  onUserLevelChange: (value: UserLevel) => void;
  onLearningModeChange: (value: LearningMode) => void;
}

const LANGUAGES: { value: ProgrammingLanguage; label: string }[] = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
];

const EXPLANATION_LANGUAGES: { value: ExplanationLanguage; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'tamil', label: 'Tamil' },
];

const USER_LEVELS: { value: UserLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'Simple, no jargon' },
  { value: 'intermediate', label: 'Intermediate', description: 'Technical terms' },
  { value: 'advanced', label: 'Advanced', description: 'Deep reasoning' },
];

const LEARNING_MODES: { value: LearningMode; label: string; description: string }[] = [
  { value: 'teacher', label: 'Teacher', description: 'Step-by-step teaching' },
  { value: 'think', label: 'Socratic', description: 'Guided questions' },
  { value: 'concept', label: 'Concept Builder', description: 'Core concepts' },
  { value: 'trace', label: 'Debug Trace', description: 'Execution flow' },
  { value: 'interview', label: 'Interview', description: 'Interview prep' },
  { value: 'challenge', label: 'Challenge', description: 'Hints only' },
];

export function ControlPanel({
  language,
  explanationLanguage,
  userLevel,
  learningMode,
  detectedLanguage,
  onLanguageChange,
  onExplanationLanguageChange,
  onUserLevelChange,
  onLearningModeChange,
}: ControlPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Programming Language */}
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-muted-foreground" />
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {detectedLanguage && language === 'auto' && (
          <Badge variant="secondary" className="text-xs">
            Detected: {detectedLanguage}
          </Badge>
        )}
      </div>

      {/* Explanation Language */}
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <Select value={explanationLanguage} onValueChange={onExplanationLanguageChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Response" />
          </SelectTrigger>
          <SelectContent>
            {EXPLANATION_LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* User Level */}
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <Select value={userLevel} onValueChange={onUserLevelChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            {USER_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                <div className="flex flex-col">
                  <span>{level.label}</span>
                  <span className="text-xs text-muted-foreground">{level.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Learning Mode */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <Select value={learningMode} onValueChange={onLearningModeChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            {LEARNING_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                <div className="flex flex-col">
                  <span>{mode.label}</span>
                  <span className="text-xs text-muted-foreground">{mode.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
