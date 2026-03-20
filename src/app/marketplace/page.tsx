'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BadgePercent, Compass, ShoppingBasket } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import MarketplaceShowcase from '@/components/MarketplaceShowcase';
import { getMarketplaceSnapshot } from '@/app/actions/deals';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { DemandWithBuyer, MarketplacePromotion, ShipmentWithFarmer } from '@/types/app';

export default function MarketplacePage() {
  const { loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const initialView = searchParams.get('view') === 'demands' ? 'demands' : 'offers';
  const [openDemands, setOpenDemands] = useState<DemandWithBuyer[]>([]);
  const [openShipments, setOpenShipments] = useState<ShipmentWithFarmer[]>([]);
  const [heroPromotion, setHeroPromotion] = useState<MarketplacePromotion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dismissSavedNotice, setDismissSavedNotice] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    async function load() {
      setLoading(true);
      const result = await getMarketplaceSnapshot();
      if (!active) return;

      if (result.success && result.data) {
        setOpenDemands(result.data.openDemands);
        setOpenShipments(result.data.openShipments);
        setHeroPromotion(result.data.heroPromotion ?? null);
        setLoadError('');
      } else if (!result.success) {
        setLoadError(result.error ?? 'Could not load marketplace right now.');
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [authLoading]);

  const refreshSnapshot = async () => {
    setLoadError('');
    const refreshed = await getMarketplaceSnapshot();
    if (refreshed.success && refreshed.data) {
      setOpenDemands(refreshed.data.openDemands);
      setOpenShipments(refreshed.data.openShipments);
      setHeroPromotion(refreshed.data.heroPromotion ?? null);
      return;
    }
    setLoadError(refreshed.error ?? 'Could not refresh marketplace.');
  };

  if (authLoading || loading) {
    return (
      <div className="page-shell space-y-8 animate-in fade-in duration-500">
        <div className="flex h-112 animate-pulse rounded-[1.5rem] border border-slate-200/60 bg-white/70 shadow-sm" />
        <div className="flex h-128 animate-pulse rounded-[1.5rem] border border-slate-200/60 bg-white/70 shadow-sm" />
      </div>
    );
  }

  const created = searchParams.get('created');
  const showSavedNotice = !dismissSavedNotice && (created === 'demand' || created === 'shipment');

  return (
    <main className="page-shell space-y-8 py-8 lg:py-10 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
      {showSavedNotice ? (
        <Notice
          tone="success"
          action={(
            <button
              type="button"
              onClick={() => setDismissSavedNotice(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800"
            >
              Close
            </button>
          )}
        >
          {created === 'demand' ? 'Demand saved successfully.' : 'Produce offer saved successfully.'}
        </Notice>
      ) : null}

      {loadError ? (
        <Notice
          tone="warning"
          action={<Button type="button" variant="outline" onClick={refreshSnapshot}>Retry</Button>}
        >
          {loadError}
        </Notice>
      ) : null}

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Marketplace</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Find, compare, and source fresh produce</h2>
          </div>
          <Link href="/marketplace/deals" className="inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition-all duration-150 hover:bg-slate-800" style={{ boxShadow: 'var(--shadow-sm)' }}>
            Explore deals
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/marketplace/deals" className="step-card group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <BadgePercent className="h-5 w-5" />
            </div>
            <p className="mt-3 text-base font-semibold text-slate-900">Best discounts</p>
            <p className="mt-1 text-sm text-slate-600">Offers ranked by estimated savings.</p>
          </Link>
          <Link href="/marketplace/explore?view=offers" className="step-card group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Compass className="h-5 w-5" />
            </div>
            <p className="mt-3 text-base font-semibold text-slate-900">Explore supply</p>
            <p className="mt-1 text-sm text-slate-600">Filter by produce, location, and deadline.</p>
          </Link>
          <Link href="/post-demand" className="step-card group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShoppingBasket className="h-5 w-5" />
            </div>
            <p className="mt-3 text-base font-semibold text-slate-900">Post demand</p>
            <p className="mt-1 text-sm text-slate-600">Publish quantity and max price to attract offers.</p>
          </Link>
        </div>
      </section>

      <MarketplaceShowcase
        openShipments={openShipments}
        openDemands={openDemands}
        heroPromotion={heroPromotion}
        initialView={initialView}
      />
    </main>
  );
}

