'use client';

import { useState, useCallback } from 'react';
import { Bug, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/code-editor';
import { DebugOutput } from '@/components/debug-output';
import { CodeHealth } from '@/components/code-health';
import { DiffViewer } from '@/components/diff-viewer';
import { ControlPanel } from '@/components/control-panel';
import type {
  ProgrammingLanguage,
  ExplanationLanguage,
  UserLevel,
  LearningMode,
  DebugResult,
} from '@/lib/types';

export default function DebugAssistant() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<ProgrammingLanguage>('auto');
  const [explanationLanguage, setExplanationLanguage] = useState<ExplanationLanguage>('english');
  const [userLevel, setUserLevel] = useState<UserLevel>('intermediate');
  const [learningMode, setLearningMode] = useState<LearningMode>('teacher');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDebug = useCallback(async () => {
    if (!code.trim()) {
      setError('Please enter some code to debug');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
          explanationLanguage,
          userLevel,
          learningMode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to debug code');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Debug error:', err);
      setError('Failed to debug code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [code, language, explanationLanguage, userLevel, learningMode]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bug className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">AI Debug Assistant</h1>
              <p className="text-xs text-muted-foreground">Smart debugging with learning</p>
            </div>
          </div>

          <ControlPanel
            language={language}
            explanationLanguage={explanationLanguage}
            userLevel={userLevel}
            learningMode={learningMode}
            detectedLanguage={result?.detectedLanguage}
            onLanguageChange={setLanguage}
            onExplanationLanguageChange={setExplanationLanguage}
            onUserLevelChange={setUserLevel}
            onLearningModeChange={setLearningMode}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="container flex-1 px-4 py-6">
        <div className="grid h-full gap-6 lg:grid-cols-2">
          {/* Left Column - Code Input */}
          <div className="flex flex-col gap-4">
            <div className="flex-1 rounded-xl border bg-card p-4 shadow-sm">
              <CodeEditor
                value={code}
                onChange={setCode}
                onSubmit={handleDebug}
                isLoading={isLoading}
                placeholder="Paste your code here, or drag and drop files (images, PDFs, code files)..."
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleDebug}
                disabled={isLoading || !code.trim()}
                className="flex-1 gap-2"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Debug Code
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Code Health */}
            <div className="h-[320px]">
              <CodeHealth health={result?.codeHealth ?? null} />
            </div>
          </div>

          {/* Right Column - Debug Output */}
          <div className="flex flex-col gap-4">
            <div className="flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
              <DebugOutput result={result} learningMode={learningMode} />
            </div>

            {/* Diff Viewer */}
            <div className="h-[350px]">
              <DiffViewer
                originalCode={code}
                correctedCode={result?.correctedCode ?? ''}
                diffView={result?.diffView ?? []}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container px-4 text-center text-xs text-muted-foreground">
          Powered by Google Gemini AI | Supports all major programming languages
        </div>
      </footer>
    </div>
  );
}
