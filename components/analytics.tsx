'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, Clock, Code2, Activity, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { HistoryItem } from './debug-history';

interface AnalyticsProps {
  history: HistoryItem[];
}

const COLORS = {
  primary: '#22d3ee',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  purple: '#a78bfa',
};

export function Analytics({ history }: AnalyticsProps) {
  const [open, setOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  const stats = useMemo(() => {
    const now = new Date();
    const ranges = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const filteredHistory = history.filter(
      item => now.getTime() - new Date(item.timestamp).getTime() < ranges[timeRange]
    );

    // Usage over time data
    const usageData = generateUsageData(filteredHistory, timeRange);
    
    // Language distribution
    const languageData = filteredHistory.reduce((acc, item) => {
      const lang = item.language || 'Unknown';
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const languageChartData = Object.entries(languageData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Health score distribution
    const healthScores = filteredHistory.map(item => item.result.codeHealth.score);
    const avgHealth = healthScores.length > 0 
      ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) 
      : 0;

    const healthDistribution = [
      { name: 'Excellent (80-100)', value: healthScores.filter(s => s >= 80).length, color: COLORS.success },
      { name: 'Good (60-79)', value: healthScores.filter(s => s >= 60 && s < 80).length, color: COLORS.warning },
      { name: 'Needs Work (<60)', value: healthScores.filter(s => s < 60).length, color: COLORS.error },
    ].filter(d => d.value > 0);

    return {
      totalDebugs: filteredHistory.length,
      avgHealth,
      usageData,
      languageChartData,
      healthDistribution,
      topLanguage: languageChartData[0]?.name || 'N/A',
    };
  }, [history, timeRange]);

  function generateUsageData(items: HistoryItem[], range: string) {
    const now = new Date();
    const data: { name: string; debugs: number }[] = [];

    if (range === 'hour') {
      // Last 60 minutes in 10-minute intervals
      for (let i = 5; i >= 0; i--) {
        const startTime = new Date(now.getTime() - (i + 1) * 10 * 60 * 1000);
        const endTime = new Date(now.getTime() - i * 10 * 60 * 1000);
        const count = items.filter(item => {
          const time = new Date(item.timestamp).getTime();
          return time >= startTime.getTime() && time < endTime.getTime();
        }).length;
        data.push({ name: `${(i + 1) * 10}m`, debugs: count });
      }
    } else if (range === 'day') {
      // Last 24 hours in 4-hour intervals
      for (let i = 5; i >= 0; i--) {
        const startTime = new Date(now.getTime() - (i + 1) * 4 * 60 * 60 * 1000);
        const endTime = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
        const count = items.filter(item => {
          const time = new Date(item.timestamp).getTime();
          return time >= startTime.getTime() && time < endTime.getTime();
        }).length;
        data.push({ name: `${(i + 1) * 4}h`, debugs: count });
      }
    } else if (range === 'week') {
      // Last 7 days
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        const count = items.filter(item => {
          const time = new Date(item.timestamp).getTime();
          return time >= startOfDay.getTime() && time <= endOfDay.getTime();
        }).length;
        data.push({ name: days[new Date(now.getTime() - i * 24 * 60 * 60 * 1000).getDay()], debugs: count });
      }
    } else {
      // Last 30 days in 5-day intervals
      for (let i = 5; i >= 0; i--) {
        const startTime = new Date(now.getTime() - (i + 1) * 5 * 24 * 60 * 60 * 1000);
        const endTime = new Date(now.getTime() - i * 5 * 24 * 60 * 60 * 1000);
        const count = items.filter(item => {
          const time = new Date(item.timestamp).getTime();
          return time >= startTime.getTime() && time < endTime.getTime();
        }).length;
        data.push({ name: `${(i + 1) * 5}d`, debugs: count });
      }
    }

    return data;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-border/50 bg-card/50 hover:bg-card hover:border-primary/50"
        >
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Analytics</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] border-border/50 bg-card/95 backdrop-blur-xl sm:w-[640px] sm:max-w-none">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            Usage Analytics
          </SheetTitle>
        </SheetHeader>

        {/* Time Range Selector */}
        <div className="mb-6">
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <TabsList className="grid w-full grid-cols-4 bg-secondary/50">
              <TabsTrigger value="hour" className="text-xs">Last Hour</TabsTrigger>
              <TabsTrigger value="day" className="text-xs">Last Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Last Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Last Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card className="border-border/50 bg-secondary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total Debugs</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{stats.totalDebugs}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-secondary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span className="text-xs text-muted-foreground">Avg Health</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-cyan-400">{stats.avgHealth}%</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-secondary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Top Language</span>
              </div>
              <p className="mt-2 text-lg font-bold text-green-400">{stats.topLanguage}</p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Over Time Chart */}
        <Card className="mb-6 border-border/50 bg-secondary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              Usage Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalDebugs === 0 ? (
              <div className="flex h-[150px] items-center justify-center text-sm text-muted-foreground">
                No data for this time period
              </div>
            ) : (
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.usageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.8)', 
                        border: '1px solid rgba(34,211,238,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="debugs" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Charts */}
        <div className="grid grid-cols-2 gap-4">
          {/* Language Distribution */}
          <Card className="border-border/50 bg-secondary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">Language Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.languageChartData.length === 0 ? (
                <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
                  No data
                </div>
              ) : (
                <div className="h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.languageChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {stats.languageChartData.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={[COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple, COLORS.error][index % 5]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.8)', 
                          border: '1px solid rgba(34,211,238,0.3)',
                          borderRadius: '8px',
                          fontSize: '10px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Health Distribution */}
          <Card className="border-border/50 bg-secondary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">Health Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.healthDistribution.length === 0 ? (
                <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
                  No data
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {stats.healthDistribution.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="flex-1 text-xs text-muted-foreground">{item.name}</span>
                      <span className="text-xs font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
