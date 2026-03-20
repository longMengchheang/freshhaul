'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getDealDetail } from '@/app/actions/deals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type BakongModule = {
  BakongKHQR: {
    new (): { generateIndividual(info: unknown): { data?: { qr: string } } };
    IndividualInfo: new (bakongAccountId: string, merchantName: string, merchantCity: string, optionalData: Record<string, unknown>) => unknown;
  };
  khqrData: {
    currency: { usd: string };
    language: { km: string };
  };
};

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dealId = searchParams.get('deal');
  const [qrString, setQrString] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success'>('pending');
  const [totalAmount, setTotalAmount] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);
  const [transportFee, setTransportFee] = useState(0);

  useEffect(() => {
    if (!dealId) {
      router.push('/deals');
      return;
    }

    let active = true;
    async function loadQr() {
      if (!dealId) return;
      const detail = await getDealDetail(dealId);
      if (!detail.success || !detail.data) {
        router.push('/deals');
        return;
      }

      const produceAmount = Number(detail.data.agreed_price_usd);
      const platform = produceAmount * 0.02;
      const transport = detail.data.matches[0] ? produceAmount * (Number(detail.data.matches[0].commission_percent) / 100) : 0;
      const total = produceAmount + platform + transport;

      if (active) {
        setPlatformFee(platform);
        setTransportFee(transport);
        setTotalAmount(total);
      }

      try {
        const { BakongKHQR, khqrData } = (await import('bakong-khqr')) as unknown as BakongModule;
        const optionalData = {
          currency: khqrData.currency.usd,
          amount: total,
          mobileNumber: '85512345678',
          storeLabel: 'FreshHaul Settlement',
          terminalLabel: `Deal-${dealId.substring(0, 6)}`,
          purposeOfTransaction: 'Marketplace settlement',
          languageData: {
            languagePreference: khqrData.language.km,
            merchantNameAlternateLanguage: 'FreshHaul',
            merchantCityAlternateLanguage: 'Phnom Penh',
          },
        };

        const individualInfo = new BakongKHQR.IndividualInfo('freshhaul@acleda', 'FreshHaul', 'Phnom Penh', optionalData);
        const khqr = new BakongKHQR();
        const response = khqr.generateIndividual(individualInfo);
        if (active && response.data?.qr) {
          setQrString(response.data.qr);
        }
      } catch (error) {
        console.error('Payment QR generation failed', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadQr();
    return () => { active = false; };
  }, [dealId, router]);

  if (!dealId) return null;

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-xl">
        {paymentStatus === 'success' ? (
          <Card className="border-slate-200 bg-white text-center">
            <CardHeader className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <Badge variant="outline" className="mx-auto">Payment complete</Badge>
              <CardTitle className="text-3xl font-semibold">Settlement recorded</CardTitle>
              <CardDescription>FreshHaul recorded the combined produce and transport settlement for this deal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="panel-muted p-4 text-left">
                <p className="text-sm text-slate-500">Deal reference</p>
                <p className="mt-2 font-mono text-sm text-slate-900">{dealId}</p>
              </div>
              <Link href={`/trip/${dealId}`} className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
                Return to workspace
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 bg-white">
            <CardHeader className="space-y-4 text-center">
              <Badge variant="outline" className="mx-auto">Bakong QR</Badge>
              <CardTitle className="text-3xl font-semibold">Settlement summary</CardTitle>
              <CardDescription>Marketplace and transport commissions are separated for clarity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="panel-muted p-5 text-center">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Total due</p>
                <p className="mt-2 text-4xl font-semibold text-slate-950">${totalAmount.toFixed(2)}</p>
              </div>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Marketplace amount</span><span className="font-medium text-slate-950">${(totalAmount - platformFee - transportFee).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Platform commission (2%)</span><span className="font-medium text-slate-950">${platformFee.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Transport commission</span><span className="font-medium text-slate-950">${transportFee.toFixed(2)}</span></div>
              </div>
              <div className="flex justify-center">
                {loading ? (
                  <div className="flex h-[250px] w-[250px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : qrString ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <QRCodeSVG value={qrString} size={250} level="M" includeMargin={false} />
                  </div>
                ) : (
                  <p className="text-sm text-red-600">Unable to generate payment QR.</p>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Demo settlement flow
              </div>
              <Button variant="outline" className="w-full" onClick={() => {
                setLoading(true);
                setTimeout(() => {
                  setPaymentStatus('success');
                  setLoading(false);
                }, 1500);
              }} disabled={loading}>
                Simulate payment
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="page-shell"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading payment...</div></div>}>
      <PaymentContent />
    </Suspense>
  );
}
