'use client';

import { useState } from 'react';
import { History, Clock, Code2, Trash2, ChevronRight, CheckCircle, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { DebugResult } from '@/lib/types';

export interface HistoryItem {
  id: string;
  timestamp: Date;
  code: string;
  language: string;
  result: DebugResult;
}

interface DebugHistoryProps {
  history: HistoryItem[];
  onSelectItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

export function DebugHistory({ history, onSelectItem, onClearHistory, onDeleteItem }: DebugHistoryProps) {
  const [open, setOpen] = useState(false);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getCodePreview = (code: string) => {
    const firstLine = code.split('\n')[0];
    return firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine;
  };

  const handleSelect = (item: HistoryItem) => {
    onSelectItem(item);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-border/50 bg-card/50 hover:bg-card hover:border-primary/50"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">History</span>
          {history.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
              {history.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] border-border/50 bg-card/95 backdrop-blur-xl sm:w-[540px]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <History className="h-4 w-4 text-primary" />
              </div>
              Debug History
            </span>
            {history.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClearHistory}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Clear All
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        {history.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <Clock className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No debug history yet</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Your debugging sessions will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-120px)] pr-4">
            <div className="space-y-3">
              {history.map((item) => (
                <Card 
                  key={item.id}
                  className="group cursor-pointer border-border/50 bg-secondary/30 transition-all hover:border-primary/50 hover:bg-secondary/50"
                  onClick={() => handleSelect(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {item.language}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(item.timestamp)}
                          </span>
                          {item.result.codeHealth.score >= 80 ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Code2 className="h-4 w-4 text-muted-foreground" />
                          <code className="text-xs text-muted-foreground">
                            {getCodePreview(item.code)}
                          </code>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-muted">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  item.result.codeHealth.score >= 80 ? "bg-cyan-500" :
                                  item.result.codeHealth.score >= 60 ? "bg-amber-500" :
                                  "bg-rose-500"
                                )}
                                style={{ width: `${item.result.codeHealth.score}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">
                              {item.result.codeHealth.score}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteItem(item.id);
                          }}
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
