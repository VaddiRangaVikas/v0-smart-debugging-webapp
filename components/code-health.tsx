'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import type { CodeHealthScore } from '@/lib/types';

interface CodeHealthProps {
  health: CodeHealthScore | null;
}

const COLORS = {
  correct: '#22c55e', // green
  errors: '#ef4444', // red
  warnings: '#eab308', // yellow
  optimizations: '#3b82f6', // blue
};

export function CodeHealth({ health }: CodeHealthProps) {
  if (!health) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4" />
            Code Health
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Run debugging to see code health</p>
        </CardContent>
      </Card>
    );
  }

  const data = [
    { name: 'Correct', value: health.correct, color: COLORS.correct },
    { name: 'Errors', value: health.errors, color: COLORS.errors },
    { name: 'Warnings', value: health.warnings, color: COLORS.warnings },
    { name: 'Optimizations', value: health.optimizations, color: COLORS.optimizations },
  ].filter((d) => d.value > 0);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Poor';
    return 'Critical';
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Code Health
          </span>
          <span className={`text-2xl font-bold ${getScoreColor(health.score)}`}>
            {health.score}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                          <p className="font-medium">{data.name}</p>
                          <p className="text-muted-foreground">{data.value}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  content={({ payload }) => (
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                      {payload?.map((entry, index) => (
                        <div key={`legend-${index}`} className="flex items-center gap-1.5">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-xs text-muted-foreground">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className={`mt-2 text-sm font-medium ${getScoreColor(health.score)}`}>
            {getScoreLabel(health.score)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
