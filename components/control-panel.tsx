'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Code2, Globe, User, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  { value: 'beginner', label: 'Beginner', description: 'Simple explanations' },
  { value: 'intermediate', label: 'Intermediate', description: 'Technical terms' },
  { value: 'advanced', label: 'Advanced', description: 'Deep analysis' },
];

const LEARNING_MODES: { value: LearningMode; label: string; icon: string }[] = [
  { value: 'teacher', label: 'Teacher', icon: '📚' },
  { value: 'think', label: 'Socratic', icon: '🤔' },
  { value: 'concept', label: 'Concepts', icon: '💡' },
  { value: 'trace', label: 'Debug Trace', icon: '🔍' },
  { value: 'interview', label: 'Interview', icon: '💼' },
  { value: 'challenge', label: 'Challenge', icon: '🎮' },
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
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10">
          <Code2 className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="h-8 w-[130px] border-border/50 bg-secondary/50 text-xs hover:border-primary/50">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent className="border-border/50 bg-card/95 backdrop-blur-sm">
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value} className="text-xs">
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {detectedLanguage && language === 'auto' && (
          <Badge 
            variant="secondary" 
            className="animate-pulse border-primary/30 bg-primary/10 text-xs text-primary"
          >
            <Zap className="mr-1 h-3 w-3" />
            {detectedLanguage}
          </Badge>
        )}
      </div>

      {/* Explanation Language */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-500/10">
          <Globe className="h-3.5 w-3.5 text-green-400" />
        </div>
        <Select value={explanationLanguage} onValueChange={onExplanationLanguageChange}>
          <SelectTrigger className="h-8 w-[100px] border-border/50 bg-secondary/50 text-xs hover:border-primary/50">
            <SelectValue placeholder="Response" />
          </SelectTrigger>
          <SelectContent className="border-border/50 bg-card/95 backdrop-blur-sm">
            {EXPLANATION_LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value} className="text-xs">
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* User Level */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-500/10">
          <User className="h-3.5 w-3.5 text-purple-400" />
        </div>
        <Select value={userLevel} onValueChange={onUserLevelChange}>
          <SelectTrigger className="h-8 w-[120px] border-border/50 bg-secondary/50 text-xs hover:border-primary/50">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent className="border-border/50 bg-card/95 backdrop-blur-sm">
            {USER_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value} className="text-xs">
                <div className="flex flex-col">
                  <span className="font-medium">{level.label}</span>
                  <span className="text-muted-foreground">{level.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Learning Mode */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/10">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <Select value={learningMode} onValueChange={onLearningModeChange}>
          <SelectTrigger className={cn(
            "h-8 w-[130px] border-border/50 bg-secondary/50 text-xs hover:border-primary/50",
            "transition-all duration-300"
          )}>
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent className="border-border/50 bg-card/95 backdrop-blur-sm">
            {LEARNING_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value} className="text-xs">
                <div className="flex items-center gap-2">
                  <span>{mode.icon}</span>
                  <span className="font-medium">{mode.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
