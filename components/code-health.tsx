'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CodeHealthScore } from '@/lib/types';

interface CodeHealthProps {
  health: CodeHealthScore | null;
}

const COLORS = {
  correct: '#22d3ee', // cyan
  errors: '#f43f5e', // rose
  warnings: '#fbbf24', // amber
  optimizations: '#a78bfa', // violet
};

export function CodeHealth({ health }: CodeHealthProps) {
  if (!health) {
    return (
      <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <Activity className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>Code Health</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] flex-col items-center justify-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-border/50 animate-[spin_10s_linear_infinite]" />
            <Activity className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">Run debugging to see code health</p>
        </CardContent>
      </Card>
    );
  }

  const data = [
    { name: 'Correct', value: health.correct, color: COLORS.correct, icon: CheckCircle2 },
    { name: 'Errors', value: health.errors, color: COLORS.errors, icon: XCircle },
    { name: 'Warnings', value: health.warnings, color: COLORS.warnings, icon: AlertTriangle },
    { name: 'Optimizations', value: health.optimizations, color: COLORS.optimizations, icon: Sparkles },
  ].filter((d) => d.value > 0);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-cyan-400';
    if (score >= 60) return 'text-amber-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-rose-400';
  };

  const getScoreGlow = (score: number) => {
    if (score >= 80) return 'shadow-[0_0_30px_rgba(34,211,238,0.3)]';
    if (score >= 60) return 'shadow-[0_0_30px_rgba(251,191,36,0.3)]';
    if (score >= 40) return 'shadow-[0_0_30px_rgba(251,146,60,0.3)]';
    return 'shadow-[0_0_30px_rgba(244,63,94,0.3)]';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Poor';
    return 'Critical';
  };

  const getScoreBorderColor = (score: number) => {
    if (score >= 80) return 'border-cyan-500/30';
    if (score >= 60) return 'border-amber-500/30';
    if (score >= 40) return 'border-orange-500/30';
    return 'border-rose-500/30';
  };

  return (
    <Card className={cn(
      'h-full border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-500',
      getScoreBorderColor(health.score),
      getScoreGlow(health.score)
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <Activity className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>Code Health</span>
          </span>
          <div className="flex flex-col items-end">
            <span className={cn('text-3xl font-bold tabular-nums animate-text-glow', getScoreColor(health.score))}>
              {health.score}%
            </span>
            <span className={cn('text-xs font-medium', getScoreColor(health.score))}>
              {getScoreLabel(health.score)}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <div className="relative h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      style={{ filter: `drop-shadow(0 0 8px ${entry.color})` }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border/50 bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
                          <p className="font-medium" style={{ color: data.color }}>{data.name}</p>
                          <p className="text-muted-foreground">{data.value}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Activity className={cn('mx-auto h-5 w-5 animate-pulse', getScoreColor(health.score))} />
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="mt-4 grid w-full grid-cols-2 gap-3">
            {data.map((item, index) => {
              const Icon = item.icon;
              return (
                <div 
                  key={`legend-${index}`} 
                  className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2"
                >
                  <div 
                    className="flex h-5 w-5 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    <Icon className="h-3 w-3" style={{ color: item.color }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-semibold" style={{ color: item.color }}>
                      {item.value}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
