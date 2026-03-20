'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Snowflake, Truck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createClient, getClientEnvError } from '@/utils/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';

export default function LoginPage() {
  const { session } = useAuth();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('Invalid email or password');
      } else {
        window.location.replace('/dashboard');
      }
    } catch {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="grid min-h-[calc(100vh-10rem)] gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <Card className="order-2 border-slate-200 bg-white lg:order-1">
          <CardHeader className="space-y-4">
            <Badge variant="outline">Sign in</Badge>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-3xl font-semibold tracking-tight">Welcome back</CardTitle>
                <CardDescription className="mt-1 text-base">
                  Sign in and continue your work with simple, clear screens.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="name@freshhaul.app" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-white" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-white" required />
              </div>

              {error && <Notice tone="danger">{error}</Notice>}
              {configError && <Notice tone="warning">{configError}</Notice>}

              <Button type="submit" className="h-12 w-full text-lg font-semibold" disabled={loading || Boolean(configError)}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>

              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{' '}
                <Link href="/auth/register" className="font-semibold text-primary hover:text-primary/80">
                  Create one
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <Card className="order-1 border-slate-200 bg-slate-950 text-white lg:order-2">
          <CardContent className="space-y-6 p-8 sm:p-10">
            <Badge className="bg-white/10 text-white">FreshHaul</Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight">Clean operations for fresh produce logistics.</h1>
              <p className="text-base leading-8 text-white/70">
                Use one workspace for supply, demand, transport assignment, and payment summary.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { icon: Snowflake, title: 'Cold-chain aware', text: 'Transport and handling stay connected to the deal.' },
                { icon: ShieldCheck, title: 'Controlled approvals', text: 'Buyers, farmers, and drivers move through clear status steps.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex gap-3">
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
      </div>
    </div>
  );
}
