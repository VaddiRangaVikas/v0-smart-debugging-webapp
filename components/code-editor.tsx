'use client';

import { useRef, useCallback, useState } from 'react';
import { Upload, FileCode, ImageIcon, FileText, Keyboard, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export function CodeEditor({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder = 'Paste your code here or upload a file...',
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSubmit();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.currentTarget.selectionStart;
        const end = e.currentTarget.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
          }
        }, 0);
      }
    },
    [value, onChange, onSubmit]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File) => {
    setUploadProgress(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to extract code');
      }

      const data = await response.json();
      if (data.code) {
        onChange(data.code);
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to extract code from file. Please try again.');
    } finally {
      setUploadProgress(false);
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        await processFile(file);
      }
    },
    [onChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const lineCount = value.split('\n').length;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <FileCode className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Code Input</h3>
            <p className="text-xs text-muted-foreground">{lineCount} lines</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".py,.java,.c,.cpp,.js,.ts,.go,.rs,.php,.rb,.swift,.kt,.sql,.cs,.txt,image/*,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress}
            className="gap-2 border-border/50 bg-secondary/50 transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            {uploadProgress ? (
              <>
                <Sparkles className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Editor Area */}
      <div
        className={cn(
          'relative flex-1 overflow-hidden rounded-xl border transition-all duration-300',
          isDragging 
            ? 'border-primary bg-primary/5 shadow-[0_0_30px_rgba(0,255,255,0.2)]' 
            : 'border-border/50 bg-muted/20',
          'focus-within:border-primary/50 focus-within:shadow-[0_0_20px_rgba(0,255,255,0.1)]'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-primary">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-primary animate-pulse">
                <Upload className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium">Drop file to upload</p>
            </div>
          </div>
        )}

        {/* File type indicators */}
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-secondary/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
            <FileCode className="h-3 w-3" />
            <ImageIcon className="h-3 w-3" />
            <FileText className="h-3 w-3" />
          </div>
        </div>
        
        {/* Line numbers and textarea */}
        <div className="flex h-full">
          {/* Line numbers */}
          {value && (
            <div className="flex flex-col border-r border-border/30 bg-muted/30 px-3 py-4 font-mono text-xs text-muted-foreground/50 select-none">
              {value.split('\n').map((_, i) => (
                <span key={i} className="leading-6 text-right min-w-[2ch]">
                  {i + 1}
                </span>
              ))}
            </div>
          )}
          
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className={cn(
              'h-full w-full flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-6 text-foreground',
              'placeholder:text-muted-foreground/40 focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
            spellCheck={false}
          />
        </div>
      </div>
      
      {/* Footer hints */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Upload className="h-3 w-3" />
            Drag & drop files
          </span>
          <span className="flex items-center gap-1.5">
            <ImageIcon className="h-3 w-3" />
            Supports images & PDFs
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1 text-muted-foreground">
          <Keyboard className="h-3 w-3" />
          <span>Ctrl+Enter to debug</span>
        </div>
      </div>
    </div>
  );
}
