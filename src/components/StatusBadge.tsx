import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusBadgeTone = 'success' | 'warning' | 'info' | 'neutral' | 'error';

const STATUS_BADGE_TONE_CLASSES: Record<StatusBadgeTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function statusToTone(status: string): StatusBadgeTone {
  const value = status.trim().toLowerCase();

  if (['completed', 'delivered', 'active', 'accepted', 'fulfilled', 'resolved'].includes(value)) {
    return 'success';
  }

  if (['pending', 'transport_pending', 'queued', 'under_review'].includes(value)) {
    return 'warning';
  }

  if (['in_transit', 'matched', 'processing'].includes(value)) {
    return 'info';
  }

  if (['cancelled', 'rejected', 'failed'].includes(value)) {
    return 'error';
  }

  return 'neutral';
}

export function StatusBadge({
  tone,
  className,
  children,
}: {
  tone: StatusBadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge variant="outline" className={cn(STATUS_BADGE_TONE_CLASSES[tone], className)}>
      {children}
    </Badge>
  );
}
