'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { Camera, UserRound } from 'lucide-react';
import { z } from 'zod';
import { updateCurrentUserProfile } from '@/app/actions/users';
import CountryProvinceSelector from '@/components/CountryProvinceSelector';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { isCloudinaryConfigured, uploadImageToCloudinary } from '@/lib/client/cloudinary';
import { COUNTRY_OPTIONS, getCountryName, getCountryCode, type SupportedCountry } from '@/lib/locations';
import type { AppUserProfile } from '@/types/app';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  phone: z.string().trim().min(6, 'Phone must be at least 6 characters.').max(30),
  province: z.string().trim().min(2, 'Select a province.').max(120),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileCrudCard({
  profile,
  email,
}: {
  profile: AppUserProfile;
  email?: string | null;
}) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [country, setCountry] = useState(getCountryName(profile.country_code));
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; message: string } | null>(null);
  const { register, setValue, handleSubmit, control } = useForm<ProfileFormValues>({
    defaultValues: {
      name: profile.name,
      phone: profile.phone,
      province: profile.province,
    },
  });
  const province = useWatch({ control, name: 'province' });
  const cloudinaryReady = isCloudinaryConfigured();

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setNotice({ tone: 'danger', message: 'Image must be under 5 MB.' });
      return;
    }

    setAvatarUploading(true);
    setNotice(null);
    try {
      const upload = await uploadImageToCloudinary(file, 'freshhaul/avatars');
      setAvatarUrl(upload.secureUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload avatar.';
      setNotice({ tone: 'danger', message });
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setNotice(null);
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) {
      setNotice({ tone: 'danger', message: parsed.error.issues[0]?.message ?? 'Please check profile fields.' });
      return;
    }

    setSaving(true);
    const result = await updateCurrentUserProfile({
      name: parsed.data.name,
      phone: parsed.data.phone,
      avatar_url: avatarUrl,
      province: parsed.data.province,
      country_code: getCountryCode(country),
    });
    setSaving(false);

    if (!result.success) {
      setNotice({ tone: 'danger', message: result.error ?? 'Failed to update profile.' });
      return;
    }

    await refreshProfile();
    router.refresh();
    setNotice({ tone: 'success', message: 'Profile updated successfully.' });
  });

  return (
    <Card className="premium-card h-full overflow-hidden rounded-[1.9rem]">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-3xl font-bold tracking-tight text-slate-950">Profile details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        <div className="premium-surface rounded-[1.5rem] p-6 text-sm text-slate-700">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={profile.name} width={64} height={64} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <UserRound className="h-7 w-7" />
                  </div>
                )}
              </div>
              {cloudinaryReady && (
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-sm transition-all duration-150 hover:bg-slate-700 disabled:opacity-50"
                >
                  <Camera className="h-3 w-3" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900">{profile.name}</p>
              <p className="mt-0.5 font-medium">{email ?? 'Not available'}</p>
              <p className="mt-0.5 font-medium text-slate-500">{profile.province}, {getCountryName(profile.country_code)}</p>
            </div>
          </div>
          {avatarUploading && <p className="mt-3 text-xs font-medium text-slate-400">Uploading photo...</p>}
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input className="h-12 bg-slate-50 text-base text-slate-600" value={email ?? ''} readOnly />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input className="h-12 bg-white text-base" {...register('name')} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input className="h-12 bg-white text-base" {...register('phone')} />
            </div>
          </div>
          <CountryProvinceSelector
            country={country}
            province={province}
            onCountryChange={(nextCountry) => {
              if (COUNTRY_OPTIONS.includes(nextCountry as SupportedCountry)) {
                setCountry(nextCountry as SupportedCountry);
              }
            }}
            onProvinceChange={(value) => setValue('province', value, { shouldValidate: true })}
          />
          {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}
          <Button type="submit" disabled={saving} className="h-11 w-full md:w-auto rounded-full px-8 text-sm font-bold shadow-sm">
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
