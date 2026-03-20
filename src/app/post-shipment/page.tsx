'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
// Icons managed by child components
import { createShipmentOffer } from '@/app/actions/shipments';
import CountryProvinceSelector from '@/components/CountryProvinceSelector';
import FormProgressCard from '@/components/FormProgressCard';
import MapPicker from '@/components/MapPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isCloudinaryConfigured, uploadImageToCloudinary } from '@/lib/client/cloudinary';
import { PRODUCE_TYPES, TEMP_OPTIONS, TEMP_OPTION_LABELS } from '@/lib/cambodia';
import { DEFAULT_COUNTRY, getCountryCode } from '@/lib/locations';

const schema = z.object({
  produce_type: z.string().min(2, 'Select a produce type.'),
  quantity_kg: z.string().min(1, 'Enter the quantity in kg.'),
  product_image_url: z.string().url().optional().or(z.literal('')),
  product_image_public_id: z.string().optional().or(z.literal('')),
  pickup_province: z.string().min(2, 'Select the pickup province.'),
  temp_required: z.string().min(2, 'Select the temperature requirement.'),
  deadline: z.string().min(1, 'Choose a shipment deadline.'),
  pickup_lat: z.string().min(1, 'Select a pickup location on the map.'),
  pickup_lng: z.string().min(1, 'Select a pickup location on the map.'),
});

type ShipmentFormValues = z.infer<typeof schema>;
const SHIPMENT_DRAFT_KEY = 'freshhaul:draft:post-shipment:v1';

export default function PostShipmentPage() {
  const router = useRouter();
  const { control, register, handleSubmit, setValue, reset, getValues } = useForm<ShipmentFormValues>({
    defaultValues: {
      produce_type: '',
      quantity_kg: '',
      product_image_url: '',
      product_image_public_id: '',
      pickup_province: '',
      temp_required: '',
      deadline: '',
      pickup_lat: '',
      pickup_lng: '',
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [pickupCountry, setPickupCountry] = useState<string>(DEFAULT_COUNTRY);
  const draftHydratedRef = useRef(false);
  const draftValues = useWatch({ control });
  const produceType = useWatch({ control, name: 'produce_type' });
  const tempRequired = useWatch({ control, name: 'temp_required' });
  const pickupProvince = useWatch({ control, name: 'pickup_province' });
  const pickupLat = useWatch({ control, name: 'pickup_lat' });
  const pickupLng = useWatch({ control, name: 'pickup_lng' });
  const productImageUrl = useWatch({ control, name: 'product_image_url' });
  const initialLocation = pickupLat && pickupLng
    ? { lat: Number(pickupLat), lng: Number(pickupLng) }
    : undefined;
  const cloudinaryReady = isCloudinaryConfigured();
  const progressItems = [
    { label: 'Produce type', complete: Boolean(draftValues.produce_type?.trim()) },
    { label: 'Amount (kg)', complete: Boolean(draftValues.quantity_kg?.trim()) },
    { label: 'Cooling need', complete: Boolean(draftValues.temp_required?.trim()) },
    { label: 'Pickup province', complete: Boolean(draftValues.pickup_province?.trim()) },
    { label: 'Pickup deadline', complete: Boolean(draftValues.deadline?.trim()) },
    { label: 'Pickup location (lat/lng)', complete: Boolean(draftValues.pickup_lat?.trim() && draftValues.pickup_lng?.trim()) },
  ];
  const isFormReady = progressItems.every((item) => item.complete);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(SHIPMENT_DRAFT_KEY);
      if (!rawDraft) {
        draftHydratedRef.current = true;
        return;
      }

      const parsedDraft = JSON.parse(rawDraft) as Partial<ShipmentFormValues>;
      reset({ ...getValues(), ...parsedDraft });
    } catch {
      // Ignore broken local draft payload and continue with defaults.
    } finally {
      draftHydratedRef.current = true;
    }
  }, [getValues, reset]);

  useEffect(() => {
    if (!draftHydratedRef.current || submitting) {
      return;
    }

    window.localStorage.setItem(SHIPMENT_DRAFT_KEY, JSON.stringify(draftValues));
  }, [draftValues, submitting]);

  useEffect(() => {
    setImagePreviewUrl(productImageUrl || '');
  }, [productImageUrl]);

  const handleProductImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!cloudinaryReady) {
      setFormError('Image upload is not configured yet. Ask admin to set Cloudinary keys.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFormError('Please choose an image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image is too large. Keep it under 5MB.');
      return;
    }

    setFormError('');
    setImageUploading(true);
    try {
      const upload = await uploadImageToCloudinary(file);
      setValue('product_image_url', upload.secureUrl, { shouldValidate: true });
      setValue('product_image_public_id', upload.publicId, { shouldValidate: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload product image.';
      setFormError(message);
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (imageUploading) {
      setFormError('Please wait for image upload to finish.');
      return;
    }
    setFormError('');
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Please complete the form.');
      return;
    }
    setSubmitting(true);
    const result = await createShipmentOffer({
      ...parsed.data,
      pickup_country_code: getCountryCode(pickupCountry),
      deadline: new Date(parsed.data.deadline),
    });
    setSubmitting(false);
    if (!result.success) {
      setFormError(result.error ?? 'Failed to post shipment offer.');
      return;
    }
    window.localStorage.removeItem(SHIPMENT_DRAFT_KEY);
    router.push('/marketplace?created=shipment');
  });

  return (
    <div className="page-shell space-y-7 py-8">
      <section className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Farmer shipment</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Publish your produce</h1>
        <p className="text-sm text-slate-500">Add details, cooling requirement, pickup location, then publish.</p>
      </section>

      <Card className="premium-card overflow-hidden">
        <CardContent className="space-y-8 p-6 lg:p-10">
          <FormProgressCard title="Shipment completion" items={progressItems} />
          <form id="post-shipment-form" className="premium-surface space-y-6 rounded-[1.5rem] p-5 sm:p-8" onSubmit={onSubmit}>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="pl-1 text-slate-700 font-semibold">Produce</Label>
                <Select value={produceType} onValueChange={(value) => { if (value) setValue('produce_type', value); }}>
                  <SelectTrigger><SelectValue placeholder="Choose produce" /></SelectTrigger>
                  <SelectContent>{PRODUCE_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2.5"><Label className="pl-1 text-slate-700 font-semibold">Amount (kg)</Label><Input type="number" min="0" step="0.01" {...register('quantity_kg')} /></div>
            </div>

            <div className="space-y-2.5">
              <Label className="pl-1 text-slate-700 font-semibold">Product photo (optional)</Label>
              <Input type="file" accept="image/*" className="h-12 bg-white text-base file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-1.5 file:text-sm file:font-bold file:text-slate-800" onChange={handleProductImageChange} />
              {imageUploading ? <p className="text-sm text-slate-500">Uploading image...</p> : null}
              {imagePreviewUrl ? (
                <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                  <Image src={imagePreviewUrl} alt="Uploaded produce" width={960} height={360} className="h-40 w-full rounded-xl object-cover" />
                </div>
              ) : null}
            </div>

            <div className="space-y-2.5">
              <Label className="pl-1 text-slate-700 font-semibold">Cooling need</Label>
              <Select value={tempRequired} onValueChange={(value) => { if (value) setValue('temp_required', value, { shouldValidate: true }); }}>
                <SelectTrigger><SelectValue placeholder="Choose cooling need" /></SelectTrigger>
                <SelectContent>{TEMP_OPTIONS.map((item) => <SelectItem key={item} value={item}>{TEMP_OPTION_LABELS[item]}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <CountryProvinceSelector
              country={pickupCountry}
              province={pickupProvince}
              countryLabel="Pickup country"
              provinceLabel="Pickup province"
              onCountryChange={setPickupCountry}
              onProvinceChange={(province) => setValue('pickup_province', province, { shouldValidate: true })}
            />
            <p className="text-sm text-slate-500 pl-1">Province options update automatically when country changes.</p>

            <div className="space-y-2.5"><Label className="pl-1 text-slate-700 font-semibold">Pickup deadline</Label><Input type="datetime-local" {...register('deadline')} /></div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="pl-1 text-slate-700 font-semibold">Latitude</Label>
                <Input
                  className="bg-slate-100/50 font-mono text-sm shadow-none focus-visible:ring-0 cursor-not-allowed"
                  placeholder="Captured from the map"
                  readOnly
                  {...register('pickup_lat')}
                />
              </div>
              <div className="space-y-2.5">
                <Label className="pl-1 text-slate-700 font-semibold">Longitude</Label>
                <Input
                  className="bg-slate-100/50 font-mono text-sm shadow-none focus-visible:ring-0 cursor-not-allowed"
                  placeholder="Captured from the map"
                  readOnly
                  {...register('pickup_lng')}
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label className="pl-1 text-base font-bold text-slate-900">Pickup location on map</Label>
              <MapPicker
                minimal
                initialLocation={initialLocation}
                onLocationSelect={(lat, lng) => {
                  setFormError('');
                  setValue('pickup_lat', String(lat), { shouldValidate: true });
                  setValue('pickup_lng', String(lng), { shouldValidate: true });
                }}
              />
              <p className="text-sm text-slate-500 pl-1">Tap the map once to capture coordinates automatically.</p>
            </div>

            {formError ? (
              <Notice tone="danger" className="text-base">{formError}</Notice>
            ) : null}
            <div className="pt-4">
              <Button type="submit" size="lg" className="h-11 w-full text-sm font-bold shadow-lg" disabled={submitting || imageUploading || !isFormReady}>{submitting ? 'Saving produce...' : 'Save produce now'}</Button>
            </div>
            <input type="hidden" {...register('product_image_url')} />
            <input type="hidden" {...register('product_image_public_id')} />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

