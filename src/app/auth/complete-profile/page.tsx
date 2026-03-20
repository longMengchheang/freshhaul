'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { completeCurrentUserProfile } from '@/app/actions/users';
import CountryProvinceSelector from '@/components/CountryProvinceSelector';
import { DEFAULT_COUNTRY, getCountryCode } from '@/lib/locations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';

export default function CompleteProfilePage() {
  const { session, profile, loading } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const [province, setProvince] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      window.location.replace('/auth/login');
      return;
    }
    if (profile) {
      window.location.replace('/dashboard');
    }
  }, [loading, profile, session]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const result = await completeCurrentUserProfile({
      name,
      phone,
      country_code: getCountryCode(country),
      province,
    });
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to save profile');
      return;
    }

    window.location.replace('/dashboard');
  };

  return (
    <div className="page-shell">
      <div className="grid min-h-[calc(100vh-10rem)] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Card className="border-slate-200 bg-slate-950 text-white">
          <CardContent className="space-y-4 p-8 sm:p-10">
            <Badge className="bg-white/10 text-white">Profile required</Badge>
            <h1 className="text-4xl font-semibold tracking-tight">Complete your business profile to continue.</h1>
            <p className="text-base leading-8 text-white/72">
              Your account is signed in, but the upgraded marketplace database needs a matching base profile row before protected pages can load.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="space-y-4">
            <Badge variant="outline">Finish setup</Badge>
            <CardTitle className="text-3xl font-semibold tracking-tight">Profile details</CardTitle>
            <CardDescription>This creates your base buyer-enabled account. Farmer and driver access can be requested after setup.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={session?.user.email ?? ''} disabled className="h-11 bg-slate-50 text-slate-500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 bg-white" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 bg-white" required />
                </div>
              </div>
              <CountryProvinceSelector
                country={country}
                province={province}
                onCountryChange={setCountry}
                onProvinceChange={setProvince}
                countryPlaceholder="Select country"
                provincePlaceholder="Select province"
                size="sm"
              />

              {error && <Notice tone="danger">{error}</Notice>}

              <Button type="submit" className="h-11 w-full" disabled={saving || !province}>
                {saving ? 'Saving profile...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
