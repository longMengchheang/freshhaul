'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  Loader2,
  ShieldAlert,
  Sparkles,
  Workflow,
} from 'lucide-react';
import {
  applyOrderTransition,
  executeOrderPlaybook,
  getOrderCommandCenterSnapshot,
} from '@/app/actions/orders';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { EnrichedOrder, OrderCommandCenterSnapshot, OrderRoleMode } from '@/types/orders';

const ROLE_OPTIONS: Array<{ value: OrderRoleMode; label: string }> = [
  { value: 'ops', label: 'All' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Farmer' },
  { value: 'driver', label: 'Driver' },
];

function riskClass(riskBand: EnrichedOrder['riskBand']) {
  if (riskBand === 'High') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (riskBand === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function riskValue(order: EnrichedOrder) {
  if (order.riskBand === 'High') return 3;
  if (order.riskBand === 'Medium') return 2;
  return 1;
}

export default function OrdersPage() {
  const [roleMode, setRoleMode] = useState<OrderRoleMode>('ops');
  const [snapshot, setSnapshot] = useState<OrderCommandCenterSnapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<'playbook' | 'transition' | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshSnapshot = useCallback((targetMode: OrderRoleMode) => {
    startTransition(async () => {
      setError('');
      setMessage('');
      const result = await getOrderCommandCenterSnapshot({ mode: targetMode });
      if (!result.success || !result.data) {
        setSnapshot(null);
        setError(result.error ?? 'Could not load orders right now.');
        return;
      }
      setSnapshot(result.data);
    });
  }, [startTransition]);

  useEffect(() => {
    refreshSnapshot(roleMode);
  }, [roleMode, refreshSnapshot]);

  const summary = useMemo(() => snapshot?.summary, [snapshot]);
  const filteredOrders = useMemo(() => {
    const rows = snapshot?.orders ?? [];
    const byRisk = riskFilter === 'all' ? rows : rows.filter((order) => order.riskBand === riskFilter);
    return [...byRisk].sort((a, b) => {
      if (riskValue(b) !== riskValue(a)) {
        return riskValue(b) - riskValue(a);
      }
      return b.riskScore - a.riskScore;
    });
  }, [snapshot, riskFilter]);

  const topOrder = filteredOrders[0] ?? null;

  async function handlePlaybook(dealId: string, playbookId: Parameters<typeof executeOrderPlaybook>[0]['playbookId']) {
    setActiveDealId(dealId);
    setActiveAction('playbook');
    setError('');
    setMessage('');

    const result = await executeOrderPlaybook({ dealId, playbookId });
    if (!result.success) {
      setError(result.error ?? 'Unable to execute playbook.');
      setActiveDealId(null);
      setActiveAction(null);
      return;
    }

    setMessage('Playbook executed. Command view refreshed.');
    setActiveDealId(null);
    setActiveAction(null);
    refreshSnapshot(roleMode);
  }

  async function handleTransition(
    dealId: string,
    status: Parameters<typeof applyOrderTransition>[0]['status'],
  ) {
    setActiveDealId(dealId);
    setActiveAction('transition');
    setError('');
    setMessage('');

    const result = await applyOrderTransition({ dealId, status });
    if (!result.success) {
      setError(result.error ?? 'Unable to update order status.');
      setActiveDealId(null);
      setActiveAction(null);
      return;
    }

    setMessage(`Order moved to ${status.replace('_', ' ')}.`);
    setActiveDealId(null);
    setActiveAction(null);
    refreshSnapshot(roleMode);
  }

  return (
    <main className="page-shell space-y-7 py-8">
      <section className="premium-surface relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="hero-orb h-44 w-44 bg-emerald-300" style={{ left: '-72px', top: '-48px' }} />
        <div className="hero-orb h-36 w-36 bg-amber-300 [animation-delay:900ms]" style={{ right: '-58px', top: '14px' }} />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Order Command Center</p>
            <h1 className="display-title text-3xl font-bold text-slate-950 sm:text-4xl">Control Tower For Deal Execution</h1>
            <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
              Prioritize risk, run automated playbooks, and move orders through execution with less friction.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 p-1 shadow-sm">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setRoleMode(role.value)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                  roleMode === role.value
                    ? 'bg-slate-950 text-white shadow-[0_10px_20px_-14px_rgba(15,23,42,0.8)]'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        {summary ? (
          <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="premium-card p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Total Orders</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.total}</p>
            </div>
            <div className="premium-card p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-500">High Risk</p>
              <p className="mt-1 text-2xl font-semibold text-rose-700">{summary.highRisk}</p>
            </div>
            <div className="premium-card p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Release Ready</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{summary.releaseReady}</p>
            </div>
            <div className="premium-card p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Average Health</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.avgHealth}%</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="premium-surface rounded-2xl px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-slate-500">View Filter</p>
          <div className="mt-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <Select value={riskFilter} onValueChange={(value) => setRiskFilter(value as typeof riskFilter)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Risk filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All risk bands</SelectItem>
                <SelectItem value="High">High only</SelectItem>
                <SelectItem value="Medium">Medium only</SelectItem>
                <SelectItem value="Low">Low only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="premium-surface rounded-2xl px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-slate-500">Current Priority</p>
          {topOrder ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {topOrder.deal.shipment.produce_type} • {topOrder.deal.id.slice(0, 8)}
                </p>
                <p className="text-xs text-slate-600">Health {topOrder.healthScore}% • Risk {topOrder.riskBand}</p>
              </div>
              <Gauge className="h-5 w-5 text-slate-500" />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No orders in this filter.</p>
          )}
        </div>
      </section>

      {error ? (
        <Notice tone="warning">{error}</Notice>
      ) : null}
      {message ? (
        <Notice tone="success">{message}</Notice>
      ) : null}

      {isPending ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading orders...
          </div>
        </section>
      ) : null}

      {!isPending && snapshot && filteredOrders.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-700">No active orders in this view.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/marketplace">
              <Button type="button" variant="outline">Open market</Button>
            </Link>
            <Link href="/deals">
              <Button type="button" variant="outline">Open deals</Button>
            </Link>
          </div>
        </section>
      ) : null}

      {!isPending && snapshot && filteredOrders.length > 0 ? (
        <section className="grid gap-4">
          {filteredOrders.map((order) => (
            <article key={order.deal.id} className="premium-card overflow-hidden p-5 reveal-up">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Deal {order.deal.id.slice(0, 8)}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">
                    {order.deal.shipment.produce_type} | {Number(order.deal.quantity_kg).toLocaleString()} kg
                  </h2>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskClass(order.riskBand)}`}>
                  Risk {order.riskBand} ({order.riskScore})
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" /> Health {order.healthScore}%</span>
                <span className="inline-flex items-center gap-1">
                  {order.paymentReleaseReady ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  {order.paymentReleaseReady ? 'Settlement ready' : 'Settlement blocked'}
                </span>
                <span className="inline-flex items-center gap-1"><Workflow className="h-4 w-4" /> {order.deal.status.replace('_', ' ')}</span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Execution Intel</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {order.assignmentRationale.slice(0, 2).map((line) => (
                      <p key={line} className="text-xs text-slate-600">{line}</p>
                    ))}
                    {order.exceptionSummary.length > 0 ? (
                      <p className="text-xs font-medium text-rose-700">{order.exceptionSummary[0]}</p>
                    ) : (
                      <p className="text-xs font-medium text-emerald-700">No active exceptions.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (!value) return;
                      void handleTransition(order.deal.id, value as Parameters<typeof applyOrderTransition>[0]['status']);
                    }}
                  >
                    <SelectTrigger className="h-9 w-56 rounded-full bg-white">
                      <SelectValue placeholder="Change status" />
                    </SelectTrigger>
                    <SelectContent>
                      {order.transitions
                        .filter((transition) => !transition.blockedReason)
                        .map((transition) => (
                          <SelectItem key={`${order.deal.id}-${transition.status}`} value={transition.status}>
                            {transition.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {order.playbooks.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.playbooks.slice(0, 3).map((playbook) => (
                    <Button
                      key={playbook.id}
                      type="button"
                      size="sm"
                      variant={playbook.urgency === 'high' ? 'default' : 'outline'}
                      onClick={() => void handlePlaybook(order.deal.id, playbook.id)}
                      disabled={activeDealId === order.deal.id && activeAction !== null}
                      className={cn(playbook.urgency === 'high' ? '' : 'bg-white')}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {playbook.ctaLabel}
                    </Button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/deals">
                  <Button type="button" variant="outline">Open deal workspace</Button>
                </Link>
                <Link href="/browse-trips">
                  <Button type="button" variant="outline">
                    Open driver board
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

