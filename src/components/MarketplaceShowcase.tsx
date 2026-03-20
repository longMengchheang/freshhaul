'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { BadgePercent, ChevronLeft, ChevronRight, ClipboardList, Heart, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
// Card removed — tiles use direct markup
import { buildDemandInsights, getOfferDecisionSignal } from '@/lib/marketplace-intelligence';
import { cn } from '@/lib/utils';
import type { DemandWithBuyer, MarketplacePromotion, ShipmentWithFarmer } from '@/types/app';

interface MarketplaceShowcaseProps {
  openShipments: ShipmentWithFarmer[];
  openDemands: DemandWithBuyer[];
  heroPromotion?: MarketplacePromotion | null;
  initialView?: 'offers' | 'demands';
}

type DiscoveryView = 'offers' | 'demands';
type SortMode = 'smart' | 'quantity' | 'deadline';

type DiscountOffer = ShipmentWithFarmer & {
  originalPriceUsd: number;
  salePriceUsd: number;
  discountPercent: number;
  valueScore: number;
  confidenceScore: number;
  demandMatchCount: number;
  fitReason: string;
  valueBreakdownHint: string;
};

type HeroSlide = {
  id: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video';
  headline: string;
  subheadline: string;
  sellerName: string;
  sellerProvince: string;
  ctaLabel: string;
  href: string | null;
};

const SAVED_OFFER_IDS_KEY = 'marketplace:saved-offer-ids';
const SAVED_DEMAND_IDS_KEY = 'marketplace:saved-demand-ids';

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

function isVideoMedia(url: string, declaredType?: 'image' | 'video') {
  if (declaredType === 'video') return true;
  const value = url.toLowerCase();
  return value.includes('.mp4') || value.includes('.webm') || value.includes('.ogg');
}

function parseStoredIds(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function persistIds(storageKey: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(ids));
}

function FallbackMedia() {
  return <div className="h-full w-full bg-gradient-to-br from-emerald-100 via-emerald-50 to-orange-100" />;
}

function MediaSurface({
  mediaUrl,
  mediaType,
  alt,
  priority = false,
  onMediaError,
}: {
  mediaUrl: string | null;
  mediaType: 'image' | 'video';
  alt: string;
  priority?: boolean;
  onMediaError?: () => void;
}) {
  if (!mediaUrl) return <FallbackMedia />;

  if (isVideoMedia(mediaUrl, mediaType)) {
    return <video src={mediaUrl} className="h-full w-full object-cover" autoPlay muted loop playsInline onError={onMediaError} />;
  }

  return <img src={mediaUrl} alt={alt} className="h-full w-full object-cover" loading={priority ? 'eager' : 'lazy'} onError={onMediaError} />;
}

function HorizontalScroller({ children, railLabel, itemCount }: { children: React.ReactNode; railLabel: string; itemCount: number; }) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateRailState = () => {
    const rail = railRef.current;
    if (!rail) return;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    setCanScrollLeft(rail.scrollLeft > 6);
    setCanScrollRight(rail.scrollLeft < maxScroll - 6);
  };

  useEffect(() => {
    updateRailState();
    const frame = window.requestAnimationFrame(updateRailState);
    const rail = railRef.current;
    if (!rail) return () => window.cancelAnimationFrame(frame);
    const onScroll = () => updateRailState();
    rail.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      rail.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [itemCount]);

  const scrollByPage = (direction: 'left' | 'right') => {
    const rail = railRef.current;
    if (!rail) return;
    const step = Math.max(Math.floor(rail.clientWidth * 0.84), 280);
    rail.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  };

  return (
    <div className="relative group/scroller">
      <div ref={railRef} aria-label={railLabel} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {canScrollLeft ? <button type="button" onClick={() => scrollByPage('left')} aria-label={`Scroll ${railLabel} left`} className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-200/50 bg-white/95 p-3 text-slate-800 shadow-lg transition opacity-0 group-hover/scroller:opacity-100 hover:bg-white hover:scale-105"><ChevronLeft className="h-5 w-5" /></button> : null}
      {canScrollRight ? <button type="button" onClick={() => scrollByPage('right')} aria-label={`Scroll ${railLabel} right`} className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-200/50 bg-white/95 p-3 text-slate-800 shadow-lg transition opacity-0 group-hover/scroller:opacity-100 hover:bg-white hover:scale-105"><ChevronRight className="h-5 w-5" /></button> : null}
    </div>
  );
}

function SaveToggle({ pressed, onClick, label }: { pressed: boolean; onClick: (e?: React.MouseEvent) => void; label: string; }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} aria-label={label} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full border transition', pressed ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-white')}>
      <Heart className={cn('h-4 w-4', pressed ? 'fill-current' : '')} />
    </button>
  );
}

function SellerMiniCard({ shipment, rank }: { shipment: ShipmentWithFarmer; rank?: number }) {
  return (
    <div className="group relative w-[15rem] shrink-0 snap-start flex flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-100 border-b border-slate-100">
        <MediaSurface mediaUrl={shipment.product_image_url ?? null} mediaType="image" alt={`${shipment.produce_type} by ${shipment.farmer?.name ?? 'seller'}`} />
        {rank !== undefined && (
          <div className="absolute top-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-sm backdrop-blur-md border border-slate-200/50">
            <span className="text-sm font-bold tracking-tight">#{rank}</span>
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col p-4">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">{shipment.pickup_province}</p>
        <h3 className="line-clamp-1 text-lg font-bold tracking-tight text-slate-900 mb-1">{shipment.produce_type}</h3>
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.5rem] font-bold text-slate-400">
            {shipment.farmer?.avatar_url ? <img src={shipment.farmer.avatar_url} alt="" className="h-full w-full object-cover" /> : (shipment.farmer?.name?.charAt(0).toUpperCase() ?? 'S')}
          </div>
          <p className="line-clamp-1 text-xs font-medium text-slate-600">
            <span className="text-slate-900">{shipment.farmer?.name ?? 'Seller'}</span> <span className="mx-1 text-slate-300">&bull;</span> {Number(shipment.quantity_kg).toLocaleString()} kg
          </p>
        </div>
      </div>
      {shipment.farmer_id && (
        <Link href={`/users/${shipment.farmer_id}`} className="absolute inset-0 z-20" aria-label={`View ${shipment.produce_type} by ${shipment.farmer?.name ?? 'Seller'}`} />
      )}
    </div>
  );
}

function ProductTile({
  shipment,
  label,
  detail,
  detailTitle,
  highlights,
  isSaved,
  onToggleSave,
  href,
}: {
  shipment: ShipmentWithFarmer;
  label: string;
  detail?: string;
  detailTitle?: string;
  highlights?: string[];
  isSaved?: boolean;
  onToggleSave?: () => void;
  href?: string;
}) {
  return (
    <div className="group relative w-[15rem] shrink-0 snap-start flex flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-100 border-b border-slate-100">
        <MediaSurface mediaUrl={shipment.product_image_url ?? null} mediaType="image" alt={`${shipment.produce_type} product`} />
        
        <div className="absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-2">
          <Badge variant="secondary" className="bg-white/95 text-slate-800 hover:bg-white border-transparent font-medium px-2.5 py-0.5 text-[0.65rem] shadow-sm backdrop-blur-md">
            {label}
          </Badge>
          {onToggleSave && (
            <div className="relative z-30 shrink-0">
              <SaveToggle pressed={Boolean(isSaved)} onClick={(e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); onToggleSave(); }} label={isSaved ? `Remove ${shipment.produce_type} from saved offers` : `Save ${shipment.produce_type} offer`} />
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col p-4">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">{shipment.pickup_province}</p>
        <h4 className="line-clamp-1 text-lg font-semibold tracking-tight text-slate-900 mb-1">{shipment.produce_type}</h4>
        
        <div className="flex items-center gap-1.5 mb-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.5rem] font-bold text-slate-400">
            {shipment.farmer?.avatar_url ? <img src={shipment.farmer.avatar_url} alt="" className="h-full w-full object-cover" /> : (shipment.farmer?.name?.charAt(0).toUpperCase() ?? 'S')}
          </div>
          <p className="line-clamp-1 text-xs text-slate-600">
            <span className="font-medium text-slate-900">{shipment.farmer?.name ?? 'Seller'}</span>
            <span className="mx-1 text-slate-300">&bull;</span>
            {Number(shipment.quantity_kg).toLocaleString()} kg
          </p>
        </div>

        {detail && <p title={detailTitle} className="mb-3 line-clamp-2 text-[0.7rem] leading-tight text-slate-500">{detail}</p>}

        <div className="mt-auto">
          {highlights && highlights.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5 pt-3 border-t border-slate-100">
              {highlights.slice(0, 2).map((item) => (
                <span key={`${shipment.id}-${item}`} className="rounded-md bg-slate-50 border border-slate-200/60 px-2 py-1 text-[0.65rem] font-medium text-slate-600">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {href ? <Link href={href} className="absolute inset-0 z-20" aria-label={`Open ${shipment.produce_type}`} /> : null}
    </div>
  );
}

function DemandTile({
  demand,
  label,
  detail,
  isSaved,
  onToggleSave,
  href,
}: {
  demand: DemandWithBuyer;
  label: string;
  detail?: string;
  isSaved?: boolean;
  onToggleSave?: () => void;
  href?: string;
}) {
  const [now] = useState(() => Date.now());
  const deadlineDate = new Date(demand.deadline);
  const daysUntil = Math.ceil((deadlineDate.getTime() - now) / (1000 * 60 * 60 * 24));
  const isUrgent = daysUntil <= 3;
  const deadlineLabel = daysUntil <= 0
    ? 'Today'
    : daysUntil === 1
    ? '1 day left'
    : daysUntil <= 6
    ? `${daysUntil} days left`
    : deadlineDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="group relative w-60 shrink-0 snap-start flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 cursor-pointer" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <h4 className="line-clamp-1 text-base font-semibold tracking-tight text-slate-900">{demand.produce_type}</h4>
          </div>
        </div>
        {onToggleSave && (
          <div className="relative z-30 shrink-0 -mt-0.5">
            <SaveToggle pressed={Boolean(isSaved)} onClick={(e?: React.MouseEvent) => { e?.preventDefault(); e?.stopPropagation(); onToggleSave(); }} label={isSaved ? `Remove ${demand.produce_type} from saved demands` : `Save ${demand.produce_type} demand`} />
          </div>
        )}
      </div>

      <div className="relative flex flex-1 flex-col px-4 py-3">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0.5rem] font-bold text-slate-400">
            {demand.buyer?.avatar_url ? <img src={demand.buyer.avatar_url} alt="" className="h-full w-full object-cover" /> : (demand.buyer?.name?.charAt(0).toUpperCase() ?? 'B')}
          </div>
          <p className="line-clamp-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{demand.buyer?.name ?? 'Buyer'}</span>
          <span className="mx-1 text-slate-300">&middot;</span>
          {demand.delivery_province}
          <span className="mx-1 text-slate-300">&middot;</span>
          {Number(demand.quantity_kg).toLocaleString()} kg
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">Max price</p>
            <p className="text-lg font-bold tracking-tight text-slate-900">${Number(demand.max_price_usd).toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">Deadline</p>
            <p className={cn('text-sm font-semibold', isUrgent ? 'text-rose-600' : 'text-slate-700')}>{deadlineLabel}</p>
          </div>
        </div>

        {detail && <p className="line-clamp-1 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">{detail}</p>}
      </div>
      {href ? <Link href={href} className="absolute inset-0 z-20" aria-label={`Open ${demand.produce_type} demand`} /> : null}
    </div>
  );
}

function Row({
  title,
  actionLabel,
  actionHref,
  itemCount,
  children,
}: {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  itemCount: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[1.35rem] font-semibold text-slate-950">{title}</h3>
        {actionHref && actionLabel ? <Link href={actionHref} className="text-sm font-semibold text-slate-600 transition hover:text-slate-900">{actionLabel}</Link> : null}
      </div>
      <HorizontalScroller railLabel={title} itemCount={itemCount}>{children}</HorizontalScroller>
    </section>
  );
}

export default function MarketplaceShowcase({
  openShipments,
  openDemands,
  heroPromotion,
  initialView = 'offers',
}: MarketplaceShowcaseProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSort = searchParams.get('sort') === 'quantity' || searchParams.get('sort') === 'deadline' ? (searchParams.get('sort') as SortMode) : 'smart';
  const initialProvince = searchParams.get('province') ?? 'all';
  const initialProduce = searchParams.get('produce') ?? 'all';
  const initialSearch = searchParams.get('q') ?? '';
  const initialResolvedView = searchParams.get('view') === 'demands' ? 'demands' : initialView;

  const [discoveryView, setDiscoveryView] = useState<DiscoveryView>(initialResolvedView);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [brokenSlideIds, setBrokenSlideIds] = useState<Record<string, true>>({});
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [provinceFilter, setProvinceFilter] = useState(initialProvince);
  const [produceFilter, setProduceFilter] = useState(initialProduce);
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);
  const [rankingNowTs] = useState(() => Date.now());
  const [savedOfferIds, setSavedOfferIds] = useState<string[]>(() => (typeof window === 'undefined' ? [] : parseStoredIds(window.localStorage.getItem(SAVED_OFFER_IDS_KEY))));
  const [savedDemandIds, setSavedDemandIds] = useState<string[]>(() => (typeof window === 'undefined' ? [] : parseStoredIds(window.localStorage.getItem(SAVED_DEMAND_IDS_KEY))));

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (discoveryView === 'demands') next.set('view', 'demands');
    else next.delete('view');
    if (sortMode !== 'smart') next.set('sort', sortMode);
    else next.delete('sort');
    if (provinceFilter !== 'all') next.set('province', provinceFilter);
    else next.delete('province');
    if (produceFilter !== 'all') next.set('produce', produceFilter);
    else next.delete('produce');
    const trimmed = searchQuery.trim();
    if (trimmed.length > 0) next.set('q', trimmed);
    else next.delete('q');

    const target = next.toString();
    const current = searchParams.toString();
    if (target === current) return;
    router.replace(target.length > 0 ? `${pathname}?${target}` : pathname, { scroll: false });
  }, [discoveryView, sortMode, provinceFilter, produceFilter, searchQuery, pathname, router, searchParams]);

  const sortedOffers = useMemo(() => [...openShipments].sort((a, b) => Number(b.quantity_kg) - Number(a.quantity_kg)), [openShipments]);
  const sortedDemands = useMemo(() => [...openDemands].sort((a, b) => Number(b.quantity_kg) - Number(a.quantity_kg)), [openDemands]);

  const topSellerOffers = sortedOffers.slice(0, 8);

  const provinceOptions = useMemo(() => Array.from(new Set([
    ...openShipments.map((offer) => offer.pickup_province),
    ...openDemands.map((demand) => demand.delivery_province),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [openShipments, openDemands]);

  const produceOptions = useMemo(() => Array.from(new Set([
    ...openShipments.map((offer) => offer.produce_type),
    ...openDemands.map((demand) => demand.produce_type),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [openShipments, openDemands]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredOffers = useMemo(() => {
    return sortedOffers.filter((offer) => {
      if (provinceFilter !== 'all' && offer.pickup_province !== provinceFilter) return false;
      if (produceFilter !== 'all' && offer.produce_type !== produceFilter) return false;
      if (!normalizedQuery) return true;
      return `${offer.produce_type} ${offer.pickup_province} ${offer.farmer?.name ?? ''}`.toLowerCase().includes(normalizedQuery);
    });
  }, [sortedOffers, provinceFilter, produceFilter, normalizedQuery]);

  const filteredDemands = useMemo(() => {
    return sortedDemands.filter((demand) => {
      if (provinceFilter !== 'all' && demand.delivery_province !== provinceFilter) return false;
      if (produceFilter !== 'all' && demand.produce_type !== produceFilter) return false;
      if (!normalizedQuery) return true;
      return `${demand.produce_type} ${demand.delivery_province} ${demand.buyer?.name ?? ''}`.toLowerCase().includes(normalizedQuery);
    });
  }, [sortedDemands, provinceFilter, produceFilter, normalizedQuery]);

  const discoverDemands = useMemo(() => {
    const rows = [...filteredDemands];
    if (sortMode === 'deadline') rows.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    else if (sortMode === 'quantity') rows.sort((a, b) => Number(b.quantity_kg) - Number(a.quantity_kg));
    else rows.sort((a, b) => Number(b.max_price_usd) - Number(a.max_price_usd));
    return rows;
  }, [filteredDemands, sortMode]);

  const demandInsights = useMemo(() => buildDemandInsights(discoverDemands), [discoverDemands]);

  const offerSignalRows = useMemo(() => {
    return filteredOffers.map((offer) => ({
      offer,
      signal: getOfferDecisionSignal(offer, demandInsights),
    }));
  }, [filteredOffers, demandInsights]);

  const offerSignalLookup = useMemo(
    () => new Map(offerSignalRows.map((row) => [row.offer.id, row.signal])),
    [offerSignalRows],
  );

  const discoverOffers = useMemo(() => {
    const rows = [...offerSignalRows];
    if (sortMode === 'deadline') {
      rows.sort((a, b) => new Date(a.offer.deadline).getTime() - new Date(b.offer.deadline).getTime());
    } else if (sortMode === 'quantity') {
      rows.sort((a, b) => Number(b.offer.quantity_kg) - Number(a.offer.quantity_kg));
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
    return rows.map((row) => row.offer);
  }, [offerSignalRows, sortMode]);

  const topBuyerDemands = discoverDemands.slice(0, 8);

  const heroSlides = useMemo<HeroSlide[]>(() => {
    const slides: HeroSlide[] = [];
    if (heroPromotion) {
      slides.push({
        id: `promotion-${heroPromotion.id}`,
        mediaUrl: heroPromotion.media_url || null,
        mediaType: heroPromotion.media_type,
        headline: heroPromotion.headline || 'Featured spotlight',
        subheadline: heroPromotion.subheadline || 'Tap to open seller profile and products.',
        sellerName: heroPromotion.farmer?.name ?? 'Featured seller',
        sellerProvince: heroPromotion.farmer?.province ?? 'Marketplace',
        ctaLabel: heroPromotion.cta_label || 'View seller',
        href: heroPromotion.farmer_id ? `/users/${heroPromotion.farmer_id}` : null,
      });
    }
    for (const offer of sortedOffers.slice(0, 8)) {
      slides.push({
        id: `offer-${offer.id}`,
        mediaUrl: offer.product_image_url || null,
        mediaType: 'image',
        headline: offer.produce_type,
        subheadline: `${Number(offer.quantity_kg).toLocaleString()} kg | ${offer.pickup_province}`,
        sellerName: offer.farmer?.name ?? 'Seller',
        sellerProvince: offer.farmer?.province ?? offer.pickup_province,
        ctaLabel: 'View seller',
        href: offer.farmer_id ? `/users/${offer.farmer_id}` : null,
      });
    }
    if (slides.length === 0) {
      slides.push({
        id: 'fallback',
        mediaUrl: null,
        mediaType: 'image',
        headline: 'Marketplace spotlight',
        subheadline: 'Featured products appear here as soon as sellers post media.',
        sellerName: 'No featured seller',
        sellerProvince: 'Marketplace',
        ctaLabel: 'Browse offers',
        href: null,
      });
    }
    return slides;
  }, [heroPromotion, sortedOffers]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = window.setInterval(() => setActiveSlideIndex((current) => (current + 1) % heroSlides.length), 6000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const recommendedOffers = useMemo(
    () => [...offerSignalRows]
      .sort((a, b) => b.signal.valueScore - a.signal.valueScore)
      .slice(0, 8)
      .map((row) => row.offer),
    [offerSignalRows],
  );

  const recommendedOfferRankById = useMemo(
    () => new Map(
      [...offerSignalRows]
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
    ),
    [offerSignalRows],
  );

  const offerLeaders = useMemo(() => {
    if (offerSignalRows.length === 0) return null;
    return {
      bestValue: Math.max(...offerSignalRows.map((row) => row.signal.valueScore)),
      bestConfidence: Math.max(...offerSignalRows.map((row) => row.signal.confidenceScore)),
      bestDemandMatch: Math.max(...offerSignalRows.map((row) => row.signal.demandMatchCount)),
      bestBenchmark: Math.max(...offerSignalRows.map((row) => row.signal.demandPriceBenchmark)),
    };
  }, [offerSignalRows]);

  const discountOffers = useMemo<DiscountOffer[]>(() => {
    const demandPriceByProduce = new Map<string, number[]>();
    for (const demand of discoverDemands) {
      const key = demand.produce_type.toLowerCase();
      const list = demandPriceByProduce.get(key) ?? [];
      list.push(Number(demand.max_price_usd));
      demandPriceByProduce.set(key, list);
    }
    return discoverOffers.slice(0, 8).map((offer, index) => {
      const demandPrices = demandPriceByProduce.get(offer.produce_type.toLowerCase()) ?? [];
      const avgDemandPrice = demandPrices.length > 0 ? demandPrices.reduce((total, value) => total + value, 0) / demandPrices.length : 120 + index * 10;
      const signal = offerSignalLookup.get(offer.id);
      const discountPercent = signal ? Math.min(28, Math.max(12, Math.round(signal.valueScore / 5 + signal.demandMatchCount))) : index % 2 === 0 ? 20 : 15;
      const originalPriceUsd = Number(avgDemandPrice.toFixed(2));
      const salePriceUsd = Number((originalPriceUsd * (1 - discountPercent / 100)).toFixed(2));
      return {
        ...offer,
        originalPriceUsd,
        salePriceUsd,
        discountPercent,
        valueScore: signal?.valueScore ?? 0,
        confidenceScore: signal?.confidenceScore ?? 0,
        demandMatchCount: signal?.demandMatchCount ?? 0,
        fitReason: signal?.fitReason ?? 'General market fit.',
        valueBreakdownHint: signal ? getValueBreakdownHint(signal.valueBreakdown) : 'No breakdown available',
      };
    });
  }, [discoverDemands, discoverOffers, offerSignalLookup]);

  const showcaseDealSummary = useMemo(() => {
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

  const recommendedDemandRows = useMemo(() => {
    const offerProduce = new Set(discoverOffers.map((offer) => offer.produce_type.toLowerCase()));
    const offersByProduce = new Map<string, ShipmentWithFarmer[]>();
    for (const offer of discoverOffers) {
      const key = offer.produce_type.toLowerCase();
      const rows = offersByProduce.get(key) ?? [];
      rows.push(offer);
      offersByProduce.set(key, rows);
    }

    return discoverDemands.map((demand) => {
      const produceKey = demand.produce_type.toLowerCase();
      const supplyRows = offersByProduce.get(produceKey) ?? [];
      const supplyQty = supplyRows.reduce((sum, offer) => sum + Number(offer.quantity_kg), 0);
      const qtyCoverage = Number(demand.quantity_kg) > 0 ? Math.min(supplyQty / Number(demand.quantity_kg), 1) : 0;
      const provinceMatchCount = supplyRows.filter((offer) => offer.pickup_province === demand.delivery_province).length;
      const deadlineHours = (new Date(demand.deadline).getTime() - rankingNowTs) / (1000 * 60 * 60);
      const urgencyScore = deadlineHours <= 24 ? 1 : deadlineHours <= 72 ? 0.8 : 0.55;
      const score = qtyCoverage * 0.55 + (provinceMatchCount > 0 ? 0.3 : 0.1) + urgencyScore * 0.15 + (offerProduce.has(produceKey) ? 0.1 : 0);
      const reason = supplyRows.length > 0
        ? `${supplyRows.length} matching offers | ${provinceMatchCount > 0 ? 'province match available' : 'cross-province handoff'}`
        : 'No current supply for this produce';

      return {
        demand,
        score,
        reason,
      };
    }).sort((a, b) => b.score - a.score).slice(0, 8);
  }, [discoverDemands, discoverOffers, rankingNowTs]);

  const recommendedDemands = useMemo(() => recommendedDemandRows.map((row) => row.demand), [recommendedDemandRows]);
  const recommendedDemandReasonById = useMemo(
    () => new Map(recommendedDemandRows.map((row) => [row.demand.id, row.reason])),
    [recommendedDemandRows],
  );

  const urgentDemands = useMemo(() => [...discoverDemands].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 8), [discoverDemands]);
  const savedOffers = useMemo(() => discoverOffers.filter((offer) => savedOfferIds.includes(offer.id)).slice(0, 8), [discoverOffers, savedOfferIds]);
  const savedDemands = useMemo(() => discoverDemands.filter((demand) => savedDemandIds.includes(demand.id)).slice(0, 8), [discoverDemands, savedDemandIds]);
  const savedOfferIdSet = useMemo(() => new Set(savedOfferIds), [savedOfferIds]);
  const savedDemandIdSet = useMemo(() => new Set(savedDemandIds), [savedDemandIds]);

  const activeSlide = heroSlides[activeSlideIndex] ?? heroSlides[0];
  const activeSlideUrl = brokenSlideIds[activeSlide.id] ? null : activeSlide.mediaUrl;
  const hasFilters = Boolean(searchQuery.trim()) || provinceFilter !== 'all' || produceFilter !== 'all' || sortMode !== 'smart';
  const totalSupplyKg = useMemo(
    () => discoverOffers.reduce((total, offer) => total + Number(offer.quantity_kg), 0),
    [discoverOffers],
  );
  const averageDemandPrice = useMemo(() => {
    if (discoverDemands.length === 0) {
      return 0;
    }
    const total = discoverDemands.reduce((sum, demand) => sum + Number(demand.max_price_usd), 0);
    return total / discoverDemands.length;
  }, [discoverDemands]);

  const goToPrevSlide = () => setActiveSlideIndex((current) => (current - 1 + heroSlides.length) % heroSlides.length);
  const goToNextSlide = () => setActiveSlideIndex((current) => (current + 1) % heroSlides.length);
  const markSlideMediaBroken = (slideId: string) => setBrokenSlideIds((current) => (current[slideId] ? current : { ...current, [slideId]: true }));
  const toggleSavedOffer = (offerId: string) => setSavedOfferIds((current) => {
    const next = current.includes(offerId) ? current.filter((id) => id !== offerId) : [...current, offerId];
    persistIds(SAVED_OFFER_IDS_KEY, next);
    return next;
  });
  const toggleSavedDemand = (demandId: string) => setSavedDemandIds((current) => {
    const next = current.includes(demandId) ? current.filter((id) => id !== demandId) : [...current, demandId];
    persistIds(SAVED_DEMAND_IDS_KEY, next);
    return next;
  });
  const resetFilters = () => {
    setSearchQuery('');
    setProvinceFilter('all');
    setProduceFilter('all');
    setSortMode('smart');
  };

  return (
    <section className="space-y-12">
      <div className="relative overflow-hidden rounded-2xl w-full h-[340px] sm:h-[400px] lg:h-[440px] flex flex-col group/hero" style={{ boxShadow: 'var(--shadow-lg)' }}>
        {activeSlide.href && <Link href={activeSlide.href} aria-label="Open featured seller profile" className="absolute inset-0 z-10" />}
        <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover/hero:scale-[1.015]">
          <MediaSurface mediaUrl={activeSlideUrl} mediaType={activeSlide.mediaType} alt={activeSlide.headline} priority onMediaError={() => markSlideMediaBroken(activeSlide.id)} />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent z-[1]" />

        <div className="relative z-20 flex flex-1 flex-col justify-end p-6 sm:p-8 lg:p-10">
          <div className="max-w-xl space-y-3 animate-in fade-in duration-500" key={activeSlideIndex}>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">{activeSlide.sellerProvince} &middot; {activeSlide.sellerName}</p>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {activeSlide.headline}
            </h2>
            <p className="max-w-md text-sm text-white/70 line-clamp-2">
              {activeSlide.subheadline}
            </p>
            <div className="flex items-center gap-2.5 pt-1">
              {activeSlide.href && (
                <Link href={activeSlide.href} className="inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-900 transition-all duration-150 hover:shadow-[0_6px_20px_-6px_rgba(255,255,255,0.4)] z-20">
                  {activeSlide.ctaLabel}
                </Link>
              )}
              <Link href="/marketplace/deals" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15 z-20">
                <BadgePercent className="h-3.5 w-3.5" />
                Deals
              </Link>
            </div>
          </div>
        </div>

        {heroSlides.length > 1 && (
          <>
            <button type="button" onClick={(e) => { e.preventDefault(); goToPrevSlide(); }} aria-label="Previous spotlight" className="absolute left-4 top-1/2 z-30 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:text-white group-hover/hero:opacity-100 cursor-pointer">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={(e) => { e.preventDefault(); goToNextSlide(); }} aria-label="Next spotlight" className="absolute right-4 top-1/2 z-30 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-white/20 hover:text-white group-hover/hero:opacity-100 cursor-pointer">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {heroSlides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5">
            {heroSlides.map((slide, index) => (
              <button key={slide.id} type="button" onClick={(e) => { e.preventDefault(); setActiveSlideIndex(index); }} aria-label={`Show spotlight ${index + 1}`} className={cn('rounded-full transition-all duration-200 bg-white cursor-pointer', index === activeSlideIndex ? 'h-1.5 w-4 opacity-100' : 'h-1.5 w-1.5 opacity-40 hover:opacity-70')} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="stat-tile">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Available supply</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{totalSupplyKg.toLocaleString()} <span className="text-base font-medium text-slate-400">kg</span></p>
        </div>
        <div className="stat-tile">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Open demands</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{discoverDemands.length}</p>
        </div>
        <div className="stat-tile">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Avg max price</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">${averageDemandPrice.toFixed(2)}</p>
        </div>
      </div>

      <Row title="Top sellers" actionLabel="View all" actionHref="/marketplace/explore" itemCount={Math.min(topSellerOffers.length, 6)}>
        {topSellerOffers.length > 0 ? topSellerOffers.slice(0, 6).map((offer, index) => <SellerMiniCard key={offer.id} shipment={offer} rank={index + 1} />) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-sm text-slate-500 text-center w-full">No seller data yet.</div>}
      </Row>

      <div id="discover-feed" className="scroll-mt-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">Discover</h3>
          <div role="tablist" aria-label="Marketplace feed mode" className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white p-1 self-start sm:self-auto" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <button type="button" id="discover-tab-offers" role="tab" aria-controls="discover-feed-panel" aria-selected={discoveryView === 'offers'} onClick={() => setDiscoveryView('offers')} className={cn('h-full rounded-md px-4 text-sm font-semibold transition-all duration-150 flex items-center gap-1.5', discoveryView === 'offers' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700')}>
              Offers <span className={cn("text-xs font-medium", discoveryView === 'offers' ? "text-white/70" : "text-slate-400")}>{discoverOffers.length}</span>
            </button>
            <button type="button" id="discover-tab-demands" role="tab" aria-controls="discover-feed-panel" aria-selected={discoveryView === 'demands'} onClick={() => setDiscoveryView('demands')} className={cn('h-full rounded-md px-4 text-sm font-semibold transition-all duration-150 flex items-center gap-1.5', discoveryView === 'demands' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700')}>
              Demands <span className={cn("text-xs font-medium", discoveryView === 'demands' ? "text-white/70" : "text-slate-400")}>{discoverDemands.length}</span>
            </button>
          </div>
        </div>

        <section className="relative">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search marketplace..." className="h-11 pl-10" />
            </label>
            <select value={provinceFilter} onChange={(event) => setProvinceFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-[0_1px_2px_rgba(50,50,93,0.04),0_1px_1px_rgba(0,0,0,0.03)] transition-colors hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none">
              <option value="all">All provinces</option>
              {provinceOptions.map((province) => <option key={province} value={province}>{province}</option>)}
            </select>
            <select value={produceFilter} onChange={(event) => setProduceFilter(event.target.value)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-[0_1px_2px_rgba(50,50,93,0.04),0_1px_1px_rgba(0,0,0,0.03)] transition-colors hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none">
              <option value="all">All produce</option>
              {produceOptions.map((produce) => <option key={produce} value={produce}>{produce}</option>)}
            </select>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-[0_1px_2px_rgba(50,50,93,0.04),0_1px_1px_rgba(0,0,0,0.03)] transition-colors hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none">
              <option value="smart">Smart ranking</option>
              <option value="quantity">Largest volume</option>
              <option value="deadline">Ending soon</option>
            </select>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
          </div>
        </section>

          {discoveryView === 'offers' ? (
            <div id="discover-feed-panel" role="tabpanel" aria-labelledby="discover-tab-offers" className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
              {savedOffers.length > 0 && (
                <Row title="Saved offers" itemCount={savedOffers.length}>
                  {savedOffers.map((offer) => <ProductTile key={offer.id} shipment={offer} label="Saved" isSaved onToggleSave={() => toggleSavedOffer(offer.id)} href={offer.farmer_id ? `/users/${offer.farmer_id}` : '/marketplace/explore?view=offers'} />)}
                </Row>
              )}
              <Row title="Best value now" actionLabel="Explore" actionHref="/marketplace/explore?view=offers" itemCount={recommendedOffers.length}>
                {recommendedOffers.length > 0 ? recommendedOffers.map((offer) => (
                  (() => {
                    const signal = offerSignalLookup.get(offer.id);
                    const rank = recommendedOfferRankById.get(offer.id);
                    const highlights = [
                      rank ? `Rank #${rank}` : '',
                      signal && offerLeaders && signal.valueScore === offerLeaders.bestValue ? 'Top value' : '',
                      signal && offerLeaders && signal.confidenceScore === offerLeaders.bestConfidence ? 'Top confidence' : '',
                      signal && offerLeaders && signal.demandMatchCount === offerLeaders.bestDemandMatch ? 'Most demand matches' : '',
                      signal && offerLeaders && signal.demandPriceBenchmark === offerLeaders.bestBenchmark ? 'Best benchmark' : '',
                    ].filter(Boolean);

                    const whyRanked = signal
                      ? `Why ranked #${rank ?? '-'}: ${getValueBreakdownHint(signal.valueBreakdown)} | Best fit: ${signal.fitReason}`
                      : undefined;

                    return (
                  <ProductTile
                    key={offer.id}
                    shipment={offer}
                    label="High value"
                    detail={`Value ${offerSignalLookup.get(offer.id)?.valueScore ?? 0} | ${offerSignalLookup.get(offer.id)?.demandMatchCount ?? 0} demand matches${rank ? ` | Rank #${rank}` : ''}`}
                    detailTitle={whyRanked}
                    highlights={highlights}
                    isSaved={savedOfferIdSet.has(offer.id)}
                    onToggleSave={() => toggleSavedOffer(offer.id)}
                    href={offer.farmer_id ? `/users/${offer.farmer_id}` : '/marketplace/explore?view=offers'}
                  />
                    );
                  })()
                )) : (
                  <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-6 text-sm font-medium text-slate-500 w-full text-center">No offers match these filters. Reset filters to see more.</div>
                )}
              </Row>
              {showcaseDealSummary ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="stat-tile">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">High value offers</p>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{showcaseDealSummary.highValueCount}</p>
                  </div>
                  <div className="stat-tile">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Strong demand overlap</p>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{showcaseDealSummary.strongDemandCount}</p>
                  </div>
                  <div className="stat-tile">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Avg discounted price</p>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">${showcaseDealSummary.avgSalePrice.toFixed(2)}</p>
                  </div>
                </div>
              ) : null}
              <Row title="Hot deals" actionLabel="See deals" actionHref="/marketplace/deals" itemCount={discountOffers.length}>
                {discountOffers.length > 0 ? discountOffers.map((offer) => (
                  <div key={offer.id} className="group relative w-[15rem] shrink-0 snap-start flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 cursor-pointer" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-100 border-b border-slate-100">
                      <MediaSurface mediaUrl={offer.product_image_url ?? null} mediaType="image" alt={`${offer.produce_type} product`} />
                      <div className="absolute left-3 top-3 z-10 flex gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-orange-500 px-2.5 py-0.5 text-[0.65rem] font-bold text-white shadow-sm">{offer.discountPercent}% off</span>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">{offer.pickup_province}</p>
                      <h4 className="line-clamp-1 text-base font-semibold tracking-tight text-slate-900 mb-2">{offer.produce_type}</h4>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-lg font-bold text-slate-900">${offer.salePriceUsd.toFixed(2)}</span>
                        <span className="text-sm text-slate-400 line-through">${offer.originalPriceUsd.toFixed(2)}</span>
                      </div>
                      <p className="mt-auto text-xs text-slate-500 pt-2 border-t border-slate-100">Value {offer.valueScore} &middot; {offer.demandMatchCount} matches</p>
                    </div>
                    <Link href={offer.farmer_id ? `/users/${offer.farmer_id}` : '/marketplace/deals'} className="absolute inset-0 z-20" aria-label={`Open discount for ${offer.produce_type}`} />
                  </div>
                )) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 w-full text-center">No discount offers for this filter set.</div>}
              </Row>
            </div>
          ) : (
            <div id="discover-feed-panel" role="tabpanel" aria-labelledby="discover-tab-demands" className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
              {savedDemands.length > 0 && (
                <Row title="Saved demands" itemCount={savedDemands.length}>
                  {savedDemands.map((demand) => <DemandTile key={demand.id} demand={demand} label="Saved" isSaved onToggleSave={() => toggleSavedDemand(demand.id)} href={demand.buyer_id ? `/users/${demand.buyer_id}` : '/marketplace/explore?view=demands'} />)}
                </Row>
              )}
              <Row title="Top buyer demands" actionLabel="Explore" actionHref="/marketplace/explore?view=demands" itemCount={topBuyerDemands.length}>
                {topBuyerDemands.length > 0 ? topBuyerDemands.map((demand) => (
                  <DemandTile key={demand.id} demand={demand} label="Top demand" isSaved={savedDemandIdSet.has(demand.id)} onToggleSave={() => toggleSavedDemand(demand.id)} href={demand.buyer_id ? `/users/${demand.buyer_id}` : '/marketplace/explore?view=demands'} />
                )) : <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-6 text-sm font-medium text-slate-500 w-full text-center">No demands match these filters. Reset filters to see more.</div>}
              </Row>
              <Row title="Matching your supply" itemCount={recommendedDemands.length}>
                {recommendedDemands.length > 0 ? recommendedDemands.map((demand) => (
                  <DemandTile
                    key={demand.id}
                    demand={demand}
                    label="Recommended"
                    detail={recommendedDemandReasonById.get(demand.id)}
                    isSaved={savedDemandIdSet.has(demand.id)}
                    onToggleSave={() => toggleSavedDemand(demand.id)}
                    href={demand.buyer_id ? `/users/${demand.buyer_id}` : '/marketplace/explore?view=demands'}
                  />
                )) : <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-6 text-sm font-medium text-slate-500 w-full text-center">No recommended demands yet.</div>}
              </Row>
              <Row title="Urgent requests" itemCount={urgentDemands.length}>
                {urgentDemands.length > 0 ? urgentDemands.map((demand) => (
                  <DemandTile key={demand.id} demand={demand} label="Urgent" detail={`Buyer: ${demand.buyer?.name ?? 'Unknown'}`} isSaved={savedDemandIdSet.has(demand.id)} onToggleSave={() => toggleSavedDemand(demand.id)} href={demand.buyer_id ? `/users/${demand.buyer_id}` : '/marketplace/explore?view=demands'} />
                )) : <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-6 text-sm font-medium text-slate-500 w-full text-center">No urgent demands right now.</div>}
              </Row>
            </div>
          )}
      </div>
    </section>
  );
}
