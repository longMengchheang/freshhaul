import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { getMyDisputesAction } from '@/app/actions/disputes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function statusTone(status: string) {
  if (status === 'resolved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'under_review') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default async function DisputesPage() {
  const context = await getCurrentUserContext();
  if (!context) {
    redirect('/auth/login');
  }

  const result = await getMyDisputesAction();
  const disputes = result.success && Array.isArray(result.data) ? result.data : [];

  return (
    <main className="page-shell !max-w-[1100px] space-y-6 py-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Dispute center</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">Transport and settlement disputes</h1>
            <p className="mt-2 text-sm text-slate-600">Track open issues and review automated resolution signals.</p>
          </div>
          <Link href="/deals">
            <Button type="button" variant="outline">Back to deals</Button>
          </Link>
        </div>
      </section>

      {disputes.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200 bg-white">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-slate-700">No disputes yet.</p>
            <p className="mt-1 text-sm text-slate-500">Open a dispute from a deal when handoff issues or payment conflicts appear.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {disputes.map((dispute) => (
            <Card key={dispute.id} className="rounded-2xl border border-slate-200 bg-white">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold text-slate-900">Deal {dispute.dealId}</CardTitle>
                  <Badge className={`border ${statusTone(dispute.status)}`}>{dispute.status.replace('_', ' ')}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <p className="text-sm text-slate-700">{dispute.reason}</p>
                <p className="text-xs text-slate-500">
                  Opened {new Date(dispute.createdAt).toLocaleString()} | Updated {new Date(dispute.updatedAt).toLocaleString()}
                </p>
                {dispute.autoResolution ? (
                  <p className="text-xs text-slate-600">
                    Auto signal: {dispute.autoResolution} ({Math.round(dispute.autoConfidence ?? 0)}%)
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}

