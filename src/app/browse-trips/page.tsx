'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Compass, Loader2, Radar, Route } from 'lucide-react';
import {
  claimDealWithTrip,
  createAvailableTrip,
  getDriverBoard,
} from '@/app/actions/trips';
import CountryProvinceSelector from '@/components/CountryProvinceSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TRUCK_TYPES, TRUCK_TYPE_LABELS } from '@/lib/cambodia';
import { DEFAULT_COUNTRY, getCountryCode, getCountryName } from '@/lib/locations';
import { cn } from '@/lib/utils';
import type { MatchingDealCandidate, TripWithDriver } from '@/types/app';

type FormState = {
  fromCountry: string;
  fromProvince: string;
  toCountry: string;
  toProvince: string;
  truckType: string;
  capacityKg: string;
  availableFrom: string;
  availableTo: string;
  pricePerKg: string;
};

const INITIAL_FORM: FormState = {
  fromCountry: DEFAULT_COUNTRY,
  fromProvince: '',
  toCountry: DEFAULT_COUNTRY,
  toProvince: '',
  truckType: '',
  capacityKg: '',
  availableFrom: '',
  availableTo: '',
  pricePerKg: '',
};

function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dispatchMinutesLeft(expiresAt: string | Date) {
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 60_000));
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function releaseScrollLock() {
  if (typeof document === 'undefined') {
    return;
  }

  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
  document.body.style.removeProperty('pointer-events');
  document.body.removeAttribute('data-scroll-locked');
  document.documentElement.style.removeProperty('overflow');
}

export default function BrowseTripsPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [trips, setTrips] = useState<TripWithDriver[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [matchingDeals, setMatchingDeals] = useState<MatchingDealCandidate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<'priority' | 'price' | 'fresh'>('priority');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [claimingDealId, setClaimingDealId] = useState<string | null>(null);
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  const [error, setError] = useState('');
  const [claimError, setClaimError] = useState('');
  const [message, setMessage] = useState('');

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );

  const formValidationError = useMemo(() => {
    if (!form.fromProvince.trim() || !form.toProvince.trim()) {
      return 'Select start and destination provinces.';
    }
    if (!form.truckType.trim()) {
      return 'Select truck type.';
    }

    const capacity = parsePositiveNumber(form.capacityKg);
    if (!capacity) {
      return 'Capacity must be a number greater than zero.';
    }

    const pricePerKg = parsePositiveNumber(form.pricePerKg);
    if (!pricePerKg) {
      return 'Price per kg must be a number greater than zero.';
    }

    const fromCode = getCountryCode(form.fromCountry);
    const toCode = getCountryCode(form.toCountry);
    const sameProvince =
      form.fromProvince.trim().toLowerCase() === form.toProvince.trim().toLowerCase();
    if (fromCode === toCode && sameProvince) {
      return 'Start and destination location cannot be the same.';
    }

    if (!form.availableFrom || !form.availableTo) {
      return 'Select start and end times.';
    }

    const availableFromDate = new Date(form.availableFrom);
    const availableToDate = new Date(form.availableTo);
    if (
      Number.isNaN(availableFromDate.getTime()) ||
      Number.isNaN(availableToDate.getTime())
    ) {
      return 'Enter valid route schedule times.';
    }

    if (availableToDate <= availableFromDate) {
      return 'End time must be later than start time.';
    }

    return '';
  }, [form]);

  const filteredDeals = useMemo(() => {
    const base = showPriorityOnly
      ? matchingDeals.filter((deal) => Boolean(deal.dispatchJob))
      : matchingDeals;

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const searched = normalizedSearch.length === 0
      ? base
      : base.filter((deal) => {
        const blob = [
          deal.shipment.produce_type,
          deal.shipment.pickup_province,
          deal.demand.delivery_province,
          deal.status,
        ].join(' ').toLowerCase();

        return blob.includes(normalizedSearch);
      });

    return [...searched].sort((left, right) => {
      if (sortMode === 'priority') {
        const leftPriority = left.dispatchJob ? 0 : 1;
        const rightPriority = right.dispatchJob ? 0 : 1;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      }

      if (sortMode === 'price') {
        return Number(right.agreed_price_usd) - Number(left.agreed_price_usd);
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [matchingDeals, showPriorityOnly, searchTerm, sortMode]);

  const boardStats = useMemo(() => {
    const queueCount = filteredDeals.filter((deal) => Boolean(deal.dispatchJob)).length;
    const projectedRevenue = filteredDeals.reduce((sum, deal) => sum + Number(deal.agreed_price_usd || 0), 0);
    const projectedLoad = filteredDeals.reduce((sum, deal) => sum + Number(deal.quantity_kg || 0), 0);

    return {
      queueCount,
      projectedRevenue,
      projectedLoad,
    };
    }
  , [filteredDeals]);

  async function loadBoard(nextTripId?: string) {
    setLoading(true);
    setError('');
    const result = await getDriverBoard(nextTripId);
    if (!result.success || !result.data) {
      setError(result.error ?? 'Failed to load driver board.');
      setLoading(false);
      return;
    }

    setTrips(result.data.trips);
    setMatchingDeals(result.data.matchingDeals);
    const resolvedTripId =
      nextTripId ?? result.data.selectedTrip?.id ?? result.data.trips[0]?.id ?? '';
    setSelectedTripId(resolvedTripId);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function bootstrapBoard() {
      const result = await getDriverBoard();
      if (!active) {
        return;
      }

      if (!result.success || !result.data) {
        setError(result.error ?? 'Failed to load driver board.');
        setLoading(false);
        return;
      }

      setTrips(result.data.trips);
      setMatchingDeals(result.data.matchingDeals);
      setSelectedTripId(result.data.selectedTrip?.id ?? result.data.trips[0]?.id ?? '');
      setLoading(false);
    }

    void bootstrapBoard();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    releaseScrollLock();
  }, [error]);

  async function handleCreateTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setClaimError('');
    setMessage('');

    if (formValidationError) {
      setError(formValidationError);
      return;
    }

    setSaving(true);
    const result = await createAvailableTrip({
      from_country_code: getCountryCode(form.fromCountry),
      from_province: form.fromProvince.trim(),
      to_country_code: getCountryCode(form.toCountry),
      to_province: form.toProvince.trim(),
      truck_type: form.truckType,
      capacity_kg: form.capacityKg.trim(),
      available_from: new Date(form.availableFrom),
      available_to: new Date(form.availableTo),
      price_per_kg: form.pricePerKg.trim(),
    });

    if (!result.success) {
      setError(result.error ?? 'Could not save route.');
      setSaving(false);
      return;
    }

    setMessage('Route saved. Matching jobs refreshed.');
    await loadBoard(result.data?.tripId ?? undefined);
    setSaving(false);
  }

  async function handleClaim(dealId: string) {
    if (!selectedTripId || !selectedTrip || selectedTrip.status !== 'active') {
      return;
    }

    setClaimingDealId(dealId);
    setClaimError('');
    setError('');
    setMessage('');
    const result = await claimDealWithTrip(dealId, selectedTripId);

    if (!result.success) {
      setClaimError(result.error ?? 'Could not claim this job.');
      setClaimingDealId(null);
      return;
    }

    if (result.data?.alreadyClaimed) {
      setMessage('You already claimed this job.');
    } else {
      setMessage('Job claimed successfully.');
    }

    await loadBoard(selectedTripId);
    setClaimingDealId(null);
  }

  return (
    <main className="page-shell space-y-7 py-8">
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">Driver board</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Claim transport jobs</h1>
          <p className="text-sm text-slate-500">Save routes, view matching jobs, claim priority dispatch.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="stat-tile">
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-slate-500">Saved routes</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{trips.length}</p>
          </div>
          <div className="stat-tile">
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-slate-500">Visible jobs</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{filteredDeals.length}</p>
          </div>
          <div className="stat-tile">
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-slate-500">Priority queue</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-amber-700">{boardStats.queueCount}</p>
          </div>
          <div className="stat-tile">
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-slate-500">Projected load</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{Math.round(boardStats.projectedLoad).toLocaleString()} <span className="text-base font-medium text-slate-400">kg</span></p>
          </div>
        </div>
      </section>

      {error ? <Notice tone="warning">{error}</Notice> : null}
      {claimError ? <Notice tone="warning">{claimError}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.25fr]">
        <Card className="premium-card rounded-2xl border-slate-200 bg-white/95">
          <CardHeader className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Step 1 • Route Composer</p>
            <CardTitle className="text-lg font-semibold text-slate-900">Define your operating lane</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateTrip}>
              <CountryProvinceSelector
                country={form.fromCountry}
                province={form.fromProvince}
                countryLabel="From country"
                provinceLabel="From province"
                onCountryChange={(value) =>
                  setForm((current) => ({ ...current, fromCountry: value }))
                }
                onProvinceChange={(value) =>
                  setForm((current) => ({ ...current, fromProvince: value }))
                }
              />

              <CountryProvinceSelector
                country={form.toCountry}
                province={form.toProvince}
                countryLabel="To country"
                provinceLabel="To province"
                onCountryChange={(value) =>
                  setForm((current) => ({ ...current, toCountry: value }))
                }
                onProvinceChange={(value) =>
                  setForm((current) => ({ ...current, toProvince: value }))
                }
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Truck type</Label>
                  <Select
                    value={form.truckType}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, truckType: value ?? '' }))
                    }
                  >
                    <SelectTrigger className="h-12 bg-white text-base">
                      <SelectValue placeholder="Choose truck type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRUCK_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {TRUCK_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity (kg)</Label>
                  <Input
                    value={form.capacityKg}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, capacityKg: event.target.value }))
                    }
                    placeholder="2000"
                    inputMode="decimal"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Available from</Label>
                  <Input
                    type="datetime-local"
                    value={form.availableFrom}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, availableFrom: event.target.value }))
                    }
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Available to</Label>
                  <Input
                    type="datetime-local"
                    value={form.availableTo}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, availableTo: event.target.value }))
                    }
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price per kg (USD)</Label>
                  <Input
                    value={form.pricePerKg}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, pricePerKg: event.target.value }))
                    }
                    placeholder="10"
                    inputMode="decimal"
                    className="h-12"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Route preview: {form.fromProvince || 'Start province'} (
                {getCountryName(getCountryCode(form.fromCountry))}) to{' '}
                {form.toProvince || 'Destination province'} (
                {getCountryName(getCountryCode(form.toCountry))})
              </div>

              <Button
                type="submit"
                className="h-11 rounded-full px-6"
                disabled={saving || Boolean(formValidationError)}
              >
                {saving ? 'Saving route...' : 'Save route'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="premium-card rounded-2xl border-slate-200 bg-white/95">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Step 2 • Mission Feed</p>
                <CardTitle className="text-lg font-semibold text-slate-900">Claim matching transport jobs</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadBoard(selectedTripId || undefined)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant={showPriorityOnly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowPriorityOnly((prev) => !prev)}
                >
                  <Compass className="h-3.5 w-3.5" />
                  Priority only
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <Label>Active route</Label>
                <Select
                  value={selectedTripId}
                  onValueChange={(value) => {
                    const nextTripId = value ?? '';
                    setSelectedTripId(nextTripId);
                    void loadBoard(nextTripId || undefined);
                  }}
                >
                  <SelectTrigger className="mt-2 h-11">
                    <SelectValue placeholder="Select saved route" />
                  </SelectTrigger>
                  <SelectContent>
                    {trips.map((trip) => (
                      <SelectItem key={trip.id} value={trip.id}>
                        {getCountryName(trip.from_country_code)} • {trip.from_province} to{' '}
                        {getCountryName(trip.to_country_code)} • {trip.to_province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTrip ? (
                <Badge
                  className={cn(
                    'border text-xs',
                    selectedTrip.status === 'active'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-100 text-slate-600',
                  )}
                >
                  {selectedTrip.status}
                </Badge>
              ) : null}
            </div>

            {selectedTrip ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {selectedTrip.from_province} to {selectedTrip.to_province} •{' '}
                {formatDateTime(selectedTrip.available_from)} to{' '}
                {formatDateTime(selectedTrip.available_to)} • $
                {Number(selectedTrip.price_per_kg).toFixed(2)}/kg
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search produce, route, or status"
                className="h-10"
              />
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
                <SelectTrigger className="h-10 w-40">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority first</SelectItem>
                  <SelectItem value="price">Highest price</SelectItem>
                  <SelectItem value="fresh">Newest</SelectItem>
                </SelectContent>
              </Select>
              <div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                ${Math.round(boardStats.projectedRevenue).toLocaleString()} pipeline
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-600">Loading jobs...</p>
            ) : filteredDeals.length === 0 ? (
              <p className="text-sm text-slate-600">
                No matching jobs yet for this route. Save another route or refresh later.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredDeals.map((deal) => (
                  <article
                    key={deal.id}
                    className={cn(
                      'rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)]',
                      deal.dispatchJob
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-slate-200 bg-slate-50',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {deal.shipment.produce_type} • {Number(deal.quantity_kg).toLocaleString()} kg
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {deal.dispatchJob ? (
                          <Badge className="border border-amber-200 bg-amber-100 text-amber-800">
                            Queue #{deal.dispatchJob.priority_rank} • {dispatchMinutesLeft(deal.dispatchJob.expires_at)}m left
                          </Badge>
                        ) : null}
                        <Badge className="border border-slate-200 bg-white text-slate-700">
                          {deal.status}
                        </Badge>
                      </div>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {deal.shipment.pickup_province} to {deal.demand.delivery_province}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Value ${Number(deal.agreed_price_usd).toFixed(2)} • Load {Math.round(Number(deal.quantity_kg)).toLocaleString()} kg
                      {deal.routeHint ? ` • ${deal.routeHint}` : ''}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleClaim(deal.id)}
                        disabled={
                          !selectedTripId ||
                          selectedTrip?.status !== 'active' ||
                          claimingDealId === deal.id
                        }
                        className="h-9 rounded-full px-4"
                      >
                        {claimingDealId === deal.id
                          ? 'Claiming...'
                          : selectedTrip?.status === 'active'
                            ? 'Claim job'
                            : 'Route not active'}
                      </Button>
                      <Link href="/deals">
                        <Button type="button" variant="outline" className="h-9 rounded-full px-4">
                          Open deals
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="premium-surface rounded-2xl px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold text-slate-900">Execution advice</p>
          </div>
          <p className="text-xs text-slate-600">
            Claim queue jobs first, then fill remaining capacity with non-priority loads to maximize utilization.
          </p>
        </div>
      </section>
    </main>
  );
}
