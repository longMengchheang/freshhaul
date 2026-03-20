'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Scale, Search, X } from 'lucide-react';
import { getMarketplaceSnapshot } from '@/app/actions/deals';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Input } from '@/components/ui/input';
import { buildDemandInsights, getOfferDecisionSignal } from '@/lib/marketplace-intelligence';
import type { DemandWithBuyer, ShipmentWithFarmer } from '@/types/app';

type CollectionsMode = 'explore' | 'deals';
type ExploreView = 'offers' | 'demands';
type SortMode = 'smart' | 'volume' | 'deadline' | 'price';

interface MarketplaceCollectionsPageProps {
  mode: CollectionsMode;
}

function MediaTile({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) return <div className="h-full w-full bg-linear-to-br from-emerald-100 via-emerald-50 to-orange-100" />;
  return <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />;
}

function formatDeadline(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function urgencyTone(deadline: string | Date) {
  const hours = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours <= 24) return { label: 'Urgent', className: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (hours <= 72) return { label: 'Soon', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Open', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

function getValueBreakdownHint(breakdown: {
  confidenceWeight: number;
  quantityWeight: number;
  demandPressureWeight: number;
  urgencyWeight: number;
  urgencyBoostWeight: number;
}) {
  return [
    `Confidence ${Math.round(breakdown.confidenceWeight * 100)}%`,
    `Supply volume ${Math.round(breakdown.quantityWeight * 100)}%`,
    `Demand pressure ${Math.round(breakdown.demandPressureWeight * 100)}%`,
    `Urgency ${Math.round(breakdown.urgencyWeight * 100)}%`,
    `Urgency bonus +${Math.round(breakdown.urgencyBoostWeight * 100)}%`,
  ].join(' | ');
}

export default function MarketplaceCollectionsPage({ mode }: MarketplaceCollectionsPageProps) {
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialView = searchParams.get('view') === 'demands' ? 'demands' : 'offers';
  const initialSort = searchParams.get('sort') === 'volume' || searchParams.get('sort') === 'deadline' || searchParams.get('sort') === 'price' ? (searchParams.get('sort') as SortMode) : 'smart';
  const initialSearch = searchParams.get('q') ?? '';

  const [view, setView] = useState<ExploreView>(initialView);
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [openDemands, setOpenDemands] = useState<DemandWithBuyer[]>([]);
  const [openShipments, setOpenShipments] = useState<ShipmentWithFarmer[]>([]);
  const [compareOfferIds, setCompareOfferIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (view === 'demands') next.set('view', 'demands');
    else next.set('view', 'offers');
    if (sortMode !== 'smart') next.set('sort', sortMode);
    else next.delete('sort');
    const trimmed = searchQuery.trim();
    if (trimmed.length > 0) next.set('q', trimmed);
    else next.delete('q');

    const target = next.toString();
    const current = searchParams.toString();
    if (target === current) return;
    router.replace(`${pathname}?${target}`, { scroll: false });
  }, [view, sortMode, searchQuery, pathname, router, searchParams]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    async function load() {
      setLoading(true);
      const snapshot = await getMarketplaceSnapshot();
      if (!active) return;
      if (snapshot.success && snapshot.data) {
        setOpenDemands(snapshot.data.openDemands);
        setOpenShipments(snapshot.data.openShipments);
        setLoadError('');
      } else if (!snapshot.success) {
        setLoadError(snapshot.error ?? 'Could not load marketplace.');
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [authLoading]);

  const query = searchQuery.trim().toLowerCase();
  const filteredOffers = useMemo(() => openShipments.filter((offer) => {
    if (!query) return true;
    return `${offer.produce_type} ${offer.pickup_province} ${offer.farmer?.name ?? ''}`.toLowerCase().includes(query);
  }), [openShipments, query]);
  const filteredDemands = useMemo(() => openDemands.filter((demand) => {
    if (!query) return true;
    return `${demand.produce_type} ${demand.delivery_province} ${demand.buyer?.name ?? ''}`.toLowerCase().includes(query);
  }), [openDemands, query]);

  const demandInsights = useMemo(() => buildDemandInsights(filteredDemands), [filteredDemands]);

  const offerDecisionRows = useMemo(() => {
    return filteredOffers.map((offer) => ({
      offer,
      signal: getOfferDecisionSignal(offer, demandInsights),
    }));
  }, [filteredOffers, demandInsights]);

  const offerDecisionLookup = useMemo(
    () => new Map(offerDecisionRows.map((row) => [row.offer.id, row])),
    [offerDecisionRows],
  );

  const sortedOffers = useMemo(() => {
    const rows = [...offerDecisionRows];
    if (sortMode === 'deadline') {
      rows.sort((a, b) => new Date(a.offer.deadline).getTime() - new Date(b.offer.deadline).getTime());
    } else if (sortMode === 'volume') {
      rows.sort((a, b) => Number(b.offer.quantity_kg) - Number(a.offer.quantity_kg));
    } else if (sortMode === 'price') {
      rows.sort((a, b) => b.signal.demandPriceBenchmark - a.signal.demandPriceBenchmark);
    } else {
      rows.sort((a, b) => {
        if (b.signal.valueScore !== a.signal.valueScore) {
          return b.signal.valueScore - a.signal.valueScore;
        }
        if (b.signal.demandMatchCount !== a.signal.demandMatchCount) {
          return b.signal.demandMatchCount - a.signal.demandMatchCount;
        }
        return new Date(a.offer.deadline).getTime() - new Date(b.offer.deadline).getTime();
      });
    }
    return rows;
  }, [offerDecisionRows, sortMode]);

  const sortedDemands = useMemo(() => {
    const rows = [...filteredDemands];
    if (sortMode === 'deadline') rows.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    else if (sortMode === 'volume') rows.sort((a, b) => Number(b.quantity_kg) - Number(a.quantity_kg));
    else rows.sort((a, b) => Number(b.max_price_usd) - Number(a.max_price_usd));
    return rows;
  }, [filteredDemands, sortMode]);

  const discountOffers = useMemo(() => {
    return sortedOffers.map((row, index) => {
      const benchmark = row.signal.demandPriceBenchmark > 0 ? row.signal.demandPriceBenchmark : 120 + index * 10;
      const baseBoost = row.signal.valueScore >= 90 ? 22 : row.signal.valueScore >= 80 ? 18 : 14;
      const urgencyBoost = row.signal.demandMatchCount > 2 ? 2 : 0;
      const discountPercent = Math.min(28, baseBoost + urgencyBoost);
      return {
        ...row.offer,
        discountPercent,
        originalPriceUsd: Number(benchmark.toFixed(2)),
        salePriceUsd: Number((benchmark * (1 - discountPercent / 100)).toFixed(2)),
        valueScore: row.signal.valueScore,
        confidenceScore: row.signal.confidenceScore,
        demandMatchCount: row.signal.demandMatchCount,
        fitReason: row.signal.fitReason,
        valueBreakdown: row.signal.valueBreakdown,
      };
    }).sort((a, b) => b.valueScore - a.valueScore);
  }, [sortedOffers]);

  const offerLeaders = useMemo(() => {
    if (sortedOffers.length === 0) return null;
    return {
      bestValue: Math.max(...sortedOffers.map((row) => row.signal.valueScore)),
      bestConfidence: Math.max(...sortedOffers.map((row) => row.signal.confidenceScore)),
      bestDemandMatch: Math.max(...sortedOffers.map((row) => row.signal.demandMatchCount)),
      bestBenchmark: Math.max(...sortedOffers.map((row) => row.signal.demandPriceBenchmark)),
    };
  }, [sortedOffers]);

  const dealLeaders = useMemo(() => {
    if (discountOffers.length === 0) return null;
    return {
      bestValue: Math.max(...discountOffers.map((offer) => offer.valueScore)),
      bestConfidence: Math.max(...discountOffers.map((offer) => offer.confidenceScore)),
      bestDemandMatch: Math.max(...discountOffers.map((offer) => offer.demandMatchCount)),
      bestBenchmark: Math.max(...discountOffers.map((offer) => offer.originalPriceUsd)),
    };
  }, [discountOffers]);

  const dealSummary = useMemo(() => {
    if (discountOffers.length === 0) return null;
    const highValueCount = discountOffers.filter((offer) => offer.valueScore >= 85).length;
    const strongDemandCount = discountOffers.filter((offer) => offer.demandMatchCount >= 2).length;
    const avgSalePrice = discountOffers.reduce((sum, offer) => sum + offer.salePriceUsd, 0) / discountOffers.length;
    return {
      highValueCount,
      strongDemandCount,
      avgSalePrice,
    };
  }, [discountOffers]);

  const comparedOffers = useMemo(() => {
    return compareOfferIds
      .map((id) => offerDecisionLookup.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [compareOfferIds, offerDecisionLookup]);

  const compareLeaders = useMemo(() => {
    if (comparedOffers.length === 0) return null;
    const bestQuantity = Math.max(...comparedOffers.map((row) => Number(row.offer.quantity_kg)));
    const bestConfidence = Math.max(...comparedOffers.map((row) => row.signal.confidenceScore));
    const bestValueScore = Math.max(...comparedOffers.map((row) => row.signal.valueScore));
    const bestDemandMatchCount = Math.max(...comparedOffers.map((row) => row.signal.demandMatchCount));
    const bestDemandBenchmark = Math.max(...comparedOffers.map((row) => row.signal.demandPriceBenchmark));
    const soonestDeadline = Math.min(...comparedOffers.map((row) => new Date(row.offer.deadline).getTime()));
    return {
      bestQuantity,
      bestConfidence,
      bestValueScore,
      bestDemandMatchCount,
      bestDemandBenchmark,
      soonestDeadline,
    };
  }, [comparedOffers]);

  const compareRankByOfferId = useMemo(() => {
    return new Map(
      [...comparedOffers]
        .sort((a, b) => {
          if (b.signal.valueScore !== a.signal.valueScore) {
            return b.signal.valueScore - a.signal.valueScore;
          }
          if (b.signal.confidenceScore !== a.signal.confidenceScore) {
            return b.signal.confidenceScore - a.signal.confidenceScore;
          }
          return b.signal.demandMatchCount - a.signal.demandMatchCount;
        })
        .map((row, index) => [row.offer.id, index + 1] as const),
    );
  }, [comparedOffers]);

  const toggleCompareOffer = (offerId: string) => {
    setCompareOfferIds((current) => {
      if (current.includes(offerId)) {
        return current.filter((id) => id !== offerId);
      }
      if (current.length >= 3) {
        return [...current.slice(1), offerId];
      }
      return [...current, offerId];
    });
  };

  const filterGridClassName = mode === 'deals'
    ? 'mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem]'
    : 'mt-6 grid gap-3 md:grid-cols-[1.2fr_0.7fr_auto]';

  if (authLoading || loading) {
    return (
      <div className="page-shell max-w-330! space-y-6">
        <div className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        <div className="h-120 animate-pulse rounded-3xl border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="page-shell max-w-330! space-y-6">
      {loadError ? <Notice tone="warning" action={<Button type="button" variant="outline" onClick={() => window.location.reload()}>Retry</Button>}>{loadError}</Notice> : null}

      {mode === 'deals' ? (
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Deals</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Discount-ranked offers</h2>
            <p className="text-sm text-slate-500">Compare savings, then jump to seller profiles.</p>
          </div>
          <Link href="/marketplace/explore?view=offers" className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900" style={{ boxShadow: 'var(--shadow-xs)' }}>
            Explore all offers
          </Link>
        </section>
      ) : null}

      <section className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{mode === 'deals' ? 'Marketplace deals' : 'Marketplace explore'}</h1>
            <p className="mt-1 text-sm text-slate-500">{mode === 'deals' ? 'All discount-ready offers in one place.' : 'Browse and filter the full marketplace.'}</p>
          </div>
          <Link href="/marketplace" className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900" style={{ boxShadow: 'var(--shadow-xs)' }}>Back to market</Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {[
            { href: '/marketplace', label: 'Home', active: pathname === '/marketplace' },
            { href: '/marketplace/explore?view=offers', label: 'Offers', active: mode === 'explore' && view === 'offers' },
            { href: '/marketplace/explore?view=demands', label: 'Demands', active: mode === 'explore' && view === 'demands' },
            { href: '/marketplace/deals', label: 'Deals', active: mode === 'deals' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-all duration-150 ${item.active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>{item.label}</Link>
          ))}
          <div className="mx-1.5 h-4 w-px bg-slate-200" />
          <Link href="/post-demand" className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100">Post demand</Link>
          <Link href="/post-shipment" className="inline-flex h-8 items-center rounded-md border border-sky-200 bg-sky-50 px-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100">Post shipment</Link>
        </div>

        <div className={filterGridClassName}>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search produce, province, or user" className="h-11 pl-9" />
          </label>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800">
            <option value="smart">Smart ranking</option>
            <option value="volume">Largest volume</option>
            <option value="deadline">Deadline soon</option>
            <option value="price">Highest price</option>
          </select>
          {mode === 'explore' ? (
            <div role="tablist" aria-label="Explore mode" className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button type="button" id="explore-tab-offers" role="tab" aria-controls="explore-tab-panel" aria-selected={view === 'offers'} onClick={() => setView('offers')} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${view === 'offers' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>Offers ({sortedOffers.length})</button>
              <button type="button" id="explore-tab-demands" role="tab" aria-controls="explore-tab-panel" aria-selected={view === 'demands'} onClick={() => setView('demands')} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${view === 'demands' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>Demands ({sortedDemands.length})</button>
            </div>
          ) : null}
        </div>

        {comparedOffers.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Offer compare ({comparedOffers.length}/3)</p>
              <button
                type="button"
                onClick={() => setCompareOfferIds([])}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" />
                Clear compare
              </button>
            </div>
            {compareLeaders ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[0.68rem]">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-semibold text-sky-800">
                  Top value: {compareLeaders.bestValueScore}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                  Top confidence: {compareLeaders.bestConfidence}%
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                  Max benchmark: ${compareLeaders.bestDemandBenchmark.toFixed(2)}
                </span>
              </div>
            ) : null}
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {comparedOffers.map((offer) => {
                const confidence = offer.signal.confidenceScore;
                const compareRank = compareRankByOfferId.get(offer.offer.id) ?? 1;
                const isBestQty = compareLeaders ? Number(offer.offer.quantity_kg) === compareLeaders.bestQuantity : false;
                const isBestConfidence = compareLeaders ? confidence === compareLeaders.bestConfidence : false;
                const isBestValue = compareLeaders ? offer.signal.valueScore === compareLeaders.bestValueScore : false;
                const isBestDemandMatch = compareLeaders ? offer.signal.demandMatchCount === compareLeaders.bestDemandMatchCount : false;
                const isBestBenchmark = compareLeaders ? offer.signal.demandPriceBenchmark === compareLeaders.bestDemandBenchmark : false;
                const isSoonest = compareLeaders ? new Date(offer.offer.deadline).getTime() === compareLeaders.soonestDeadline : false;
                return (
                  <div key={`compare-${offer.offer.id}`} className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm flex flex-col transition-all hover:shadow-md">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="text-base font-semibold text-slate-900 tracking-tight">{offer.offer.produce_type}</p>
                      <button
                        type="button"
                        onClick={() => toggleCompareOffer(offer.offer.id)}
                        className="inline-flex h-7 items-center rounded-md border border-slate-200/60 bg-slate-50 px-2.5 text-[0.65rem] font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                      <p className="flex items-center justify-between"><span>Seller</span><span className="flex items-center gap-1.5 font-medium text-slate-900">{offer.offer.farmer?.avatar_url ? <img src={offer.offer.farmer.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" /> : null}{offer.offer.farmer?.name ?? 'Unknown'}</span></p>
                      <p className="flex items-center justify-between"><span>Province</span><span className="font-medium text-slate-900">{offer.offer.pickup_province}</span></p>
                      <p className="flex items-center justify-between"><span>Qty</span><span className="font-medium text-slate-900">{Number(offer.offer.quantity_kg).toLocaleString()} kg</span></p>
                      <p className="flex items-center justify-between"><span>Confidence</span><span className="font-semibold text-emerald-700">{confidence}%</span></p>
                      <p className="flex items-center justify-between"><span>Value</span><span className="font-semibold text-slate-800">{offer.signal.valueScore}</span></p>
                      <p className="flex items-center justify-between"><span>Demand matches</span><span className="font-semibold text-amber-700">{offer.signal.demandMatchCount}</span></p>
                      <p className="flex items-center justify-between"><span>Demand benchmark</span><span className="font-semibold text-slate-900">${offer.signal.demandPriceBenchmark.toFixed(2)}</span></p>
                    </div>
                    <p className="mb-3 line-clamp-2 text-[0.7rem] leading-tight text-slate-500 pt-2 border-t border-slate-100">Best-fit reason: {offer.signal.fitReason}</p>
                    <details className="group rounded-lg border border-slate-200/60 bg-slate-50/50 px-3 py-2 cursor-pointer mb-3">
                      <summary className="list-none text-[0.7rem] font-medium text-slate-700 outline-none">
                        Why ranked #{compareRank}
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.65rem] text-slate-500 pt-2 border-t border-slate-200/50">
                        <span>Confidence</span>
                        <span className="text-right font-medium text-slate-700">{Math.round(offer.signal.valueBreakdown.confidenceWeight * 100)}%</span>
                        <span>Supply volume</span>
                        <span className="text-right font-medium text-slate-700">{Math.round(offer.signal.valueBreakdown.quantityWeight * 100)}%</span>
                        <span>Demand pressure</span>
                        <span className="text-right font-medium text-slate-700">{Math.round(offer.signal.valueBreakdown.demandPressureWeight * 100)}%</span>
                        <span>Urgency</span>
                        <span className="text-right font-medium text-slate-700">{Math.round(offer.signal.valueBreakdown.urgencyWeight * 100)}%</span>
                        <span>Urgency bonus</span>
                        <span className="text-right font-medium text-slate-700">+{Math.round(offer.signal.valueBreakdown.urgencyBoostWeight * 100)}%</span>
                      </div>
                    </details>
                    <div className="mt-auto flex flex-wrap gap-1.5 mb-3">
                      {isBestValue && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Best value</span>}
                      {isBestQty && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Best qty</span>}
                      {isBestConfidence && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Best confidence</span>}
                      {isBestDemandMatch && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Most demand matches</span>}
                      {isBestBenchmark && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Top benchmark</span>}
                      {isSoonest && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Soonest deadline</span>}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Link
                        href={offer.offer.farmer_id ? `/users/${offer.offer.farmer_id}` : '/marketplace'}
                        className="flex-1 inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[0.7rem] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Profile
                      </Link>
                      <Link
                        href={`/marketplace/explore?view=offers&q=${encodeURIComponent(offer.offer.produce_type)}`}
                        className="flex-1 inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[0.7rem] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        List
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {mode === 'explore' && view === 'offers' ? (
          <div id="explore-tab-panel" role="tabpanel" aria-labelledby="explore-tab-offers" className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {sortedOffers.length > 0 ? sortedOffers.map((row) => {
              const isBestValue = offerLeaders ? row.signal.valueScore === offerLeaders.bestValue : false;
              const isBestConfidence = offerLeaders ? row.signal.confidenceScore === offerLeaders.bestConfidence : false;
              const isBestDemandMatch = offerLeaders ? row.signal.demandMatchCount === offerLeaders.bestDemandMatch : false;
              const isBestBenchmark = offerLeaders ? row.signal.demandPriceBenchmark === offerLeaders.bestBenchmark : false;

              return (
              <article key={row.offer.id} className="group overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col">
                <div className="aspect-4/3 bg-slate-100 relative">
                  <MediaTile src={row.offer.product_image_url} alt={row.offer.produce_type} />
                  <div className="absolute left-3 top-3 z-10 flex gap-2">
                    <span className="inline-flex items-center rounded-md bg-white/95 px-2 py-1 text-[0.65rem] font-semibold text-slate-800 shadow-sm backdrop-blur-md">
                      Confidence {row.signal.confidenceScore}%
                    </span>
                  </div>
                  <div className="absolute right-3 top-3 z-10">
                    <button
                      type="button"
                      onClick={() => toggleCompareOffer(row.offer.id)}
                      className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[0.65rem] font-semibold shadow-sm transition ${
                        compareOfferIds.includes(row.offer.id)
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-white/20 bg-white/90 text-slate-700 hover:bg-white backdrop-blur-md'
                      }`}
                    >
                      {compareOfferIds.includes(row.offer.id) ? 'Comparing' : 'Compare'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col flex-1 p-4">
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{row.offer.produce_type}</h2>
                      <p className="text-sm font-medium text-slate-500 mt-0.5">
                        {Number(row.offer.quantity_kg).toLocaleString()} kg <span className="mx-1 text-slate-300">&bull;</span> {row.offer.pickup_province}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span title={getValueBreakdownHint(row.signal.valueBreakdown)} className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-[0.7rem] font-semibold text-slate-700 border border-slate-200/60">
                        Value {row.signal.valueScore}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.signal.demandMatchCount > 0 && <span className="rounded-md bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">{row.signal.demandMatchCount} matched</span>}
                    {isBestValue && <span className="rounded-md bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Top value</span>}
                    {isBestConfidence && <span className="rounded-md bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Top confidence</span>}
                    {isBestDemandMatch && <span className="rounded-md bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Most demand matches</span>}
                    {isBestBenchmark && <span className="rounded-md bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Best benchmark</span>}
                  </div>

                  <p className="mt-3 line-clamp-1 text-xs text-slate-500 pt-3 border-t border-slate-100">Best fit: {row.signal.fitReason}</p>
                  
                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.5rem] font-bold text-slate-400">
                        {row.offer.farmer?.avatar_url ? <img src={row.offer.farmer.avatar_url} alt="" className="h-full w-full object-cover" /> : (row.offer.farmer?.name?.charAt(0).toUpperCase() ?? 'S')}
                      </div>
                      <p className="text-sm font-medium text-slate-700">{row.offer.farmer?.name ?? 'Unknown'}</p>
                    </div>
                    <Link href={row.offer.farmer_id ? `/users/${row.offer.farmer_id}` : '/marketplace'} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-slate-600 transition-colors">Profile <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                </div>
              </article>
            );
            }) : (
              <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No offers match this filter.</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={() => { setSearchQuery(''); setSortMode('smart'); }} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">Reset filters</button>
                  <Link href="/post-shipment" className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">Add shipment</Link>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {mode === 'explore' && view === 'demands' ? (
          <div id="explore-tab-panel" role="tabpanel" aria-labelledby="explore-tab-demands" className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sortedDemands.length > 0 ? sortedDemands.map((demand) => {
              const tone = urgencyTone(demand.deadline);
              return (
                <article key={demand.id} id={`demand-${demand.id}`} className="group overflow-hidden rounded-xl border border-slate-200/80 bg-white transition-all duration-200 hover:-translate-y-0.5 flex flex-col" style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 pt-4 pb-3">
                    <div>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">Buyer demand</p>
                      <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{demand.produce_type}</h2>
                      <p className="mt-0.5 text-sm text-slate-500">{demand.delivery_province}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold ${tone.className}`}>{tone.label}</span>
                  </div>
                  <div className="flex flex-col flex-1 p-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">Need</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{Number(demand.quantity_kg).toLocaleString()} kg</p>
                      </div>
                      <div>
                        <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">Max price</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">${Number(demand.max_price_usd).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">Deadline</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatDeadline(demand.deadline)}</p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.5rem] font-bold text-slate-400">
                          {demand.buyer?.avatar_url ? <img src={demand.buyer.avatar_url} alt="" className="h-full w-full object-cover" /> : (demand.buyer?.name?.charAt(0).toUpperCase() ?? 'B')}
                        </div>
                        <p className="text-sm font-medium text-slate-700">{demand.buyer?.name ?? 'Unknown'}</p>
                      </div>
                      <Link href={demand.buyer_id ? `/users/${demand.buyer_id}` : '/marketplace'} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-slate-600 transition-colors">Profile <ArrowRight className="h-3.5 w-3.5" /></Link>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No demands match this filter.</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={() => { setSearchQuery(''); setSortMode('smart'); }} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">Reset filters</button>
                  <Link href="/post-demand" className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Create demand</Link>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {mode === 'deals' ? (
          <>
          {dealSummary ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="stat-tile">
                <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-slate-500">High value</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{dealSummary.highValueCount}</p>
              </div>
              <div className="stat-tile">
                <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-slate-500">Demand overlap</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{dealSummary.strongDemandCount}</p>
              </div>
              <div className="stat-tile">
                <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-slate-500">Avg discounted</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">${dealSummary.avgSalePrice.toFixed(2)}</p>
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {discountOffers.length > 0 ? discountOffers.map((offer, index) => {
              const isBestValue = dealLeaders ? offer.valueScore === dealLeaders.bestValue : false;
              const isBestConfidence = dealLeaders ? offer.confidenceScore === dealLeaders.bestConfidence : false;
              const isBestDemandMatch = dealLeaders ? offer.demandMatchCount === dealLeaders.bestDemandMatch : false;
              const isBestBenchmark = dealLeaders ? offer.originalPriceUsd === dealLeaders.bestBenchmark : false;
              const rankPosition = index + 1;

              return (
              <article key={offer.id} className="group overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col">
                <div className="aspect-4/3 relative overflow-hidden bg-slate-100">
                  <MediaTile src={offer.product_image_url} alt={offer.produce_type} />
                  <div className="absolute left-3 top-3 z-10 flex gap-2">
                    <span className="inline-flex rounded-md bg-white border border-slate-200/60 shadow-sm px-2.5 py-1 text-xs font-semibold text-orange-600">Save {offer.discountPercent}%</span>
                    <span className="rounded-md bg-emerald-50/90 backdrop-blur-md border border-emerald-200/60 shadow-sm px-2.5 py-1 text-xs font-semibold text-emerald-700">Buyer pick</span>
                  </div>
                </div>
                <div className="flex flex-col flex-1 p-4">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">{offer.produce_type}</h2>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-xl font-semibold text-slate-900">${offer.salePriceUsd.toFixed(2)}</span>
                    <span className="text-sm font-medium text-slate-400 line-through">${offer.originalPriceUsd.toFixed(2)}</span>
                  </div>
                  
                  <div className="mt-auto grid grid-cols-3 gap-2 mb-3">
                    <span title={getValueBreakdownHint(offer.valueBreakdown)} className="inline-flex flex-col items-center justify-center rounded-md border border-slate-200/60 bg-slate-50 p-1.5 text-center">
                      <span className="text-[0.6rem] uppercase tracking-wider text-slate-500">Value</span>
                      <span className="text-xs font-semibold text-slate-700">{offer.valueScore}</span>
                    </span>
                    <span className="inline-flex flex-col items-center justify-center rounded-md border border-slate-200/60 bg-slate-50 p-1.5 text-center">
                      <span className="text-[0.6rem] uppercase tracking-wider text-slate-500">Conf</span>
                      <span className="text-xs font-semibold text-emerald-700">{offer.confidenceScore}%</span>
                    </span>
                    <span className="inline-flex flex-col items-center justify-center rounded-md border border-slate-200/60 bg-slate-50 p-1.5 text-center">
                      <span className="text-[0.6rem] uppercase tracking-wider text-slate-500">Matches</span>
                      <span className="text-xs font-semibold text-amber-600">{offer.demandMatchCount}</span>
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {isBestValue && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Top value</span>}
                    {isBestConfidence && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Top confidence</span>}
                    {isBestDemandMatch && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Most demand matches</span>}
                    {isBestBenchmark && <span className="rounded-md border border-slate-200/60 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">Best benchmark</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <span className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200/60 bg-white shadow-sm px-2 py-1.5 font-medium text-slate-600">
                      <Scale className="h-3.5 w-3.5 text-slate-400" />
                      {Number(offer.quantity_kg).toLocaleString()} kg
                    </span>
                    <button type="button" onClick={() => toggleCompareOffer(offer.id)} className={`inline-flex items-center justify-center rounded-md border px-2.5 font-semibold shadow-sm transition ${compareOfferIds.includes(offer.id) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50'}`}>
                      {compareOfferIds.includes(offer.id) ? 'Comparing' : 'Compare'}
                    </button>
                  </div>
                  
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <p className="text-[0.8rem] text-slate-500 mb-1">{Number(offer.quantity_kg).toLocaleString()} kg | {offer.pickup_province}</p>
                    <p className="line-clamp-2 text-xs text-slate-500">Best fit: {offer.fitReason}</p>
                    <details className="group rounded-lg border border-slate-200/60 bg-slate-50/50 px-3 py-2 cursor-pointer">
                      <summary className="list-none text-[0.7rem] font-semibold text-slate-600 outline-none">
                        Why ranked #{rankPosition}
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.65rem] text-slate-500 pt-2 border-t border-slate-200/50">
                        <span>Confidence</span>
                        <span className="text-right font-medium text-slate-700">{Math.round(offer.valueBreakdown.confidenceWeight * 100)}%</span>
                        <span>Supply volume</span>
                        <span className="text-right font-medium text-slate-700">{Math.round(offer.valueBreakdown.quantityWeight * 100)}%</span>
                        <span>Demand pressure</span>
                        <span className="text-right font-medium text-slate-700">{Math.round(offer.valueBreakdown.demandPressureWeight * 100)}%</span>
                        <span>Urgency</span>
                        <span className="text-right font-medium text-slate-700">{Math.round(offer.valueBreakdown.urgencyWeight * 100)}%</span>
                        <span>Urgency bonus</span>
                        <span className="text-right font-medium text-slate-700">+{Math.round(offer.valueBreakdown.urgencyBoostWeight * 100)}%</span>
                      </div>
                    </details>
                    <div className="flex items-center justify-between pt-1">
                      <Link href={offer.farmer_id ? `/users/${offer.farmer_id}` : '/marketplace'} className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-slate-900 hover:text-slate-600 transition-colors">Profile <ArrowRight className="h-3 w-3" /></Link>
                      <Link href={`/marketplace/explore?view=offers&q=${encodeURIComponent(offer.produce_type)}`} className="inline-flex h-7 items-center rounded-md border border-slate-200/60 bg-white shadow-sm px-3 text-[0.7rem] font-semibold text-slate-700 transition hover:bg-slate-50">Open list</Link>
                    </div>
                  </div>
                </div>
              </article>
            );
            }) : (
              <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No discounted offers yet.</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Link href="/marketplace/explore?view=offers" className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">Explore offers</Link>
                  <Link href="/post-shipment" className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">Add shipment</Link>
                </div>
              </div>
            )}
          </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
