'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createUserProfile } from '@/app/actions/users';
import CountryProvinceSelector from '@/components/CountryProvinceSelector';
import { DEFAULT_COUNTRY } from '@/lib/locations';
import { getCountryCode } from '@/lib/locations';
import { createClient, getClientEnvError } from '@/utils/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';

export default function RegisterPage() {
  const { session } = useAuth();
  const [supabase] = useState(() => createClient());

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<string>(DEFAULT_COUNTRY);
  const [province, setProvince] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const configError = !supabase ? getClientEnvError() : null;

  useEffect(() => {
    if (session) {
      window.location.replace('/dashboard');
    }
  }, [session]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    if (!supabase) {
      setError(configError ?? 'Supabase is not configured.');
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, phone, province, country_code: getCountryCode(country) },
        },
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        const profileRes = await createUserProfile({
          id: authData.user.id,
          name,
          phone,
          country_code: getCountryCode(country),
          province,
        });
        if (!profileRes.success) {
          throw new Error('Failed to create profile');
        }

        if (authData.session) {
          window.location.replace('/dashboard');
        } else {
          window.location.replace('/auth/login?registered=true');
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="grid min-h-[calc(100vh-10rem)] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Card className="border-slate-200 bg-slate-950 text-white">
          <CardContent className="space-y-4 p-8 sm:p-10">
            <Badge className="bg-white/10 text-white">Create account</Badge>
            <h1 className="text-4xl font-semibold tracking-tight">Create one account and unlock more capabilities over time.</h1>
            <p className="text-base leading-8 text-white/70">
              Every new account starts with buyer access. Farmer and driver capabilities can be requested later from the dashboard and reviewed separately.
            </p>
            <div className="grid gap-3 pt-2">
              {[
                { icon: ShoppingBasket, title: 'Buyer access is immediate', text: 'Browse produce, post demand, and manage deals as soon as you complete signup.' },
                { icon: Sprout, title: 'Farmer access is reviewed', text: 'Apply later when you are ready to post shipment supply into the marketplace.' },
                { icon: Truck, title: 'Driver access is reviewed', text: 'Apply later to publish routes and claim cold-chain transport jobs.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/70">{text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader className="space-y-4">
            <Badge variant="outline">Register</Badge>
            <CardTitle className="text-3xl font-semibold tracking-tight">Base business profile</CardTitle>
            <CardDescription>Fill only the basic details. You can request extra roles later.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-white" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 bg-white" required />
              </div>
              <CountryProvinceSelector
                country={country}
                province={province}
                onCountryChange={setCountry}
                onProvinceChange={setProvince}
                countryPlaceholder="Select country"
                provincePlaceholder="Select province"
              />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-white" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-white" required />
              </div>

              {error && <Notice tone="danger">{error}</Notice>}
              {configError && <Notice tone="warning">{configError}</Notice>}

              <Button type="submit" className="h-12 w-full text-lg font-semibold" disabled={loading || !province || Boolean(configError)}>
                {loading ? 'Creating account...' : 'Create account'}
              </Button>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link href="/auth/login" className="font-semibold text-primary hover:text-primary/80">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
