import type { RiskLabel } from '@/lib/transport-intelligence';

export const STATUS_TONES = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export function getRiskTone(risk: RiskLabel) {
  if (risk === 'High') return STATUS_TONES.danger;
  if (risk === 'Medium') return STATUS_TONES.warning;
  return STATUS_TONES.success;
}
