'use client';

import { useState } from 'react';
import {
  Target,
  Cog,
  AlertCircle,
  Lightbulb,
  Search,
  BookOpen,
  Brain,
  GraduationCap,
  HelpCircle,
  Puzzle,
  Bug,
  Briefcase,
  Gamepad2,
  RefreshCw,
  Youtube,
  FileText,
  ExternalLink,
  Zap,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DebugResult, LearningMode } from '@/lib/types';

interface DebugOutputProps {
  result: DebugResult | null;
  learningMode: LearningMode;
}

export function DebugOutput({ result, learningMode }: DebugOutputProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse" />
            <div className="absolute inset-2 rounded-xl border border-dashed border-primary/30" />
            <Bug className="relative h-8 w-8 text-primary/50" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">Ready to Debug</h3>
          <p className="text-sm text-muted-foreground">
            Enter code and press <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">Ctrl+Enter</kbd> to start
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-neon-cyan animate-pulse" />
            <span>AI-powered analysis ready</span>
          </div>
        </div>
      </div>
    );
  }

  // Check if there are errors - prioritize codeHealth score
  const hasErrors = (() => {
    // If codeHealth score is 100, code is correct - no errors
    if (result.codeHealth && result.codeHealth.score === 100) return false;
    
    // Check error message for "no error" phrases
    if (result.error) {
      const errorLower = result.error.toLowerCase();
      const noErrorPhrases = [
        'no error', 'no errors', 'no issues', 'code is correct', 
        'looks correct', 'correctly implemented', 'looks good',
        'well-written', 'no bugs', 'correct'
      ];
      if (noErrorPhrases.some(phrase => errorLower.includes(phrase))) return false;
    }
    
    // If codeHealth score is below 100, there are errors
    if (result.codeHealth && result.codeHealth.score < 100) return true;
    
    // Default: check if error message exists and is meaningful
    return result.error && result.error.trim().length > 0;
  })();

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {/* Status Banner with Grade */}
        <Card className={cn(
          'relative overflow-hidden backdrop-blur-sm transition-all',
          hasErrors 
            ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.2)]'
            : 'border-green-500/50 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.2)]'
        )}>
          <div className={cn(
            'absolute inset-0 opacity-20',
            hasErrors 
              ? 'bg-gradient-to-r from-red-500/20 via-transparent to-red-500/20'
              : 'bg-gradient-to-r from-green-500/20 via-transparent to-green-500/20'
          )} />
          <CardContent className="relative flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full',
                hasErrors 
                  ? 'bg-red-500/20 animate-pulse'
                  : 'bg-green-500/20'
              )}>
                {hasErrors ? (
                  <XCircle className="h-6 w-6 text-red-400" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                )}
              </div>
              <div>
                <h3 className={cn(
                  'text-lg font-bold',
                  hasErrors ? 'text-red-400' : 'text-green-400'
                )}>
                  {hasErrors ? 'Errors Detected' : 'Code Looks Good!'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {hasErrors 
                    ? 'Issues found in your code. See details below.'
                    : 'No errors found. Your code is working correctly!'}
                </p>
              </div>
            </div>
            {/* Grade Badge */}
            {result.codeHealth?.grade && (
              <div className={cn(
                'flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold',
                result.codeHealth.grade === 'A' && 'bg-green-500/20 text-green-400',
                result.codeHealth.grade === 'B' && 'bg-blue-500/20 text-blue-400',
                result.codeHealth.grade === 'C' && 'bg-yellow-500/20 text-yellow-400',
                result.codeHealth.grade === 'D' && 'bg-orange-500/20 text-orange-400',
                result.codeHealth.grade === 'F' && 'bg-red-500/20 text-red-400',
              )}>
                {result.codeHealth.grade}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50">
            <TabsTrigger value="overview" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Zap className="h-3 w-3" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="learning" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-3 w-3" />
              Learning
            </TabsTrigger>
            <TabsTrigger value="modes" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Brain className="h-3 w-3" />
              Modes
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-3 w-3" />
              Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Intent */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                    <Target className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span>Intent</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{result.intent}</p>
              </CardContent>
            </Card>

            {/* Actual Behavior */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-orange-500/30 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/10">
                    <Cog className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <span>Actual Behavior</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{result.actualBehavior}</p>
              </CardContent>
            </Card>

            {/* Error - Only show prominently if there are errors */}
            <Card className={cn(
              'backdrop-blur-sm',
              hasErrors 
                ? 'border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                : 'border-green-500/30 bg-green-500/5'
            )}>
              <CardHeader className="pb-2">
                <CardTitle className={cn(
                  'flex items-center gap-2 text-sm',
                  hasErrors ? 'text-red-400' : 'text-green-400'
                )}>
                  <div className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-md',
                    hasErrors ? 'bg-red-500/20 animate-pulse' : 'bg-green-500/20'
                  )}>
                    {hasErrors ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span>{hasErrors ? 'Error Detected' : 'Status'}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={cn(
                  'font-mono text-sm leading-relaxed',
                  hasErrors ? 'text-red-400' : 'text-green-400'
                )}>
                  {result.error}
                </p>
              </CardContent>
            </Card>

            {/* Explanation */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-yellow-500/30 hover:shadow-[0_0_20px_rgba(234,179,8,0.1)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-500/10">
                    <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
                  </div>
                  <span>Explanation</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{result.explanation}</p>
              </CardContent>
            </Card>

            {/* Root Cause - Only show if there are errors */}
            {hasErrors && (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10">
                      <Search className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                    <span>Root Cause</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{result.rootCause}</p>
                </CardContent>
              </Card>
            )}

            {/* Mental Model */}
            {result.mentalModel && (
              <Card className="relative overflow-hidden border-primary/30 bg-primary/5 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-neon-cyan/5 via-transparent to-neon-purple/5" />
                <CardHeader className="relative pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20">
                      <Brain className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-glow-cyan">Mental Model / Analogy</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-sm italic leading-relaxed text-muted-foreground">{result.mentalModel}</p>
                </CardContent>
              </Card>
            )}

            {/* Generalization */}
            {result.generalization && (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10">
                      <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <span>Generalization</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{result.generalization}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="learning" className="mt-4 space-y-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/10">
                    <BookOpen className="h-3.5 w-3.5 text-green-400" />
                  </div>
                  <span>Learning Section</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <LearningItem
                  title="Why It Happened"
                  content={result.learning.whyItHappened}
                  color="blue"
                />
                <LearningItem
                  title="When It Happens"
                  content={result.learning.whenItHappens}
                  color="orange"
                />
                <LearningItem
                  title="How to Avoid"
                  content={result.learning.howToAvoid}
                  color="green"
                />
                <LearningItem
                  title="Concept"
                  content={result.learning.concept}
                  color="purple"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modes" className="mt-4 space-y-4">
            {/* Teacher Mode */}
            {result.teacherMode && (
              <ModeCard
                title="Teacher Mode"
                icon={GraduationCap}
                content={result.teacherMode}
                isActive={learningMode === 'teacher'}
                color="indigo"
              />
            )}

            {/* Think Mode (Socratic) */}
            {result.thinkMode && (
              <ModeCard
                title="Think Mode (Socratic)"
                icon={HelpCircle}
                content={result.thinkMode}
                isActive={learningMode === 'think'}
                color="amber"
              />
            )}

            {/* Concept Builder */}
            {result.conceptBuilder && (
              <ModeCard
                title="Concept Builder"
                icon={Puzzle}
                content={result.conceptBuilder}
                isActive={learningMode === 'concept'}
                color="teal"
              />
            )}

            {/* Debug Trace */}
            {result.debugTrace && (
              <Card className={cn(
                'border-border/50 bg-card/50 backdrop-blur-sm transition-all',
                learningMode === 'trace' && 'ring-2 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
              )}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10">
                      <Bug className="h-3.5 w-3.5 text-red-400" />
                    </div>
                    <span>Debug Trace</span>
                    {learningMode === 'trace' && (
                      <Badge variant="secondary" className="ml-2 animate-pulse bg-red-500/20 text-red-400">
                        Active
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-xs text-muted-foreground">
                    {result.debugTrace}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Interview Mode */}
            {result.interviewMode && (
              <ModeCard
                title="Interview Mode"
                icon={Briefcase}
                content={result.interviewMode}
                isActive={learningMode === 'interview'}
                color="slate"
              />
            )}

            {/* Challenge Mode */}
            {result.challengeMode && (
              <ModeCard
                title="Challenge Mode"
                icon={Gamepad2}
                content={result.challengeMode}
                isActive={learningMode === 'challenge'}
                color="pink"
              />
            )}
          </TabsContent>

          <TabsContent value="resources" className="mt-4 space-y-4">
            {/* YouTube Search Queries */}
            <Card className="border-red-500/30 bg-card/50 backdrop-blur-sm transition-all hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10">
                    <Youtube className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <span>YouTube Tutorials</span>
                  {(result.resources.youtubeSearchQueries?.length || 0) > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-red-500/20 text-red-400">
                      {result.resources.youtubeSearchQueries?.length} searches
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(result.resources.youtubeSearchQueries?.length || 0) > 0 ? (
                  <ul className="space-y-2">
                    {result.resources.youtubeSearchQueries?.map((query, i) => (
                      <li key={i}>
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 px-4 py-3 text-sm transition-all hover:border-red-500/50 hover:bg-red-500/10"
                        >
                          <Youtube className="h-5 w-5 shrink-0 text-red-400" />
                          <span className="flex-1 text-foreground">{query}</span>
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <Youtube className="h-8 w-8 opacity-30" />
                    <p className="mt-2 text-sm">No YouTube resources available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documentation Links */}
            <Card className="border-blue-500/30 bg-card/50 backdrop-blur-sm transition-all hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span>Official Documentation</span>
                  {result.resources.documentationLinks.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-blue-500/20 text-blue-400">
                      {result.resources.documentationLinks.length} docs
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.resources.documentationLinks.length > 0 ? (
                  <ul className="space-y-2">
                    {result.resources.documentationLinks.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 px-4 py-3 text-sm transition-all hover:border-blue-500/50 hover:bg-blue-500/10"
                        >
                          <FileText className="h-5 w-5 shrink-0 text-blue-400" />
                          <span className="flex-1 truncate text-foreground">{link}</span>
                          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <FileText className="h-8 w-8 opacity-30" />
                    <p className="mt-2 text-sm">No documentation links available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Help */}
            <Card className="border-primary/30 bg-primary/5 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span>Quick Search</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Search for more resources about this error:
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(result.error + ' ' + result.detectedLanguage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-medium transition-all hover:bg-primary hover:text-primary-foreground"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Google
                  </a>
                  <a
                    href={`https://stackoverflow.com/search?q=${encodeURIComponent(result.error)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-medium transition-all hover:bg-orange-500 hover:text-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Stack Overflow
                  </a>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(result.error + ' ' + result.detectedLanguage + ' tutorial')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-medium transition-all hover:bg-red-500 hover:text-white"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                    YouTube
                  </a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

function LearningItem({ title, content, color }: { title: string; content: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-l-blue-500',
    orange: 'border-l-orange-500',
    green: 'border-l-green-500',
    purple: 'border-l-purple-500',
  };

  return (
    <div className={cn('border-l-2 pl-4', colorMap[color])}>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-foreground">{content}</p>
    </div>
  );
}

function ModeCard({
  title,
  icon: Icon,
  content,
  isActive,
  color,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: string;
  isActive: boolean;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', ring: 'ring-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]' },
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', ring: 'ring-teal-500/50 shadow-[0_0_20px_rgba(20,184,166,0.2)]' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-400', ring: 'ring-slate-500/50 shadow-[0_0_20px_rgba(100,116,139,0.2)]' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', ring: 'ring-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.2)]' },
  };

  const colors = colorMap[color];

  return (
    <Card className={cn(
      'border-border/50 bg-card/50 backdrop-blur-sm transition-all',
      isActive && `ring-2 ${colors.ring}`
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', colors.bg)}>
            <Icon className={cn('h-3.5 w-3.5', colors.text)} />
          </div>
          <span>{title}</span>
          {isActive && (
            <Badge variant="secondary" className={cn('ml-2 animate-pulse', colors.bg, colors.text)}>
              Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{content}</p>
      </CardContent>
    </Card>
  );
}
