'use client';

import { useState } from 'react';
import { Copy, Download, Check, Eye, Code2, Plus, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DiffLine, ErrorInfo } from '@/lib/types';

interface DiffViewerProps {
  originalCode: string;
  correctedCode: string;
  diffView: DiffLine[];
  hasResult: boolean; // Whether debugging has been run
  errors?: ErrorInfo[]; // Errors detected in the code
}

export function DiffViewer({ originalCode, correctedCode, diffView, hasResult, errors = [] }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'diff' | 'clean'>('diff');

  // Check if there are actual errors detected
  const hasErrors = errors.length > 0;
  
  // Create error line numbers set for quick lookup
  const errorLineNumbers = new Set(errors.filter(e => e.line).map(e => e.line));

  // Generate code view with error highlighting
  const codeWithErrorHighlighting = hasErrors && originalCode 
    ? originalCode.split('\n').map((line, index) => ({
        type: errorLineNumbers.has(index + 1) ? 'error' as const : 'unchanged' as const,
        content: line,
        lineNumber: index + 1,
        errorInfo: errors.find(e => e.line === index + 1),
      }))
    : [];

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
        return 'bg-cyan-500/15 border-l-4 border-l-cyan-400';
      case 'removed':
        return 'bg-red-500/15 border-l-4 border-l-red-500';
      case 'unchanged':
        return 'bg-transparent border-l-4 border-l-transparent';
      default:
        return '';
    }
  };

  const getDiffIcon = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return <Plus className="h-3.5 w-3.5 text-cyan-400 font-bold" />;
      case 'removed':
        return <Minus className="h-3.5 w-3.5 text-red-400 font-bold" />;
      default:
        return <span className="w-3.5" />;
    }
  };

  // Check if the code is essentially the same (no real changes needed)
  const noChangesNeeded = !correctedCode || 
    correctedCode.trim() === originalCode.trim() ||
    diffView.every(d => d.type === 'unchanged');

  // Show waiting state if no result yet (before debugging)
  if (!hasResult) {
    return (
      <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20">
              <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <span className="text-muted-foreground">Code Transformation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-xl border-2 border-dashed border-border/50" />
            <RefreshCw className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Waiting for Analysis</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Run debugging to see code transformations</p>
        </CardContent>
      </Card>
    );
  }

  // If no diff changes BUT there are errors, show error highlighting view
  if (noChangesNeeded && hasErrors) {
    return (
      <Card className="flex h-full flex-col border-red-500/30 bg-card/50 backdrop-blur-sm transition-all hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.1)]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/20">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              </div>
              <span className="text-red-400">Errors Detected</span>
              <Badge variant="secondary" className="ml-2 bg-red-500/20 text-red-400">
                {errors.length} {errors.length === 1 ? 'error' : 'errors'}
              </Badge>
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
          
          {/* Error Summary */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge 
              variant="outline" 
              className="gap-1.5 border-red-500/30 bg-red-500/10 text-red-400"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>{errors.length} errors on lines: {errors.filter(e => e.line).map(e => e.line).join(', ')}</span>
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0">
          <Tabs defaultValue="errors" className="flex h-full flex-col">
            <div className="border-b border-border/30 px-4">
              <TabsList className="h-9 bg-transparent p-0">
                <TabsTrigger
                  value="errors"
                  className="gap-1.5 rounded-none border-b-2 border-b-transparent px-4 text-xs data-[state=active]:border-b-red-500 data-[state=active]:bg-transparent data-[state=active]:text-red-400"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Error View
                </TabsTrigger>
                <TabsTrigger
                  value="code"
                  className="gap-1.5 rounded-none border-b-2 border-b-transparent px-4 text-xs data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Full Code
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="errors" className="m-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="font-mono text-xs">
                  {codeWithErrorHighlighting.map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2 px-4 py-0.5 transition-colors',
                        line.type === 'error' 
                          ? 'bg-red-500/20 border-l-2 border-l-red-500' 
                          : 'bg-transparent border-l-2 border-l-transparent'
                      )}
                    >
                      <span className="flex w-5 shrink-0 items-center justify-center">
                        {line.type === 'error' && <AlertTriangle className="h-3 w-3 text-red-400" />}
                      </span>
                      <span className="w-8 shrink-0 text-right text-muted-foreground/40 select-none">
                        {line.lineNumber}
                      </span>
                      <span
                        className={cn(
                          'flex-1 whitespace-pre-wrap break-all',
                          line.type === 'error' && 'text-red-400'
                        )}
                      >
                        {line.content || ' '}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Error Details */}
                <div className="border-t border-border/30 p-4 space-y-2">
                  <p className="text-xs font-medium text-red-400">Error Details:</p>
                  {errors.map((error, i) => (
                    <div key={i} className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-400">
                          Line {error.line || '?'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-400">
                          {error.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-red-300">{error.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="code" className="m-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="flex">
                  <div className="flex flex-col border-r border-border/30 bg-muted/20 px-3 py-4 font-mono text-xs text-muted-foreground/40 select-none">
                    {originalCode.split('\n').map((_, i) => (
                      <span 
                        key={i} 
                        className={cn(
                          "leading-5 text-right min-w-[2ch]",
                          errorLineNumbers.has(i + 1) && "text-red-400 font-bold"
                        )}
                      >
                        {i + 1}
                      </span>
                    ))}
                  </div>
                  <pre className="flex-1 p-4 font-mono text-xs leading-5">
                    <code className="text-foreground">{originalCode}</code>
                  </pre>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // No changes and no errors - code is correct
  if (noChangesNeeded) {
    return (
      <Card className="h-full border-green-500/30 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/20">
                <RefreshCw className="h-3.5 w-3.5 text-green-400" />
              </div>
              <span>Code Transformation</span>
            </CardTitle>
            <Badge variant="secondary" className="bg-green-500/20 text-green-400 border border-green-500/30">
              No Changes Needed
            </Badge>
          </div>
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
    <Card className="flex h-full flex-col border-cyan-500/30 bg-card/50 backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20">
              <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <span>Code Transformation</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5 border-border/50 bg-secondary/50 text-xs hover:border-cyan-500/50 hover:bg-cyan-500/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-1.5 border-border/50 bg-secondary/50 text-xs hover:border-cyan-500/50 hover:bg-cyan-500/10"
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
            className="gap-1.5 border-red-500/50 bg-red-500/20 text-red-400"
          >
            <Minus className="h-3 w-3" />
            <span>{removedLines} removed</span>
          </Badge>
          <Badge 
            variant="outline" 
            className="gap-1.5 border-cyan-500/50 bg-cyan-500/20 text-cyan-400"
          >
            <Plus className="h-3 w-3" />
            <span>{addedLines} added</span>
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
            <TabsList className="h-10 bg-transparent p-0 gap-4">
              <TabsTrigger
                value="diff"
                className="gap-2 rounded-none border-b-2 border-b-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-b-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-cyan-400"
              >
                <Eye className="h-4 w-4" />
                Diff View
              </TabsTrigger>
              <TabsTrigger
                value="clean"
                className="gap-2 rounded-none border-b-2 border-b-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-b-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-cyan-400"
              >
                <Code2 className="h-4 w-4" />
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
                      'flex items-start gap-1 px-2 py-1 transition-colors min-h-[24px]',
                      getDiffLineStyle(line.type)
                    )}
                  >
                    <span className="flex w-6 shrink-0 items-center justify-center">
                      {getDiffIcon(line.type)}
                    </span>
                    <span className={cn(
                      "w-10 shrink-0 text-right select-none pr-2",
                      line.type === 'removed' && 'text-red-400/70',
                      line.type === 'added' && 'text-cyan-400/70',
                      line.type === 'unchanged' && 'text-muted-foreground/40'
                    )}>
                      {line.lineNumber}
                    </span>
                    <span
                      className={cn(
                        'flex-1 whitespace-pre-wrap break-all',
                        line.type === 'removed' && 'text-red-400 line-through decoration-red-500/50',
                        line.type === 'added' && 'text-cyan-400 font-medium'
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
              <div className="font-mono text-xs">
                {correctedCode.split('\n').map((line, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1 px-2 py-1 min-h-[24px] hover:bg-cyan-500/5 transition-colors"
                  >
                    <span className="w-10 shrink-0 text-right text-cyan-400/50 select-none pr-2">
                      {i + 1}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-all text-foreground">
                      {line || ' '}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
