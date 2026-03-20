'use client';

import { TrendingUp, DollarSign, Fuel, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EarningsRecord, EarningsSummary, EarningsTrend } from '@/lib/server/driver-earnings';

interface DriverEarningsDashboardProps {
  earnings: EarningsRecord[];
  summary: EarningsSummary;
  trends: EarningsTrend[];
}

export function DriverEarningsDashboard({
  earnings,
  summary,
  trends,
}: DriverEarningsDashboardProps) {
  const expandedEarnings = earnings.map((record) => ({
    ...record,
    jobProfit: record.netProfitUsd,
  }));

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Earnings */}
        <Card className="border-slate-200/90 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Commission Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-950">
              ${summary.totalEarnings.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-slate-500">{summary.completedJobs} completed jobs</p>
          </CardContent>
        </Card>

        {/* Gas Costs */}
        <Card className="border-slate-200/90 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Fuel className="h-4 w-4 text-amber-600" />
              Est. Fuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-950">
              -${summary.estimatedGasCosts.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Avg ${(summary.estimatedGasCosts / Math.max(1, summary.completedJobs)).toFixed(2)}/job</p>
          </CardContent>
        </Card>

        {/* Wear Costs */}
        <Card className="border-slate-200/90 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Wrench className="h-4 w-4 text-orange-600" />
              Est. Wear
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-950">
              -${summary.estimatedWearCosts.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Maintenance & depreciation</p>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-slate-200/90 bg-gradient-to-br from-slate-50 to-emerald-50 ring-1 ring-emerald-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Your Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">
              ${summary.netProfit.toFixed(2)}
            </div>
            <p className="mt-1 text-xs text-emerald-700">
              ${(summary.netProfit / Math.max(1, summary.completedJobs)).toFixed(2)}/job
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Breakdown Card */}
      {expandedEarnings.length > 0 && (
        <Card className="border-slate-200/90 bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Deliveries</CardTitle>
            <CardDescription>Click any row to see detailed breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80">
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Produce</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Route</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Quantity</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Commission</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Gas</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">Wear</th>
                    <th className="px-4 py-2 text-right font-medium text-emerald-700">Your Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedEarnings.map((record) => {
                    const commissionEarned =
                      Number(record.agreedPriceUsd) *
                      (Number(record.commissionPercent) / 100);
                    return (
                      <tr
                        key={record.dealId}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {record.produceType}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {record.pickupProvince} → {record.deliveryProvince}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {Number(record.quantityKg).toFixed(0)} kg
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                          ${commissionEarned.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-amber-700">
                          -${record.estimatedGasUsd.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-700">
                          -${record.estimatedWearUsd.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-900 bg-emerald-50/50">
                          ${record.jobProfit.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produce Type Trends */}
      {trends.length > 0 && (
        <Card className="border-slate-200/90 bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Your Best Produce Types</CardTitle>
            <CardDescription>Average profit per job, sorted by top earner</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trends.map((trend) => (
                <div
                  key={trend.produceType}
                  className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/50 p-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{trend.produceType}</p>
                    <p className="text-xs text-slate-500">
                      {trend.jobCount} job{trend.jobCount !== 1 ? 's' : ''} | Avg profit: $
                      {trend.averageProfitPerJob.toFixed(2)}/job
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className="mr-2 bg-emerald-100 text-emerald-800">
                      ${trend.totalProfit.toFixed(2)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {expandedEarnings.length === 0 && (
        <Card className="border-dashed border-slate-300/80 bg-slate-50/50">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-slate-600">
              No completed deliveries yet. Start claiming jobs to see your earnings here!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
