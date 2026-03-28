'use client';

import { useState, useCallback, useEffect } from 'react';
import { Bug, Loader2, Zap, Terminal, Cpu, Activity, Sparkles, CircuitBoard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/code-editor';
import { DebugOutput } from '@/components/debug-output';
import { CodeHealth } from '@/components/code-health';
import { DiffViewer } from '@/components/diff-viewer';
import { ControlPanel } from '@/components/control-panel';
import { DebugHistory, type HistoryItem } from '@/components/debug-history';
import { Analytics } from '@/components/analytics';
import { SplashScreen } from '@/components/splash-screen';
import type {
  ProgrammingLanguage,
  ExplanationLanguage,
  UserLevel,
  LearningMode,
  DebugResult,
} from '@/lib/types';

export default function DebugAssistant() {
  const [showSplash, setShowSplash] = useState(true);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<ProgrammingLanguage>('auto');
  const [explanationLanguage, setExplanationLanguage] = useState<ExplanationLanguage>('english');
  const [userLevel, setUserLevel] = useState<UserLevel>('intermediate');
  const [learningMode, setLearningMode] = useState<LearningMode>('teacher');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('debugHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // Convert timestamp strings back to Date objects
        const historyWithDates = parsed.map((item: HistoryItem) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        setHistory(historyWithDates);
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('debugHistory', JSON.stringify(history));
    }
  }, [history]);

  const addToHistory = useCallback((debugResult: DebugResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date(),
      code,
      language: debugResult.detectedLanguage || language,
      result: debugResult,
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50)); // Keep last 50 items
  }, [code, language]);

  const handleSelectHistoryItem = useCallback((item: HistoryItem) => {
    setCode(item.code);
    setResult(item.result);
    if (item.language !== 'auto') {
      setLanguage(item.language as ProgrammingLanguage);
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('debugHistory');
  }, []);

  const handleDeleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

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

      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific error messages from the API
        setError(data.error || 'Failed to debug code. Please try again.');
        return;
      }

      setResult(data);
      addToHistory(data);
    } catch (err) {
      console.error('Debug error:', err);
      setError('Failed to connect to the AI service. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [code, language, explanationLanguage, userLevel, learningMode]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} duration={2500} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Animated background grid */}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      
      {/* Floating orbs */}
      <div className="pointer-events-none fixed -left-32 top-1/4 h-64 w-64 rounded-full bg-neon-cyan/10 blur-[100px] animate-float" />
      <div className="pointer-events-none fixed -right-32 bottom-1/4 h-64 w-64 rounded-full bg-neon-purple/10 blur-[100px] animate-float" style={{ animationDelay: '1.5s' }} />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <Bug className="h-5 w-5 text-primary animate-pulse" />
              <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-neon-green animate-blink" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <span className="text-glow-cyan">AI Debug Assistant</span>
                <Sparkles className="h-4 w-4 text-neon-cyan animate-pulse" />
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cpu className="h-3 w-3" />
                Powered by Google Gemini AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DebugHistory
              history={history}
              onSelectItem={handleSelectHistoryItem}
              onClearHistory={handleClearHistory}
              onDeleteItem={handleDeleteHistoryItem}
            />
            <Analytics history={history} />
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
        </div>
      </header>

      {/* Status Bar */}
      <div className="border-b border-border/30 bg-card/50 px-4 py-2">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isLoading ? 'status-warning animate-blink' : 'status-online'}`} />
              <span className="text-muted-foreground">{isLoading ? 'Analyzing...' : 'Ready'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" />
              <span>Language: {language === 'auto' ? (result?.detectedLanguage || 'Auto') : language}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span>Mode: {learningMode}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircuitBoard className="h-3.5 w-3.5 text-neon-cyan" />
            <span>v2.0 Neural Engine</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container relative flex-1 px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Top Row - Code Input and Code Transformation side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left - Code Input */}
            <div className="flex flex-col gap-4">
              <div className="group relative h-[350px] overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
                {/* Scan line effect */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent animate-[scan-line_3s_ease-in-out_infinite]" />
                </div>
                
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  onSubmit={handleDebug}
                  isLoading={isLoading}
                  placeholder="Paste your code here, or drag and drop files..."
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleDebug}
                  disabled={isLoading || !code.trim()}
                  className="relative flex-1 gap-2 overflow-hidden bg-primary text-primary-foreground transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.4)]"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing Code...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>Debug Code</span>
                    </>
                  )}
                  <div className="absolute inset-0 animate-shimmer" />
                </Button>
              </div>

              {error && (
                <div className="animate-pulse rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-[0_0_15px_rgba(255,0,0,0.2)]">
                  {error}
                </div>
              )}
            </div>

            {/* Right - Code Transformation */}
            <div className="h-[420px]">
              <DiffViewer
                originalCode={code}
                correctedCode={result?.correctedCode ?? ''}
                diffView={result?.diffView ?? []}
                hasResult={result !== null}
              />
            </div>
          </div>

          {/* Bottom Row - Debug Output and Code Health */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left - Debug Output */}
            <div className="group relative min-h-[400px] overflow-hidden rounded-2xl border border-border/50 bg-card/80 shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
              <DebugOutput result={result} learningMode={learningMode} />
            </div>

            {/* Right - Code Health */}
            <div className="h-[400px]">
              <CodeHealth health={result?.codeHealth ?? null} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-border/30 bg-card/30 py-4 backdrop-blur-sm">
        <div className="container flex items-center justify-between px-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-neon-green animate-pulse" />
            All systems operational
          </p>
          <p className="text-xs text-muted-foreground">
            Supports 14+ programming languages with intelligent auto-detection
          </p>
        </div>
      </footer>
    </div>
  );
}
