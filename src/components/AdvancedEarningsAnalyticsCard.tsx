'use client';

import { BarChart3, CalendarDays, Gauge, Route, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AdvancedEarningsAnalytics } from '@/lib/server/advanced-earnings';

interface AdvancedEarningsAnalyticsCardProps {
  analytics: AdvancedEarningsAnalytics;
}

export function AdvancedEarningsAnalyticsCard({
  analytics,
}: AdvancedEarningsAnalyticsCardProps) {
  const maxDayProfit = Math.max(1, ...analytics.weekdayPerformance.map((item) => item.totalProfit));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/90 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Avg Profit / Job
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-950">
              ${analytics.overview.averageProfitPerJob.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Median ${analytics.overview.medianProfitPerJob.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Gauge className="h-4 w-4 text-blue-600" />
              Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-950">
              {analytics.overview.profitMarginPercent.toFixed(1)}%
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Consistency {analytics.overview.consistencyScore.toFixed(0)} / 100
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays className="h-4 w-4 text-amber-600" />
              Best Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-950">
              ${analytics.overview.bestDayProfit.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Worst ${analytics.overview.worstDayProfit.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Star className="h-4 w-4 text-violet-600" />
              Reputation Signal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.reputationSignal ? (
              <>
                <div className="text-2xl font-bold text-slate-950">
                  {analytics.reputationSignal.averageRating.toFixed(1)}★
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {analytics.reputationSignal.totalRatings} ratings
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-slate-950">N/A</div>
                <p className="mt-1 text-xs text-slate-500">Not enough rating data yet</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/90 bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Weekday Profit Heatmap</CardTitle>
          <CardDescription>Higher bars indicate stronger total profit by weekday.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {analytics.weekdayPerformance.map((item) => {
            const width = `${(item.totalProfit / maxDayProfit) * 100}%`;
            return (
              <div key={item.weekday} className="grid grid-cols-[56px_1fr_88px] items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">{item.weekday}</span>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width }} />
                </div>
                <span className="text-right text-xs font-semibold text-slate-700">
                  ${item.totalProfit.toFixed(2)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {analytics.routePerformance.length > 0 && (
        <Card className="border-slate-200/90 bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top Route Corridors</CardTitle>
            <CardDescription>Routes ranked by total profit contribution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.routePerformance.map((route) => (
              <div
                key={route.route}
                className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-900 font-medium">
                    <Route className="h-4 w-4 text-slate-500" />
                    {route.route}
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800">
                    ${route.totalProfit.toFixed(2)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {route.jobs} jobs | Avg ${route.averageProfit.toFixed(2)} / job | Avg load {route.averageQuantityKg.toFixed(0)} kg
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {analytics.insights.length > 0 && (
        <Card className="border-slate-200/90 bg-slate-50/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">AI-style Insights</CardTitle>
            <CardDescription>Automatically generated from your recent performance data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics.insights.map((insight) => (
              <p key={insight} className="text-sm text-slate-700">- {insight}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
