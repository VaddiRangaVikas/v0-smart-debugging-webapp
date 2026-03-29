'use client';

import { useState } from 'react';
import { Copy, Download, Check, Eye, Code2, Plus, Minus, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DiffLine } from '@/lib/types';

interface DiffViewerProps {
  originalCode: string;
  correctedCode: string;
  diffView: DiffLine[];
  hasResult: boolean; // Whether debugging has been run
}

export function DiffViewer({ originalCode, correctedCode, diffView, hasResult }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'diff' | 'clean'>('diff');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(correctedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([correctedCode], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'corrected_code.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const addedLines = diffView.filter((d) => d.type === 'added').length;
  const removedLines = diffView.filter((d) => d.type === 'removed').length;
  const unchangedLines = diffView.filter((d) => d.type === 'unchanged').length;

  const getDiffLineStyle = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-blue-500/20 border-l-4 border-l-blue-500';
      case 'removed':
        return 'bg-red-500/20 border-l-4 border-l-red-500';
      case 'unchanged':
        return 'bg-muted/5 border-l-4 border-l-muted/30';
      default:
        return '';
    }
  };

  const getDiffIcon = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return <Plus className="h-3.5 w-3.5 text-blue-400 font-bold" />;
      case 'removed':
        return <Minus className="h-3.5 w-3.5 text-red-400 font-bold" />;
      default:
        return <span className="w-3.5 text-muted-foreground/30 text-center">|</span>;
    }
  };

  // Show waiting state if no result yet (before debugging)
  if (!hasResult) {
    return (
      <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50">
              <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-muted-foreground">Code Transformation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-xl border-2 border-dashed border-border/50" />
            <Code2 className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Waiting for Analysis</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Run debugging to see code transformations</p>
        </CardContent>
      </Card>
    );
  }

  // Check if the code is essentially the same (no real changes needed)
  const noChangesNeeded = !correctedCode || 
    correctedCode.trim().length === 0 ||
    (correctedCode.trim() === originalCode.trim() && diffView.every(d => d.type === 'unchanged'));

  if (noChangesNeeded) {
    return (
      <Card className="h-full border-green-500/30 bg-green-500/5 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/20">
              <Check className="h-3.5 w-3.5 text-green-400" />
            </div>
            <span className="text-green-400">Code Transformation</span>
            <Badge variant="secondary" className="ml-2 bg-green-500/20 text-green-400">
              No Changes
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-xl bg-green-500/10 animate-pulse" />
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <p className="text-sm font-medium text-green-400">Your code is correct!</p>
          <p className="mt-1 text-xs text-muted-foreground">No transformations needed</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <GitCompare className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>Code Transformation</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 border-border/50 bg-secondary/50 text-xs hover:border-primary/50 hover:bg-primary/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-1.5 border-border/50 bg-secondary/50 text-xs hover:border-primary/50 hover:bg-primary/10"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge 
            variant="outline" 
            className="gap-1.5 border-red-500/50 bg-red-500/20 text-red-400 font-medium"
          >
            <Minus className="h-3 w-3" />
            <span>{removedLines} errors/removed</span>
          </Badge>
          <Badge 
            variant="outline" 
            className="gap-1.5 border-blue-500/50 bg-blue-500/20 text-blue-400 font-medium"
          >
            <Plus className="h-3 w-3" />
            <span>{addedLines} fixes/added</span>
          </Badge>
          <Badge 
            variant="outline" 
            className="gap-1.5 border-border/50 text-muted-foreground"
          >
            <span>{unchangedLines} unchanged</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs value={view} onValueChange={(v) => setView(v as 'diff' | 'clean')} className="flex h-full flex-col">
          <div className="border-b border-border/30 px-4">
            <TabsList className="h-9 bg-transparent p-0">
              <TabsTrigger
                value="diff"
                className="gap-1.5 rounded-none border-b-2 border-b-transparent px-4 text-xs data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <Eye className="h-3.5 w-3.5" />
                Diff View
              </TabsTrigger>
              <TabsTrigger
                value="clean"
                className="gap-1.5 rounded-none border-b-2 border-b-transparent px-4 text-xs data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <Code2 className="h-3.5 w-3.5" />
                Clean Code
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="diff" className="m-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="font-mono text-xs">
                {diffView.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 px-4 py-1 transition-colors hover:bg-muted/10',
                      getDiffLineStyle(line.type),
                      line.type === 'added' && 'animate-[fadeIn_0.5s_ease-in-out]',
                    )}
                  >
                    <span className="flex w-6 shrink-0 items-center justify-center">
                      {getDiffIcon(line.type)}
                    </span>
                    <span className={cn(
                      "w-10 shrink-0 text-right select-none font-medium",
                      line.type === 'removed' && 'text-red-400/70',
                      line.type === 'added' && 'text-blue-400/70',
                      line.type === 'unchanged' && 'text-muted-foreground/40'
                    )}>
                      {line.lineNumber}
                    </span>
                    <span
                      className={cn(
                        'flex-1 whitespace-pre-wrap break-all',
                        line.type === 'removed' && 'text-red-400 line-through decoration-red-500/50 decoration-2',
                        line.type === 'added' && 'text-blue-400 font-medium',
                        line.type === 'unchanged' && 'text-foreground/80'
                      )}
                    >
                      {line.content || ' '}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="clean" className="m-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="flex">
                {/* Line numbers */}
                <div className="flex flex-col border-r border-border/30 bg-muted/20 px-3 py-4 font-mono text-xs text-muted-foreground/40 select-none">
                  {correctedCode.split('\n').map((_, i) => (
                    <span key={i} className="leading-5 text-right min-w-[2ch]">
                      {i + 1}
                    </span>
                  ))}
                </div>
                <pre className="flex-1 p-4 font-mono text-xs leading-5">
                  <code className="text-foreground">{correctedCode}</code>
                </pre>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
