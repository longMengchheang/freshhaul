import * as React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_TONES, type StatusTone } from '@/lib/client/status-tones';

type NoticeProps = {
  tone?: StatusTone;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Notice({ tone = 'neutral', action, className, children }: NoticeProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-base leading-7', STATUS_TONES[tone], className)}>
      <div>{children}</div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
