import Link from 'next/link';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { updateTripStatus } from '@/app/actions/matches';
import DealLifecycleTimeline from '@/components/DealLifecycleTimeline';
import TripHandoffChecklist from '@/components/TripHandoffChecklist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCountryName } from '@/lib/locations';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { findAccessibleTransportDeal } from '@/lib/server/logistics';

const ChatWindow = dynamic(() => import('@/components/ChatWindow'), {
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-[1.75rem] border border-slate-200 bg-slate-50 text-sm text-slate-500">
      Loading chat...
    </div>
  ),
});

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const context = await getCurrentUserContext();

  if (!context) {
    redirect('/auth/login');
  }

  const deal = await findAccessibleTransportDeal(resolvedParams.id, context.authUser.id);
  if (!deal) {
    redirect('/deals');
  }

  const tripDeal = deal;
  const match = tripDeal.matches[0];
  const isBuyerParticipant = context.authUser.id === tripDeal.buyer_id;
  const isFarmerParticipant = context.authUser.id === tripDeal.farmer_id;
  const isAssignedDriver = Boolean(match && context.authUser.id === match.driver_id);

  async function startDeliveryAction() {
    'use server';
    await updateTripStatus(tripDeal.id, 'in_transit');
  }

  async function completeDeliveryAction() {
    'use server';
    await updateTripStatus(tripDeal.id, 'completed');
  }

  return (
    <div className="page-shell space-y-6">
      <section className="space-y-3">
        <Badge variant="outline" className="bg-sky-50 text-sky-700">{tripDeal.status}</Badge>
        <h1 className="section-heading">{tripDeal.shipment.produce_type} | {Number(tripDeal.quantity_kg)} kg</h1>
        <p className="section-subtitle">
          Drive from {tripDeal.shipment.pickup_province}, {getCountryName(tripDeal.shipment.pickup_country_code)} to {tripDeal.demand.delivery_province}, {getCountryName(tripDeal.demand.delivery_country_code)}.
        </p>
        <DealLifecycleTimeline dealStatus={tripDeal.status} hasDriver={Boolean(match)} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="step-card">
          <div className="step-number">1</div>
          <h2 className="mt-4 text-lg font-semibold text-slate-950">Talk to the farmer</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use the transport chat below to confirm pickup time and place.</p>
        </div>
        <div className="step-card">
          <div className="step-number">2</div>
          <h2 className="mt-4 text-lg font-semibold text-slate-950">Start the trip</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Press start when the produce is picked up and the delivery is moving.</p>
        </div>
        <div className="step-card">
          <div className="step-number">3</div>
          <h2 className="mt-4 text-lg font-semibold text-slate-950">Finish the trip</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Press complete after the produce reaches the buyer.</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card className="border-slate-200/90 bg-white">
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="stat-tile bg-gradient-to-b from-white to-sky-50/30">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Buyer</p>
                  <p className="mt-2 font-semibold text-slate-950">
                    <Link href={`/users/${tripDeal.buyer_id}`} className="underline-offset-2 hover:underline">
                      {tripDeal.buyer?.name}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{tripDeal.buyer?.phone}</p>
                </div>
                <div className="stat-tile bg-gradient-to-b from-white to-emerald-50/30">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Farmer</p>
                  <p className="mt-2 font-semibold text-slate-950">
                    <Link href={`/users/${tripDeal.farmer_id}`} className="underline-offset-2 hover:underline">
                      {tripDeal.farmer?.name}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{tripDeal.farmer?.phone}</p>
                </div>
              </div>

              {match && (
                <div className="panel-muted p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Assigned driver</p>
                  <p className="mt-2 font-semibold text-slate-950">
                    <Link href={`/users/${match.driver_id}`} className="underline-offset-2 hover:underline">
                      {match.driver?.name}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{match.driver?.phone}</p>
                  <p className="mt-1 text-sm text-slate-600">Commission {match.commission_percent}%</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {tripDeal.status === 'transport_pending' && (
                  <form action={startDeliveryAction}>
                    <Button type="submit" className="h-12 px-6 text-base">Start trip</Button>
                  </form>
                )}
                {tripDeal.status === 'in_transit' && (
                  <form action={completeDeliveryAction}>
                    <Button type="submit" className="h-12 px-6 text-base">Finish trip</Button>
                  </form>
                )}
                {match && (
                  <Link href={`/payment?deal=${tripDeal.id}`} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-all hover:-translate-y-0.5 hover:bg-slate-50">
                    Open payment
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          <TripHandoffChecklist dealId={tripDeal.id} />
        </div>

        <div className="space-y-6">
          {(isBuyerParticipant || isFarmerParticipant) && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Commercial coordination</p>
                <p className="mt-1 text-sm text-slate-600">Buyer and farmer use this thread for price, quantity, and order confirmation.</p>
              </div>
              <ChatWindow title="Buyer and Farmer" dealId={tripDeal.id} />
            </div>
          )}
          {match && (isAssignedDriver || isFarmerParticipant) && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-700">Transport coordination</p>
                <p className="mt-1 text-sm text-emerald-900">Farmer and driver use this thread for pickup timing, route coordination, and delivery updates.</p>
              </div>
              <ChatWindow title="Farmer and Driver" matchId={match.id} />
            </div>
          )}
          {!match && isFarmerParticipant && (
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.48)]">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Transport coordination</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">No driver assigned yet</h2>
              <p className="mt-2 text-sm text-slate-600">
                The farmer-driver chat will appear here after a driver claims this route from the trip board.
              </p>
              <div className="mt-4">
                <Link href="/browse-trips" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-all hover:-translate-y-0.5 hover:bg-slate-50">
                  Open trip board
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
