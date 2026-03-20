'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, PackageSearch, Truck } from 'lucide-react';
import { getDealDetail, getMyDeals, updateDealStatus } from '@/app/actions/deals';
import { useAuth } from '@/components/AuthProvider';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import DealLifecycleTimeline from '@/components/DealLifecycleTimeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { StatusBadge } from '@/components/StatusBadge';
import { ACTION_LINK_SECONDARY } from '@/lib/client/action-classes';
import { cn } from '@/lib/utils';
import { clearSessionCache, readSessionCache, writeSessionCache } from '@/lib/client/session-cache';
import { getRiskTone, STATUS_TONES } from '@/lib/client/status-tones';
import { UI_CACHE_TTL_MS, UI_PAGE_SIZE } from '@/lib/client/ui-config';
import { getCountryName } from '@/lib/locations';
import { getTransportRisk } from '@/lib/transport-intelligence';
import type { DealWithDetails } from '@/types/app';

function getTransportBadgeText(deal: DealWithDetails) {
  if (deal.matches[0]) {
    return 'Driver assigned';
  }

  if (deal.status === 'transport_pending') {
    return 'Waiting for driver';
  }

  if (deal.status === 'in_transit') {
    return 'In delivery';
  }

  if (deal.status === 'completed') {
    return 'Delivery completed';
  }

  return 'Transport not started';
}

function getTransportStrip(deal: DealWithDetails) {
  const hasAssignedDriver = Boolean(deal.matches[0]);
  const queuedDispatchCount = (deal.dispatchJobs ?? []).filter((job) =>
    ['queued', 'seen'].includes(job.status),
  ).length;
  const dispatchAttemptCount = (deal.dispatchLogs ?? []).filter((log) => log.event_type === 'deal_queued').length;

  if (deal.status === 'completed') {
    return {
      label: 'Delivered',
      tone: STATUS_TONES.success,
    };
  }

  if (deal.status === 'in_transit') {
    return {
      label: 'On the way',
      tone: STATUS_TONES.info,
    };
  }

  if (hasAssignedDriver) {
    return {
      label: 'Driver assigned',
      tone: 'border-violet-200 bg-violet-50 text-violet-800',
    };
  }

  if (queuedDispatchCount > 0) {
    return {
      label: `Waiting driver (${queuedDispatchCount} notified, attempt ${Math.max(1, dispatchAttemptCount)})`,
      tone: STATUS_TONES.warning,
    };
  }

  return {
    label: dispatchAttemptCount > 0 ? `Waiting driver (attempt ${dispatchAttemptCount})` : 'Waiting driver',
    tone: STATUS_TONES.neutral,
  };
}

export default function DealsPage() {
  const { user, loading: authLoading } = useAuth();
  const [deals, setDeals] = useState<DealWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusUpdatingDealId, setStatusUpdatingDealId] = useState<string | null>(null);
  const [detailLoadingDealId, setDetailLoadingDealId] = useState<string | null>(null);
  const [expandedDealIds, setExpandedDealIds] = useState<Record<string, boolean>>({});
  const [dealDetailsById, setDealDetailsById] = useState<Record<string, DealWithDetails>>({});
  const [statusError, setStatusError] = useState('');
  const [statusSuccess, setStatusSuccess] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'pending' | 'transport_pending' | 'in_transit' | 'completed' | 'rejected' | 'cancelled'>('all');
  const [visibleDealCount, setVisibleDealCount] = useState<number>(UI_PAGE_SIZE.deals);
  const submitLockRef = useRef(false);
  const cacheKey = 'freshhaul:deals:snapshot:v1';

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    const cachedDeals = readSessionCache<DealWithDetails[]>(cacheKey, UI_CACHE_TTL_MS.medium);
    if (cachedDeals && cachedDeals.length > 0) {
      setDeals(cachedDeals);
      setLoading(false);
    }

    async function loadDeals() {
      const result = await getMyDeals();
      if (!active) return;
      if (result.success) {
        const rows = result.data as DealWithDetails[];
        setDeals(rows);
        writeSessionCache(cacheKey, rows);
        setLoadError('');
      } else {
        setLoadError(result.error ?? 'Could not load deals right now.');
      }
      setLoading(false);
    }

    void loadDeals();
    return () => { active = false; };
  }, [authLoading]);

  const refreshDeals = async () => {
    setLoadError('');
    const refreshed = await getMyDeals();
    if (refreshed.success) {
      const rows = refreshed.data as DealWithDetails[];
      setDeals(rows);
      writeSessionCache(cacheKey, rows);
      return;
    }
    setLoadError(refreshed.error ?? 'Could not refresh deals.');
  };

  useEffect(() => {
    setVisibleDealCount(UI_PAGE_SIZE.deals);
  }, [deals.length, activeStatusFilter]);

  const filteredDeals = useMemo(() => {
    if (activeStatusFilter === 'all') {
      return deals;
    }
    return deals.filter((deal) => deal.status === activeStatusFilter);
  }, [deals, activeStatusFilter]);

  const metrics = useMemo(() => {
    const pendingAction = deals.filter((deal) => deal.status === 'pending').length;
    const dispatching = deals.filter((deal) => deal.status === 'transport_pending').length;
    const inTransit = deals.filter((deal) => deal.status === 'in_transit').length;
    const completed = deals.filter((deal) => deal.status === 'completed').length;

    return {
      pendingAction,
      dispatching,
      inTransit,
      completed,
    };
  }, [deals]);

  const handleStatus = async (dealId: string, status: 'accepted' | 'rejected' | 'completed' | 'cancelled') => {
    if (statusUpdatingDealId || submitLockRef.current) return;

    submitLockRef.current = true;
    setStatusUpdatingDealId(dealId);
    setStatusError('');
    setStatusSuccess('');

    try {
      const result = await updateDealStatus(dealId, status);
      if (!result.success) {
        setStatusError(result.error ?? 'Could not update this deal status.');
        return;
      }

      if (result.data?.noChange) {
        setStatusSuccess('Deal is already in the latest status.');
      } else {
        setStatusSuccess('Deal status updated successfully.');
      }
      clearSessionCache(cacheKey);
      await refreshDeals();
    } finally {
      setStatusUpdatingDealId(null);
      submitLockRef.current = false;
    }
  };

  const handleToggleDetails = async (dealId: string) => {
    if (expandedDealIds[dealId]) {
      setExpandedDealIds((previous) => ({ ...previous, [dealId]: false }));
      return;
    }

    setExpandedDealIds((previous) => ({ ...previous, [dealId]: true }));
    if (dealDetailsById[dealId] || detailLoadingDealId) {
      return;
    }

    setDetailLoadingDealId(dealId);
    try {
      const result = await getDealDetail(dealId);
      if (result.success && result.data) {
        setDealDetailsById((previous) => ({ ...previous, [dealId]: result.data as DealWithDetails }));
      } else {
        setStatusError(result.error ?? 'Could not load full deal details.');
      }
    } finally {
      setDetailLoadingDealId(null);
    }
  };

  if (authLoading || loading) {
    return <div className="page-shell"><div className="h-104 rounded-3xl border border-slate-200 bg-white animate-pulse" /></div>;
  }

  const currentUserId = user?.id ?? null;

  return (
    <div className="page-shell space-y-7 py-8">
      <section className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Deal workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Your deals</h1>
        <p className="text-sm text-slate-500">Review status, take action, and coordinate transport.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-tile">
          <div className="flex items-center gap-2 text-slate-500">
            <PackageSearch className="h-4 w-4" />
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em]">Pending</p>
          </div>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{metrics.pendingAction}</p>
        </div>
        <div className="stat-tile">
          <div className="flex items-center gap-2 text-slate-500">
            <Clock3 className="h-4 w-4" />
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em]">Dispatching</p>
          </div>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{metrics.dispatching}</p>
        </div>
        <div className="stat-tile">
          <div className="flex items-center gap-2 text-slate-500">
            <Truck className="h-4 w-4" />
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em]">In transit</p>
          </div>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{metrics.inTransit}</p>
        </div>
        <div className="stat-tile">
          <div className="flex items-center gap-2 text-slate-500">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em]">Completed</p>
          </div>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{metrics.completed}</p>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: `All (${deals.length})` },
          { key: 'pending', label: `Pending (${metrics.pendingAction})` },
          { key: 'transport_pending', label: `Dispatching (${metrics.dispatching})` },
          { key: 'in_transit', label: `In transit (${metrics.inTransit})` },
          { key: 'completed', label: `Completed (${metrics.completed})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveStatusFilter(item.key as typeof activeStatusFilter)}
            className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-all duration-150 ${
              activeStatusFilter === item.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
            style={activeStatusFilter === item.key ? { boxShadow: 'var(--shadow-sm)' } : { boxShadow: 'var(--shadow-xs)' }}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="step-card">
          <div className="step-number">1</div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">Review status</h2>
          <p className="mt-1 text-sm text-slate-600">Check pending, in transit, or completed.</p>
        </div>
        <div className="step-card">
          <div className="step-number">2</div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">Take action</h2>
          <p className="mt-1 text-sm text-slate-600">Accept, reject, or coordinate transport.</p>
        </div>
        <div className="step-card">
          <div className="step-number">3</div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">Finish and close</h2>
          <p className="mt-1 text-sm text-slate-600">Mark completed after delivery.</p>
        </div>
      </section>

      <div className="space-y-4">
        {statusError ? (
          <Notice tone="danger">{statusError}</Notice>
        ) : null}
        {statusSuccess ? (
          <Notice tone="success">{statusSuccess}</Notice>
        ) : null}
        {loadError ? (
          <Notice
            tone="warning"
            action={<Button type="button" variant="outline" onClick={refreshDeals}>Retry</Button>}
          >
            {loadError}
          </Notice>
        ) : null}
        {filteredDeals.length === 0 ? (
          <Card className="premium-card overflow-hidden">
            <CardContent className="p-8 text-center text-lg text-slate-500">
              {activeStatusFilter === 'all'
                ? 'No deals yet. Start from Marketplace to create your first deal.'
                : 'No deals found for this status filter.'}
            </CardContent>
          </Card>
        ) : null}
        {filteredDeals.slice(0, visibleDealCount).map((deal) => (
          <Card key={deal.id} className="rounded-xl border border-slate-200/80 bg-white transition-all duration-200 hover:-translate-y-0.5" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <CardContent className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start">
              {(() => {
                const enrichedDeal = dealDetailsById[deal.id] ?? deal;
                const showFullDetails = Boolean(expandedDealIds[deal.id]);
                const isCommercialParticipant =
                  currentUserId === enrichedDeal.buyer_id ||
                  currentUserId === enrichedDeal.farmer_id;
                const isDriverParticipant = enrichedDeal.matches.some((match) => match.driver_id === currentUserId);
                const assignedDriver = enrichedDeal.matches[0]?.driver ?? null;
                const hasAssignedDriver = Boolean(enrichedDeal.matches[0]);
                const transportButtonLabel = hasAssignedDriver
                  ? (isDriverParticipant ? 'Open driver coordination' : 'Open transport coordination')
                  : 'Open commercial workspace';
                const transportRisk = getTransportRisk(enrichedDeal);

                return (
                  <div className="contents">
                    <div className="space-y-4">
                      {(() => {
                        const transportStrip = getTransportStrip(enrichedDeal);

                        return (
                          <div className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-[0_10px_20px_-18px_rgba(15,23,42,0.6)] ${transportStrip.tone}`}>
                            {transportStrip.label}
                          </div>
                        );
                      })()}
                      <DealLifecycleTimeline dealStatus={enrichedDeal.status} hasDriver={hasAssignedDriver} />

                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge tone="neutral">{enrichedDeal.status}</StatusBadge>
                        <StatusBadge tone={hasAssignedDriver ? 'success' : 'warning'}>
                          {getTransportBadgeText(enrichedDeal)}
                        </StatusBadge>
                        <StatusBadge
                          tone={transportRisk.label === 'High' ? 'error' : transportRisk.label === 'Medium' ? 'warning' : 'success'}
                          className={getRiskTone(transportRisk.label)}
                        >
                          Risk {transportRisk.label} ({transportRisk.score})
                        </StatusBadge>
                        <span className="text-sm text-slate-500">
                          {enrichedDeal.shipment.pickup_province}, {getCountryName(enrichedDeal.shipment.pickup_country_code)} to {enrichedDeal.demand.delivery_province}, {getCountryName(enrichedDeal.demand.delivery_country_code)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-[1.95rem] font-semibold tracking-tight text-slate-950">
                          {enrichedDeal.shipment.produce_type} | {Number(enrichedDeal.quantity_kg)} kg
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[1.02rem] text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            Buyer
                            {enrichedDeal.buyer?.avatar_url ? <img src={enrichedDeal.buyer.avatar_url} alt="" className="inline h-5 w-5 rounded-full object-cover" /> : null}
                            <Link href={`/users/${enrichedDeal.buyer_id}`} className="font-semibold text-slate-900 underline-offset-2 hover:underline">
                              {enrichedDeal.buyer?.name ?? 'Unknown'}
                            </Link>
                          </span>
                          <span>|</span>
                          <span className="inline-flex items-center gap-1.5">
                            Farmer
                            {enrichedDeal.farmer?.avatar_url ? <img src={enrichedDeal.farmer.avatar_url} alt="" className="inline h-5 w-5 rounded-full object-cover" /> : null}
                            <Link href={`/users/${enrichedDeal.farmer_id}`} className="font-semibold text-slate-900 underline-offset-2 hover:underline">
                              {enrichedDeal.farmer?.name ?? 'Unknown'}
                            </Link>
                          </span>
                          <span>| Agreed ${Number(enrichedDeal.agreed_price_usd).toFixed(2)}</span>
                        </div>
                      </div>

                      {showFullDetails ? (
                        <div className="grid gap-3 xl:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Commercial coordination</p>
                            <p className="mt-2 text-sm font-semibold text-slate-950">Buyer and farmer</p>
                            <p className="mt-1 text-sm text-slate-600">
                              Use the deal workspace for pricing, approval, and produce handoff details.
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Transport coordination</p>
                            {assignedDriver ? (
                              <>
                                <p className="mt-2 text-sm font-semibold text-slate-950">
                                  Farmer and {assignedDriver.name}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  Driver assigned. Open the transport workspace to coordinate pickup, route timing, and delivery status.
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="mt-2 text-sm font-semibold text-slate-950">Waiting for driver assignment</p>
                                <p className="mt-1 text-sm text-slate-600">
                                  Driver chat appears here after a verified driver claims the route from the trip board.
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2.5 xl:sticky xl:top-24">
                      {showFullDetails ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4">
                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Assigned driver</p>
                          {assignedDriver ? (
                            <>
                              <p className="mt-2 font-semibold text-slate-950">{assignedDriver.name}</p>
                              <p className="mt-1 text-sm text-slate-600">{assignedDriver.phone}</p>
                              <p className="mt-1 text-sm text-slate-600">{assignedDriver.province}</p>
                            </>
                          ) : (
                            <>
                              <p className="mt-2 font-semibold text-slate-950">No driver yet</p>
                              <p className="mt-1 text-sm text-slate-600">
                                The farmer-driver conversation appears after a driver claims this route.
                              </p>
                            </>
                          )}
                        </div>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleDetails(deal.id)}
                          disabled={detailLoadingDealId === deal.id}
                          className="h-10 rounded-xl text-sm"
                        >
                          {detailLoadingDealId === deal.id
                            ? 'Loading details...'
                            : showFullDetails
                              ? 'Hide details'
                              : 'Show details'}
                        </Button>
                        <Link href={`/trip/${deal.id}`} className={cn(ACTION_LINK_SECONDARY, 'h-10 rounded-xl text-sm font-semibold', 'flex justify-center')}>
                          {transportButtonLabel}
                        </Link>
                        {!hasAssignedDriver && enrichedDeal.status === 'transport_pending' && (
                          <Link href="/browse-trips" className={cn(ACTION_LINK_SECONDARY, 'h-10 rounded-xl text-sm font-semibold', 'flex justify-center')}>
                            Open trip board
                          </Link>
                        )}
                      </div>
                      {isCommercialParticipant && enrichedDeal.status === 'pending' && (
                        <>
                          <ConfirmDialog
                            title="Accept this deal?"
                            description="This will move the deal to transport pending and trigger driver dispatch. This action cannot be undone."
                            confirmLabel="Accept deal"
                            onConfirm={() => handleStatus(deal.id, 'accepted')}
                            disabled={Boolean(statusUpdatingDealId)}
                            trigger={
                              <Button
                                size="sm" className="h-10 w-full rounded-xl font-semibold shadow-md"
                                disabled={Boolean(statusUpdatingDealId)}
                              >
                                {statusUpdatingDealId === deal.id ? 'Updating...' : 'Accept deal'}
                              </Button>
                            }
                          />
                          <ConfirmDialog
                            title="Reject this deal?"
                            description="The demand and shipment will return to open status. This action cannot be undone."
                            confirmLabel="Reject deal"
                            variant="destructive"
                            onConfirm={() => handleStatus(deal.id, 'rejected')}
                            disabled={Boolean(statusUpdatingDealId)}
                            trigger={
                              <Button
                                size="sm" className="h-10 w-full rounded-xl font-semibold shadow-sm"
                                variant="destructive"
                                disabled={Boolean(statusUpdatingDealId)}
                              >
                                {statusUpdatingDealId === deal.id ? 'Updating...' : 'Reject deal'}
                              </Button>
                            }
                          />
                        </>
                      )}
                      {isCommercialParticipant && enrichedDeal.status === 'in_transit' && (
                        <ConfirmDialog
                          title="Mark this deal as completed?"
                          description="Only confirm once the produce has been physically delivered. This closes the deal permanently."
                          confirmLabel="Mark completed"
                          onConfirm={() => handleStatus(deal.id, 'completed')}
                          disabled={Boolean(statusUpdatingDealId)}
                          trigger={
                            <Button
                              size="sm" className="h-10 w-full rounded-xl font-semibold shadow-md"
                              disabled={Boolean(statusUpdatingDealId)}
                            >
                              {statusUpdatingDealId === deal.id ? 'Updating...' : 'Mark completed'}
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        ))}
        {filteredDeals.length > visibleDealCount ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setVisibleDealCount((previous) => previous + UI_PAGE_SIZE.deals)}
          >
            Show more deals
          </Button>
        ) : null}
      </div>
    </div>
  );
}

