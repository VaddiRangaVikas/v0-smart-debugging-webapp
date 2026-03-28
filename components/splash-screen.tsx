'use client';

import { useState, useEffect } from 'react';
import { Bug, Code2, Sparkles, Cpu, Terminal, Zap, Binary, CircuitBoard } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentText, setCurrentText] = useState(0);
  
  const loadingTexts = [
    'Initializing AI Engine...',
    'Loading Neural Networks...',
    'Connecting to Gemini...',
    'Ready to Debug!',
  ];

  useEffect(() => {
    let mounted = true;
    
    const progressInterval = setInterval(() => {
      if (mounted) {
        setProgress((prev) => {
          if (prev >= 100) {
            return 100;
          }
          return prev + 2;
        });
      }
    }, duration / 50);

    const textInterval = setInterval(() => {
      if (mounted) {
        setCurrentText((prev) => (prev + 1) % loadingTexts.length);
      }
    }, duration / 4);

    const completeTimer = setTimeout(() => {
      if (mounted) {
        onComplete();
      }
    }, duration);

    return () => {
      mounted = false;
      clearInterval(progressInterval);
      clearInterval(textInterval);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete, loadingTexts.length]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      
      {/* Glowing orbs */}
      <div className="absolute -left-32 top-1/4 h-64 w-64 rounded-full bg-primary/20 blur-[100px] animate-pulse" />
      <div className="absolute -right-32 bottom-1/4 h-64 w-64 rounded-full bg-purple-500/20 blur-[100px] animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-8">
        {/* Logo animation */}
        <div className="relative">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-32 rounded-full border-2 border-primary/20 animate-[spin_8s_linear_infinite]">
              <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary" />
            </div>
          </div>
          
          {/* Middle rotating ring (opposite direction) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 rounded-full border border-primary/30 animate-[spin_6s_linear_infinite_reverse]">
              <div className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary/70" />
            </div>
          </div>

          {/* Inner pulsing circle */}
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '1.5s' }} />
            <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-primary/10 shadow-[0_0_30px_rgba(0,255,255,0.5)]">
              <Bug className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>

          {/* Orbiting icons */}
          <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
            <Code2 className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 text-primary/70" />
          </div>
          <div className="absolute inset-0 animate-[spin_5s_linear_infinite_reverse]">
            <Terminal className="absolute -bottom-3 left-1/2 h-4 w-4 -translate-x-1/2 text-primary/60" />
          </div>
          <div className="absolute inset-0 animate-[spin_6s_linear_infinite]">
            <Binary className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
          </div>
          <div className="absolute inset-0 animate-[spin_7s_linear_infinite_reverse]">
            <CircuitBoard className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent animate-pulse">
              AI Debug Assistant
            </span>
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          </h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cpu className="h-4 w-4 animate-pulse" />
            Powered by Google Gemini AI
          </p>
        </div>

        {/* Loading bar */}
        <div className="w-64 space-y-3">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted/30">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-cyan-400 to-primary transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/50 via-cyan-400/50 to-primary/50 blur-sm transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground animate-pulse">
              {loadingTexts[currentText]}
            </span>
            <span className="font-mono text-primary">{progress}%</span>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-4 flex gap-6">
          {[
            { icon: Zap, label: '14+ Languages' },
            { icon: Sparkles, label: 'AI Powered' },
            { icon: Terminal, label: 'Real-time' },
          ].map(({ icon: Icon, label }, i) => (
            <div
              key={label}
              className="flex items-center gap-2 text-xs text-muted-foreground opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
              style={{ animationDelay: `${0.5 + i * 0.2}s` }}
            >
              <Icon className="h-3.5 w-3.5 text-primary/70" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom text */}
      <div className="absolute bottom-8 flex flex-col items-center gap-2 text-xs text-muted-foreground/50">
        <p>Smart Debugging for Every Developer</p>
      </div>
    </div>
  );
}
