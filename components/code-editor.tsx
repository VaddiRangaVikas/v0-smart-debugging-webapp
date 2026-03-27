'use client';

import { useRef, useCallback } from 'react';
import { Upload, FileCode, ImageIcon, FileText } from 'lucide-react';
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSubmit();
      }
      // Handle Tab key for indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.currentTarget.selectionStart;
        const end = e.currentTarget.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        // Set cursor position after the tab
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
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

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
        console.error('File drop error:', error);
        alert('Failed to extract code from file. Please try again.');
      }
    },
    [onChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Code Input</h3>
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
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>
      
      <div
        className={cn(
          'relative flex-1 rounded-lg border bg-muted/30 transition-colors',
          'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="absolute right-3 top-3 flex items-center gap-2 text-xs text-muted-foreground">
          <FileCode className="h-3.5 w-3.5" />
          <ImageIcon className="h-3.5 w-3.5" />
          <FileText className="h-3.5 w-3.5" />
        </div>
        
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className={cn(
            'h-full w-full resize-none rounded-lg bg-transparent p-4 font-mono text-sm',
            'placeholder:text-muted-foreground/60 focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          spellCheck={false}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Drag & drop files or paste code directly</span>
        <span>Press Ctrl+Enter to debug</span>
      </div>
    </div>
  );
}
