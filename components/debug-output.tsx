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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DebugResult, LearningMode } from '@/lib/types';

interface DebugOutputProps {
  result: DebugResult | null;
  learningMode: LearningMode;
}

export function DebugOutput({ result, learningMode }: DebugOutputProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Bug className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-4 text-sm">Debug output will appear here</p>
          <p className="mt-1 text-xs opacity-70">Enter code and press Ctrl+Enter to start debugging</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-1">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="learning">Learning</TabsTrigger>
            <TabsTrigger value="modes">Modes</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Intent */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-blue-500" />
                  Intent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{result.intent}</p>
              </CardContent>
            </Card>

            {/* Actual Behavior */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Cog className="h-4 w-4 text-orange-500" />
                  Actual Behavior
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{result.actualBehavior}</p>
              </CardContent>
            </Card>

            {/* Error */}
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.error}</p>
              </CardContent>
            </Card>

            {/* Explanation */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Explanation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.explanation}</p>
              </CardContent>
            </Card>

            {/* Root Cause */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Search className="h-4 w-4 text-purple-500" />
                  Root Cause
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{result.rootCause}</p>
              </CardContent>
            </Card>

            {/* Mental Model */}
            {result.mentalModel && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Brain className="h-4 w-4 text-primary" />
                    Mental Model / Analogy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm italic text-muted-foreground">{result.mentalModel}</p>
                </CardContent>
              </Card>
            )}

            {/* Generalization */}
            {result.generalization && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <RefreshCw className="h-4 w-4 text-cyan-500" />
                    Generalization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{result.generalization}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="learning" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-green-500" />
                  Learning Section
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Why It Happened
                  </h4>
                  <p className="text-sm">{result.learning.whyItHappened}</p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    When It Happens
                  </h4>
                  <p className="text-sm">{result.learning.whenItHappens}</p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    How to Avoid
                  </h4>
                  <p className="text-sm">{result.learning.howToAvoid}</p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Concept
                  </h4>
                  <p className="text-sm">{result.learning.concept}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modes" className="mt-4 space-y-4">
            {/* Teacher Mode */}
            {result.teacherMode && (
              <Card className={learningMode === 'teacher' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 text-indigo-500" />
                    Teacher Mode
                    {learningMode === 'teacher' && <Badge variant="secondary" className="ml-2">Active</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.teacherMode}</p>
                </CardContent>
              </Card>
            )}

            {/* Think Mode (Socratic) */}
            {result.thinkMode && (
              <Card className={learningMode === 'think' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <HelpCircle className="h-4 w-4 text-amber-500" />
                    Think Mode (Socratic)
                    {learningMode === 'think' && <Badge variant="secondary" className="ml-2">Active</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.thinkMode}</p>
                </CardContent>
              </Card>
            )}

            {/* Concept Builder */}
            {result.conceptBuilder && (
              <Card className={learningMode === 'concept' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Puzzle className="h-4 w-4 text-teal-500" />
                    Concept Builder
                    {learningMode === 'concept' && <Badge variant="secondary" className="ml-2">Active</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.conceptBuilder}</p>
                </CardContent>
              </Card>
            )}

            {/* Debug Trace */}
            {result.debugTrace && (
              <Card className={learningMode === 'trace' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Bug className="h-4 w-4 text-red-500" />
                    Debug Trace
                    {learningMode === 'trace' && <Badge variant="secondary" className="ml-2">Active</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-md overflow-x-auto">
                    {result.debugTrace}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Interview Mode */}
            {result.interviewMode && (
              <Card className={learningMode === 'interview' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-slate-500" />
                    Interview Mode
                    {learningMode === 'interview' && <Badge variant="secondary" className="ml-2">Active</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.interviewMode}</p>
                </CardContent>
              </Card>
            )}

            {/* Challenge Mode */}
            {result.challengeMode && (
              <Card className={learningMode === 'challenge' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Gamepad2 className="h-4 w-4 text-pink-500" />
                    Challenge Mode
                    {learningMode === 'challenge' && <Badge variant="secondary" className="ml-2">Active</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.challengeMode}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="resources" className="mt-4 space-y-4">
            {/* YouTube Links */}
            {result.resources.youtubeLinks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Youtube className="h-4 w-4 text-red-500" />
                    YouTube Resources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.resources.youtubeLinks.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Documentation Links */}
            {result.resources.documentationLinks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Documentation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.resources.documentationLinks.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result.resources.youtubeLinks.length === 0 && result.resources.documentationLinks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-50" />
                <p className="mt-2 text-sm">No additional resources available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
