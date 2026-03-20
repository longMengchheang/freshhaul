'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { createBuyerDemand } from '@/app/actions/demands';
import CountryProvinceSelector from '@/components/CountryProvinceSelector';
import FormProgressCard from '@/components/FormProgressCard';
import MapPicker from '@/components/MapPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCE_TYPES } from '@/lib/cambodia';
import { DEFAULT_COUNTRY, getCountryCode } from '@/lib/locations';

const schema = z.object({
  produce_type: z.string().min(2, 'Select a produce type.'),
  quantity_kg: z.string().min(1, 'Enter the quantity in kg.'),
  max_price_usd: z.string().min(1, 'Enter the maximum price in USD.'),
  delivery_province: z.string().min(2, 'Select the delivery province.'),
  deadline: z.string().min(1, 'Choose a delivery deadline.'),
  delivery_lat: z.string().min(1, 'Select a delivery location on the map.'),
  delivery_lng: z.string().min(1, 'Select a delivery location on the map.'),
});

type DemandFormValues = z.infer<typeof schema>;
const DEMAND_DRAFT_KEY = 'freshhaul:draft:post-demand:v1';

export default function PostDemandPage() {
  const router = useRouter();
  const { control, register, handleSubmit, setValue, reset, getValues } = useForm<DemandFormValues>({
    defaultValues: { produce_type: '', quantity_kg: '', max_price_usd: '', delivery_province: '', deadline: '', delivery_lat: '', delivery_lng: '' },
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState<string>(DEFAULT_COUNTRY);
  const draftHydratedRef = useRef(false);
  const draftValues = useWatch({ control });
  const produceType = useWatch({ control, name: 'produce_type' });
  const deliveryProvince = useWatch({ control, name: 'delivery_province' });
  const deliveryLat = useWatch({ control, name: 'delivery_lat' });
  const deliveryLng = useWatch({ control, name: 'delivery_lng' });
  const initialLocation = deliveryLat && deliveryLng
    ? { lat: Number(deliveryLat), lng: Number(deliveryLng) }
    : undefined;
  const progressItems = [
    { label: 'Produce type', complete: Boolean(draftValues.produce_type?.trim()) },
    { label: 'Amount (kg)', complete: Boolean(draftValues.quantity_kg?.trim()) },
    { label: 'Max price (USD)', complete: Boolean(draftValues.max_price_usd?.trim()) },
    { label: 'Delivery province', complete: Boolean(draftValues.delivery_province?.trim()) },
    { label: 'Deadline', complete: Boolean(draftValues.deadline?.trim()) },
    { label: 'Delivery location (lat/lng)', complete: Boolean(draftValues.delivery_lat?.trim() && draftValues.delivery_lng?.trim()) },
  ];
  const isFormReady = progressItems.every((item) => item.complete);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(DEMAND_DRAFT_KEY);
      if (!rawDraft) {
        draftHydratedRef.current = true;
        return;
      }

      const parsedDraft = JSON.parse(rawDraft) as Partial<DemandFormValues>;
      reset({ ...getValues(), ...parsedDraft });
    } catch {
      // Ignore malformed local draft payload and continue with defaults.
    } finally {
      draftHydratedRef.current = true;
    }
  }, [getValues, reset]);

  useEffect(() => {
    if (!draftHydratedRef.current || submitting) {
      return;
    }

    window.localStorage.setItem(DEMAND_DRAFT_KEY, JSON.stringify(draftValues));
  }, [draftValues, submitting]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please complete the form.');
      return;
    }
    setSubmitting(true);
    const result = await createBuyerDemand({
      ...parsed.data,
      delivery_country_code: getCountryCode(deliveryCountry),
      deadline: new Date(parsed.data.deadline),
    });
    setSubmitting(false);
    if (!result.success) {
      setFormError(result.error ?? 'Failed to post demand.');
      return;
    }
    window.localStorage.removeItem(DEMAND_DRAFT_KEY);
    router.push('/marketplace?created=demand');
  });

  return (
    <div className="page-shell space-y-8 pb-24 sm:pb-8 max-w-5xl mx-auto">
      <section className="space-y-1 text-center mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">Buyer demand</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Post what produce you need</h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto">Choose the produce, amount, price, and delivery location.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="step-card">
          <div className="step-number">1</div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">Produce and amount</h2>
          <p className="mt-1 text-sm text-slate-600">Select what you need and how many kilograms.</p>
        </div>
        <div className="step-card">
          <div className="step-number">2</div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">Price and place</h2>
          <p className="mt-1 text-sm text-slate-600">Enter max price and choose delivery location.</p>
        </div>
        <div className="step-card">
          <div className="step-number">3</div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">Save demand</h2>
          <p className="mt-1 text-sm text-slate-600">Published to marketplace for farmers to match.</p>
        </div>
      </section>

      <Card className="border-0 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] bg-white/95 sm:rounded-[2rem] overflow-hidden mt-2">
        <CardContent className="grid gap-8 p-6 lg:grid-cols-[0.92fr_1.08fr] lg:p-8">
          <div className="space-y-6">
            <FormProgressCard title="Demand completion" items={progressItems} />
            <form id="post-demand-form" className="space-y-5 rounded-[1.5rem] border-0 bg-slate-50/60 p-5 sm:p-6 ring-1 ring-slate-200/50" onSubmit={onSubmit}>
            <div className="space-y-2.5">
              <Label className="pl-1 text-slate-700 font-semibold">Produce</Label>
              <Select value={produceType} onValueChange={(value) => { if (value) setValue('produce_type', value); }}>
                <SelectTrigger><SelectValue placeholder="Choose produce" /></SelectTrigger>
                <SelectContent>{PRODUCE_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2.5"><Label className="pl-1 text-slate-700 font-semibold">Amount (kg)</Label><Input type="number" min="0" step="0.01" {...register('quantity_kg')} /></div>
              <div className="space-y-2.5"><Label className="pl-1 text-slate-700 font-semibold">Max price (USD)</Label><Input type="number" min="0" step="0.01" {...register('max_price_usd')} /></div>
            </div>
            <CountryProvinceSelector
              country={deliveryCountry}
              province={deliveryProvince}
              countryLabel="Delivery country"
              provinceLabel="Delivery province"
              onCountryChange={setDeliveryCountry}
              onProvinceChange={(province) => setValue('delivery_province', province, { shouldValidate: true })}
            />
            <p className="text-sm text-slate-500 pl-1">Province options update automatically when country changes.</p>
            <div className="space-y-2.5"><Label className="pl-1 text-slate-700 font-semibold">Delivery deadline</Label><Input type="datetime-local" {...register('deadline')} /></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="pl-1 text-slate-700 font-semibold">Latitude</Label>
                <Input
                  className="bg-slate-100/50 font-mono text-sm shadow-none focus-visible:ring-0 cursor-not-allowed"
                  placeholder="Captured from the map"
                  readOnly
                  {...register('delivery_lat')}
                />
              </div>
              <div className="space-y-2.5">
                <Label className="pl-1 text-slate-700 font-semibold">Longitude</Label>
                <Input
                  className="bg-slate-100/50 font-mono text-sm shadow-none focus-visible:ring-0 cursor-not-allowed"
                  placeholder="Captured from the map"
                  readOnly
                  {...register('delivery_lng')}
                />
              </div>
            </div>
            {formError ? (
              <Notice tone="danger" className="text-base">{formError}</Notice>
            ) : null}
            <div className="pt-2">
              <Button type="submit" size="lg" className="w-full text-base font-bold shadow-lg" disabled={submitting || !isFormReady}>{submitting ? 'Saving demand...' : 'Save demand now'}</Button>
            </div>
            </form>
          </div>

          <div className="space-y-4 rounded-[1.5rem] border-0 bg-slate-50/60 p-5 sm:p-6 ring-1 ring-slate-200/50 h-fit">
            <div className="space-y-1 pl-1">
              <p className="text-lg font-bold tracking-tight text-slate-950">Delivery location</p>
              <p className="text-sm font-medium leading-relaxed text-slate-500">Search, use your current location, or tap the map to mark the delivery place.</p>
            </div>
            <MapPicker
              size="compact"
              initialLocation={initialLocation}
              onLocationSelect={(lat, lng) => {
                setFormError('');
                setValue('delivery_lat', String(lat), { shouldValidate: true });
                setValue('delivery_lng', String(lng), { shouldValidate: true });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.1)] backdrop-blur-md sm:hidden">
        <Button form="post-demand-form" type="submit" size="lg" className="w-full text-base font-bold shadow-lg" disabled={submitting || !isFormReady}>
          {submitting ? 'Saving demand...' : 'Save demand now'}
        </Button>
      </div>
    </div>
  );
}

