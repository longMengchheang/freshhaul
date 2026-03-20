'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ProgressItem = {
  label: string;
  complete: boolean;
};

export default function FormProgressCard({
  title,
  items,
}: {
  title: string;
  items: ProgressItem[];
}) {
  const total = items.length;
  const completed = items.filter((item) => item.complete).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const nextMissing = items.find((item) => !item.complete)?.label ?? null;

  return (
    <Card className="border-slate-200/90 bg-white/95">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">{completed}/{total} complete</p>
          <Badge variant="outline" className={percent === 100 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'}>
            {percent}%
          </Badge>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-700 transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-sm text-slate-600">
          {nextMissing ? `Next: ${nextMissing}` : 'Ready to submit.'}
        </p>
      </CardContent>
    </Card>
  );
}

