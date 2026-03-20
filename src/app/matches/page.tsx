import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { ACTION_LINK_PRIMARY, ACTION_LINK_SECONDARY } from '@/lib/client/action-classes';
import { getRiskTone, STATUS_TONES } from '@/lib/client/status-tones';
import { getCurrentAuthUser, getCurrentUserContext } from '@/lib/server/current-user';
import { listDealsForDriverMatchesCompact, listDealsForParticipantsCompact } from '@/lib/server/logistics';
import { getReliabilitySummary, getTransportRisk } from '@/lib/transport-intelligence';
import { hasActiveRole } from '@/lib/user-roles';
import type { DealWithDetails } from '@/types/app';

export const metadata: Metadata = {
  title: 'My Transport — FreshHaul',
};

function TransportRow({
  deal,
  mode,
}: {
  deal: DealWithDetails;
  mode: 'waiting' | 'assigned' | 'driver';
}) {
  const assignedDriver = deal.matches[0]?.driver ?? null;
  const risk = getTransportRisk(deal);

  return (
    <div className="border-0 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] bg-slate-50/60 ring-1 ring-slate-200/50 sm:rounded-[1.5rem] p-6 lg:p-8 transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] hover:bg-white">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone="neutral">{deal.status}</StatusBadge>
        <StatusBadge tone={risk.label === 'High' ? 'error' : risk.label === 'Medium' ? 'warning' : 'success'} className={getRiskTone(risk.label)}>
          Risk {risk.label}
        </StatusBadge>
        <span className="text-sm text-slate-500">
          {deal.shipment.pickup_province} to {deal.demand.delivery_province}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="text-lg font-semibold text-slate-950">
          {deal.shipment.produce_type} | {Number(deal.quantity_kg)} kg
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            Buyer
            {deal.buyer?.avatar_url ? <img src={deal.buyer.avatar_url} alt="" className="inline h-5 w-5 rounded-full object-cover" /> : null}
            <span className="font-medium text-slate-900">{deal.buyer?.name ?? 'Unknown'}</span>
          </span>
          <span>|</span>
          <span className="inline-flex items-center gap-1.5">
            Farmer
            {deal.farmer?.avatar_url ? <img src={deal.farmer.avatar_url} alt="" className="inline h-5 w-5 rounded-full object-cover" /> : null}
            <span className="font-medium text-slate-900">{deal.farmer?.name ?? 'Unknown'}</span>
          </span>
        </div>
        {mode === 'waiting' ? (
          <p className="text-sm text-slate-600">
            No driver has claimed this route yet. The transport chat will appear after assignment.
          </p>
        ) : assignedDriver ? (
          <p className="text-sm text-slate-600">
            Driver {assignedDriver.name} | {assignedDriver.phone}
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Driver assigned data is not available yet.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/trip/${deal.id}`}
          className="inline-flex h-10 w-fit items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 shadow-sm"
        >
          {mode === 'waiting' ? 'Open commercial workspace' : 'Open transport workspace'}
        </Link>
        {mode === 'waiting' ? (
          <Link
            href="/browse-trips"
            className="inline-flex h-10 w-fit items-center justify-center rounded-full bg-white border border-slate-200 px-6 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 hover:text-slate-950 shadow-sm"
          >
            Open trip board
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function MatchesPage() {
  const context = await getCurrentUserContext();

  if (!context) {
    const authUser = await getCurrentAuthUser();
    if (authUser) {
      redirect('/auth/complete-profile');
    }

    redirect('/auth/login');
  }

  if (context.systemRole === 'admin') {
    redirect('/admin');
  }

  const farmerActive = hasActiveRole(context.profile.roles, 'farmer');
  const driverActive = hasActiveRole(context.profile.roles, 'driver');

  if (!farmerActive && !driverActive) {
    return (
      <div className="page-shell space-y-6">
        <section className="space-y-3">
          <Badge variant="outline" className={STATUS_TONES.warning}>My transport</Badge>
          <h1 className="section-heading">Transport access is not active yet.</h1>
          <p className="section-subtitle max-w-3xl">
            Farmer or driver capability is required before transport coordination appears here.
          </p>
        </section>

        <Card className="border-slate-200/90 bg-white">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-slate-600">
              Request farmer access to manage shipment handoff, or driver access to claim and coordinate transport jobs.
            </p>
            <Link
              href="/profile"
              className={ACTION_LINK_PRIMARY}
            >
              Open profile
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [participantDeals, driverDeals] = await Promise.all([
    farmerActive ? listDealsForParticipantsCompact(context.authUser.id) : Promise.resolve([]),
    driverActive ? listDealsForDriverMatchesCompact(context.authUser.id) : Promise.resolve([]),
  ]);

  const farmerTransportDeals = participantDeals.filter(
    (deal) => deal.farmer_id === context.authUser.id && ['transport_pending', 'in_transit', 'completed'].includes(deal.status),
  );
  const waitingForDriver = farmerTransportDeals.filter((deal) => deal.status === 'transport_pending' && !deal.matches[0]);
  const farmerAssigned = farmerTransportDeals.filter((deal) => Boolean(deal.matches[0]) && deal.status !== 'completed');
  const farmerCompleted = farmerTransportDeals.filter((deal) => deal.status === 'completed');

  const driverAssigned = driverDeals.filter((deal) => deal.status !== 'completed');
  const driverCompleted = driverDeals.filter((deal) => deal.status === 'completed');
  const farmerReliability = getReliabilitySummary(farmerTransportDeals);
  const driverReliability = getReliabilitySummary(driverDeals);
  const driverReadyToStart = driverAssigned.find((deal) => deal.status === 'transport_pending') ?? null;
  const driverOnTheWay = driverAssigned.find((deal) => deal.status === 'in_transit') ?? null;
  const driverDayActionDeal = driverReadyToStart ?? driverOnTheWay ?? null;

  return (
    <div className="page-shell space-y-8 max-w-6xl mx-auto pb-12">
      <section className="space-y-1 text-center mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">Transport</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">My transport</h1>
        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          Farmers see driver assignments. Drivers open claimed jobs.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {farmerActive ? (
          <>
            <Card className="border-0 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.5rem] bg-white">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Waiting for driver</p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{waitingForDriver.length}</p>
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-500">Accepted sales that still need a driver.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.5rem] bg-white">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Assigned transport</p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{farmerAssigned.length}</p>
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-500">Farmer deliveries that already have a driver.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.5rem] bg-white">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Farmer reliability</p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{farmerReliability.completionRate}%</p>
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-500">
                  {farmerReliability.stalledRate}% stalled transport in current history.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}

        {driverActive ? (
          <>
            <Card className="border-0 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.5rem] bg-white">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Driver active jobs</p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{driverAssigned.length}</p>
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-500">Jobs currently assigned to you.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.5rem] bg-white">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Completed transport</p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{(farmerActive ? farmerCompleted.length : 0) + driverCompleted.length}</p>
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-500">Transport jobs that are already finished.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-slate-100 sm:rounded-[1.5rem] bg-white">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Driver reliability</p>
                <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{driverReliability.completionRate}%</p>
                <p className="mt-2.5 text-sm font-medium leading-relaxed text-slate-500">
                  {driverReliability.activeRate}% currently active transport workload.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </section>

      {farmerActive ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Farmer transport</h2>
              <p className="text-sm text-slate-500">See which accepted sales still need a driver and which ones are already moving.</p>
            </div>
            <Link
              href="/browse-trips"
              className={ACTION_LINK_SECONDARY}
            >
              Open trip board
            </Link>
          </div>

          <div className="grid gap-8 xl:grid-cols-2 pt-2">
            <Card className="border-0 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] bg-white/95 sm:rounded-[2rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50 shadow-sm">Waiting for driver</Badge>
                <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-slate-950">Still waiting</CardTitle>
                <CardDescription className="text-base text-slate-500">A driver must claim these routes before transport chat can begin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-8 pb-8">
                {waitingForDriver.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-8 text-center text-sm font-medium text-slate-500">
                    No accepted farmer deals are waiting for a driver right now.
                  </div>
                ) : (
                  waitingForDriver.map((deal) => <TransportRow key={`waiting-${deal.id}`} deal={deal} mode="waiting" />)
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] bg-white/95 sm:rounded-[2rem] overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50 shadow-sm">Assigned transport</Badge>
                <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-slate-950">Ready to coordinate</CardTitle>
                <CardDescription className="text-base text-slate-500">These routes already have a driver. Open the workspace to talk and update the trip.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-8 pb-8">
                {farmerAssigned.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-8 text-center text-sm font-medium text-slate-500">
                    No driver has been assigned to your farmer deliveries yet.
                  </div>
                ) : (
                  farmerAssigned.map((deal) => <TransportRow key={`farmer-assigned-${deal.id}`} deal={deal} mode="assigned" />)
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {driverActive ? (
        <section className="space-y-8 pt-6">
          <Card className="border-0 shadow-md bg-linear-to-br from-emerald-50/80 to-white ring-1 ring-emerald-100/60 sm:rounded-[2rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <Badge variant="outline" className="w-fit border-emerald-200 bg-white text-emerald-800 shadow-sm">Driver day board</Badge>
              <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                {driverDayActionDeal ? 'Your next driving action' : 'No active driving action right now'}
              </CardTitle>
              <CardDescription className="text-base text-slate-500">
                Use one clear action at a time: start pickup, continue delivery, or claim a new job.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 px-8 pb-8">
              {driverDayActionDeal ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-600">
                      {driverDayActionDeal.shipment.produce_type} | {Number(driverDayActionDeal.quantity_kg)} kg
                    </p>
                    <p className="text-sm text-slate-600">
                      {driverDayActionDeal.shipment.pickup_province} to {driverDayActionDeal.demand.delivery_province}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {driverDayActionDeal.status === 'transport_pending' ? 'Ready to start pickup' : 'Continue in-transit delivery'}
                    </p>
                  </div>
                  <Link
                    href={`/trip/${driverDayActionDeal.id}`}
                    className={ACTION_LINK_PRIMARY}
                  >
                    {driverDayActionDeal.status === 'transport_pending' ? 'Open pickup workspace' : 'Open delivery workspace'}
                  </Link>
                </>
              ) : (
                <div className="flex w-full flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">
                    You have no claimed active delivery. Open the trip board to claim the next job.
                  </p>
                  <Link
                    href="/browse-trips"
                    className={ACTION_LINK_PRIMARY}
                  >
                    Find jobs
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Driver jobs</h2>
              <p className="text-sm text-slate-500">Open the jobs you already claimed and talk to the farmer there.</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/disputes"
                className={ACTION_LINK_SECONDARY}
              >
                Open disputes
              </Link>
              <Link
                href="/browse-trips"
                className={ACTION_LINK_SECONDARY}
              >
                Open trip board
              </Link>
            </div>
          </div>

          <Card className="border-0 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] bg-white/95 sm:rounded-[2rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50 shadow-sm">Assigned jobs</Badge>
              <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-slate-950">My active jobs</CardTitle>
              <CardDescription className="text-base text-slate-500">Open these jobs to message the farmer and update delivery progress.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-8 pb-8">
              {driverAssigned.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-8 text-center text-sm font-medium text-slate-500">
                  No transport jobs are assigned to your driver account yet.
                </div>
              ) : (
                driverAssigned.map((deal) => <TransportRow key={`driver-${deal.id}`} deal={deal} mode="driver" />)
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
