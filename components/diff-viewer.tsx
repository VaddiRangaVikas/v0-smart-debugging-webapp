'use client';

import { useState } from 'react';
import { Copy, Download, Check, Eye, Code2, Plus, Minus } from 'lucide-react';
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
}

export function DiffViewer({ originalCode, correctedCode, diffView }: DiffViewerProps) {
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
        return 'bg-green-500/10 border-l-4 border-l-green-500';
      case 'removed':
        return 'bg-red-500/10 border-l-4 border-l-red-500';
      case 'unchanged':
        return 'bg-transparent';
      default:
        return '';
    }
  };

  const getDiffIcon = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return <Plus className="h-3 w-3 text-green-500" />;
      case 'removed':
        return <Minus className="h-3 w-3 text-red-500" />;
      default:
        return <span className="w-3" />;
    }
  };

  if (!correctedCode || correctedCode === originalCode) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Code2 className="h-4 w-4" />
            Code Transformation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No changes needed or debug first</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Code2 className="h-4 w-4" />
            Code Transformation
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 border-red-500/50 text-red-500">
            <Minus className="h-3 w-3" />
            {removedLines} removed
          </Badge>
          <Badge variant="outline" className="gap-1 border-green-500/50 text-green-500">
            <Plus className="h-3 w-3" />
            {addedLines} added
          </Badge>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            {unchangedLines} unchanged
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs value={view} onValueChange={(v) => setView(v as 'diff' | 'clean')} className="flex h-full flex-col">
          <div className="border-b px-4">
            <TabsList className="h-9 bg-transparent p-0">
              <TabsTrigger
                value="diff"
                className="gap-1.5 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent"
              >
                <Eye className="h-3.5 w-3.5" />
                Diff View
              </TabsTrigger>
              <TabsTrigger
                value="clean"
                className="gap-1.5 rounded-none border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent"
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
                      'flex items-start gap-2 px-4 py-0.5',
                      getDiffLineStyle(line.type)
                    )}
                  >
                    <span className="flex w-6 shrink-0 items-center justify-center text-muted-foreground">
                      {getDiffIcon(line.type)}
                    </span>
                    <span className="w-8 shrink-0 text-right text-muted-foreground/60">
                      {line.lineNumber}
                    </span>
                    <span
                      className={cn(
                        'flex-1 whitespace-pre-wrap break-all',
                        line.type === 'removed' && 'text-red-500 line-through opacity-70',
                        line.type === 'added' && 'text-green-500'
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
              <pre className="p-4 font-mono text-xs">
                <code>{correctedCode}</code>
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
