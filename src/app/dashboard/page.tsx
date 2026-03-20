import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, ClipboardList, Clock3, PackagePlus, Route, Search, ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentAuthUser, getCurrentUserContext } from '@/lib/server/current-user';
import {
  listBuyerDealsForDashboard,
  listDriverDealsForDashboard,
  listDriverTripsForDashboard,
  listFarmerDealsForDashboard,
  listMyDemands,
  listMyShipmentOffers,
} from '@/lib/server/logistics';
import { ROLE_LABELS, hasActiveRole } from '@/lib/user-roles';
import type { AppRoleName, AppRoleStates } from '@/types/app';
import { DriverEarningsDashboard } from '@/components/DriverEarningsDashboard';
import { AdvancedEarningsAnalyticsCard } from '@/components/AdvancedEarningsAnalyticsCard';
import {
  getDriverAdvancedEarningsReport,
  getDriverEarningsReport,
} from '@/app/actions/driver-earnings';

type ActivityItem = {
  id: string;
  label: string;
  detail: string;
  date: Date;
};

type OverviewCard = {
  title: string;
  value: number;
  detail: string;
};

type ActionItem = {
  href: string;
  label: string;
  detail: string;
  icon: typeof Search;
};

type TaskItem = {
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export const metadata: Metadata = {
  title: 'Dashboard — FreshHaul',
};

type NextBestAction = {
  title: string;
  detail: string;
  href: string;
  cta: string;
};

function getRoleSummary(roleStates: AppRoleStates) {
  const label = (state: string) =>
    ({ active: 'Active', not_applied: 'Not enrolled', pending_verification: 'Pending review', suspended: 'Suspended' }[state] ?? state);
  return `Buyer: ${label(roleStates.buyer)} · Farmer: ${label(roleStates.farmer)} · Driver: ${label(roleStates.driver)}`;
}

function getModeHeadline(mode: AppRoleName) {
  if (mode === 'buyer') {
    return {
      title: 'Buyer overview',
      description: 'Track demand, commercial deals, and inbound delivery progress.',
      icon: ShoppingBasket,
    };
  }

  if (mode === 'farmer') {
    return {
      title: 'Farmer overview',
      description: 'Manage supply listings, sales approvals, and transport handoff.',
      icon: Sprout,
    };
  }

  return {
    title: 'Driver overview',
    description: 'Track active routes, transport assignments, and delivery execution.',
    icon: Truck,
  };
}

function getNextBestAction(
  mode: AppRoleName,
  tasks: TaskItem[],
  actions: ActionItem[],
): NextBestAction {
  if (tasks.length > 0) {
    const firstTask = tasks[0];
    return {
      title: firstTask.title,
      detail: firstTask.detail,
      href: firstTask.href,
      cta: firstTask.cta,
    };
  }

  const primaryAction = actions[0];
  return {
    title: `Continue ${ROLE_LABELS[mode].toLowerCase()} workflow`,
    detail: primaryAction?.detail ?? 'Open your primary workspace and continue operations.',
    href: primaryAction?.href ?? '/dashboard',
    cta: primaryAction?.label ?? 'Open workspace',
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; guided?: string }>;
}) {
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

  const resolvedSearchParams = await searchParams;
  const availableModes = context.activeRoles;
  const requestedMode = resolvedSearchParams.mode;
  const guidedMode = resolvedSearchParams.guided === '1';
  const selectedMode = availableModes.includes(requestedMode as AppRoleName)
    ? (requestedMode as AppRoleName)
    : availableModes[0];

  if (!selectedMode) {
    redirect('/profile');
  }

  const buyerActive = hasActiveRole(context.profile.roles, 'buyer');
  const farmerActive = hasActiveRole(context.profile.roles, 'farmer');
  const driverActive = hasActiveRole(context.profile.roles, 'driver');

  let myDemands: Awaited<ReturnType<typeof listMyDemands>> = [];
  let myShipments: Awaited<ReturnType<typeof listMyShipmentOffers>> = [];
  let myTrips: Awaited<ReturnType<typeof listDriverTripsForDashboard>> = [];
  let buyerDeals: Awaited<ReturnType<typeof listBuyerDealsForDashboard>> = [];
  let farmerDeals: Awaited<ReturnType<typeof listFarmerDealsForDashboard>> = [];
  let driverMatchedDeals: Awaited<ReturnType<typeof listDriverDealsForDashboard>> = [];
  let driverEarningsData: Awaited<ReturnType<typeof getDriverEarningsReport>>['data'] | null = null;
  let driverAdvancedAnalyticsData: Awaited<ReturnType<typeof getDriverAdvancedEarningsReport>>['data'] | null = null;

  if (selectedMode === 'buyer') {
    const [demands, participantDeals] = await Promise.all([
      buyerActive ? listMyDemands(context.authUser.id) : Promise.resolve([]),
      listBuyerDealsForDashboard(context.authUser.id),
    ]);

    myDemands = demands;
    buyerDeals = participantDeals;
  } else if (selectedMode === 'farmer') {
    const [shipments, participantDeals] = await Promise.all([
      farmerActive ? listMyShipmentOffers(context.authUser.id) : Promise.resolve([]),
      listFarmerDealsForDashboard(context.authUser.id),
    ]);

    myShipments = shipments;
    farmerDeals = participantDeals;
  } else {
    const [matchedDeals, trips, earningsResult, analyticsResult] = await Promise.all([
      driverActive ? listDriverDealsForDashboard(context.authUser.id) : Promise.resolve([]),
      driverActive ? listDriverTripsForDashboard(context.authUser.id) : Promise.resolve([]),
      driverActive ? getDriverEarningsReport() : Promise.resolve(null),
      driverActive ? getDriverAdvancedEarningsReport() : Promise.resolve(null),
    ]);

    driverMatchedDeals = matchedDeals;
    myTrips = trips;
    
    if (earningsResult && earningsResult.success) {
      driverEarningsData = earningsResult.data;
    }

    if (analyticsResult && analyticsResult.success) {
      driverAdvancedAnalyticsData = analyticsResult.data;
    }
  }

  const headline = getModeHeadline(selectedMode);

  let overviewCards: OverviewCard[] = [];
  let quickActions: ActionItem[] = [];
  let activeTasks: TaskItem[] = [];
  let recentActivity: ActivityItem[] = [];

  if (selectedMode === 'buyer') {
    const activeBuyerDeals = buyerDeals.filter((deal) => !['completed', 'cancelled', 'rejected'].includes(deal.status));
    const inTransitBuyerDeals = buyerDeals.filter((deal) => deal.status === 'in_transit');
    const pendingBuyerDeals = buyerDeals.filter((deal) => deal.status === 'pending');

    overviewCards = [
      { title: 'Demand posted', value: myDemands.length, detail: 'Demand records created from your buyer account' },
      { title: 'Active orders', value: activeBuyerDeals.length, detail: 'Deals still moving through supply or delivery' },
      { title: 'Deliveries in transit', value: inTransitBuyerDeals.length, detail: 'Shipments currently moving toward your drop-off' },
      { title: 'Completed orders', value: buyerDeals.filter((deal) => deal.status === 'completed').length, detail: 'Closed buyer-side transactions' },
    ];

    quickActions = [
      { href: '/marketplace?view=offers', label: 'Browse produce', detail: 'See what farmers are selling today.', icon: Search },
      { href: '/post-demand', label: 'Post demand', detail: 'Tell farmers what produce you need.', icon: ShoppingBasket },
      { href: '/deals', label: 'My orders', detail: 'Check deals and delivery progress.', icon: ClipboardList },
      { href: '/profile', label: 'My account', detail: 'Open profile and role settings.', icon: Truck },
    ];

    activeTasks = [
      myDemands.length === 0
        ? { title: 'Create your first demand', detail: 'Demand is the fastest way to start receiving farmer offers.', href: '/post-demand', cta: 'Post demand' }
        : null,
      pendingBuyerDeals.length > 0
        ? { title: `${pendingBuyerDeals.length} order${pendingBuyerDeals.length > 1 ? 's need' : ' needs'} review`, detail: 'Accept or reject pending produce deals from the deals page.', href: '/deals', cta: 'Review deals' }
        : null,
      inTransitBuyerDeals.length > 0
        ? { title: `${inTransitBuyerDeals.length} delivery${inTransitBuyerDeals.length > 1 ? 'ies are' : ' is'} in transit`, detail: 'Track current shipments and settlement readiness.', href: '/deals', cta: 'Track orders' }
        : null,
      context.roleStates.farmer === 'not_applied'
        ? { title: 'Expand into selling', detail: 'Request farmer access if you want to post produce supply.', href: '/profile', cta: 'Become a farmer' }
        : null,
      context.roleStates.driver === 'not_applied'
        ? { title: 'Expand into delivery', detail: 'Request driver access to publish routes and claim transport jobs.', href: '/profile', cta: 'Become a driver' }
        : null,
      context.roleStates.farmer === 'pending_verification'
        ? { title: 'Farmer verification is pending', detail: 'Your farmer request is submitted and waiting for admin review.', href: '/profile', cta: 'View profile' }
        : null,
      context.roleStates.driver === 'pending_verification'
        ? { title: 'Driver verification is pending', detail: 'Your driver request is submitted and waiting for admin review.', href: '/profile', cta: 'View profile' }
        : null,
    ].filter(Boolean) as TaskItem[];

    recentActivity = [
      ...myDemands.map((demand) => ({
        id: `demand-${demand.id}`,
        label: 'Demand created',
        detail: `${demand.produce_type} for ${Number(demand.quantity_kg)} kg`,
        date: new Date(demand.created_at),
      })),
      ...buyerDeals.map((deal) => ({
        id: `buyer-deal-${deal.id}`,
        label: `Order ${deal.status}`,
        detail: `${deal.shipment.produce_type} to ${deal.demand.delivery_province}`,
        date: new Date(deal.created_at),
      })),
    ];
  } else if (selectedMode === 'farmer') {
    const activeFarmerDeals = farmerDeals.filter((deal) => !['completed', 'cancelled', 'rejected'].includes(deal.status));
    const pendingFarmerDeals = farmerDeals.filter((deal) => deal.status === 'pending');
    const transportPendingDeals = farmerDeals.filter((deal) => deal.status === 'transport_pending');

    overviewCards = [
      { title: 'Shipment offers', value: myShipments.length, detail: 'Supply listings created under your farmer account' },
      { title: 'Sales in progress', value: activeFarmerDeals.length, detail: 'Deals that still need approval, transport, or completion' },
      { title: 'Awaiting transport', value: transportPendingDeals.length, detail: 'Accepted deals waiting for driver assignment' },
      { title: 'Completed sales', value: farmerDeals.filter((deal) => deal.status === 'completed').length, detail: 'Closed farmer-side transactions' },
    ];

    quickActions = [
      { href: '/post-shipment', label: 'Sell produce', detail: 'Post a new produce load for buyers.', icon: PackagePlus },
      { href: '/marketplace?view=demands', label: 'See buyer needs', detail: 'Look for open buyer requests.', icon: Search },
      { href: '/matches', label: 'My transport', detail: 'Check driver assignment and delivery status.', icon: ClipboardList },
      { href: '/profile', label: 'My account', detail: 'Open profile and role settings.', icon: Truck },
    ];

    activeTasks = [
      myShipments.length === 0
        ? { title: 'Add your first shipment offer', detail: 'Publish supply so buyers can start matching against it.', href: '/post-shipment', cta: 'Post shipment' }
        : null,
      pendingFarmerDeals.length > 0
        ? { title: `${pendingFarmerDeals.length} sale${pendingFarmerDeals.length > 1 ? 's need' : ' needs'} approval`, detail: 'Review buyer proposals and accept or reject them.', href: '/deals', cta: 'Review sales' }
        : null,
      transportPendingDeals.length > 0
        ? { title: `${transportPendingDeals.length} accepted sale${transportPendingDeals.length > 1 ? 's are' : ' is'} waiting for transport`, detail: 'Monitor driver matching after commercial approval.', href: '/deals', cta: 'Monitor transport' }
        : null,
    ].filter(Boolean) as TaskItem[];

    recentActivity = [
      ...myShipments.map((shipment) => ({
        id: `shipment-${shipment.id}`,
        label: 'Shipment offer created',
        detail: `${shipment.produce_type} from ${shipment.pickup_province}`,
        date: new Date(shipment.created_at),
      })),
      ...farmerDeals.map((deal) => ({
        id: `farmer-deal-${deal.id}`,
        label: `Sale ${deal.status}`,
        detail: `${deal.shipment.produce_type} to ${deal.demand.delivery_province}`,
        date: new Date(deal.created_at),
      })),
    ];
  } else {
    const activeDriverDeals = driverMatchedDeals.filter((deal) => !['completed', 'cancelled', 'rejected'].includes(deal.status));
    const inTransitDriverDeals = driverMatchedDeals.filter((deal) => deal.status === 'in_transit');

    overviewCards = [
      { title: 'Published routes', value: myTrips.length, detail: 'Driver availability records tied to your account' },
      { title: 'Assigned deliveries', value: activeDriverDeals.length, detail: 'Transport jobs you are currently attached to' },
      { title: 'In-transit loads', value: inTransitDriverDeals.length, detail: 'Deliveries currently underway' },
      { title: 'Completed deliveries', value: driverMatchedDeals.filter((deal) => deal.status === 'completed').length, detail: 'Closed transport jobs' },
    ];

    quickActions = [
      { href: '/browse-trips', label: 'Find jobs', detail: 'See loads that match your route.', icon: Route },
      { href: '/messages', label: 'Driver chat', detail: 'Coordinate pickup and delivery with farmers.', icon: ClipboardList },
      { href: '/matches', label: 'My transport', detail: 'Open your active delivery jobs.', icon: Truck },
      { href: '/profile', label: 'My account', detail: 'Open profile and role settings.', icon: ShoppingBasket },
    ];

    activeTasks = [
      myTrips.length === 0
        ? { title: 'Save your first route', detail: 'You need an active route before taking a transport job.', href: '/browse-trips', cta: 'Open driver board' }
        : null,
      activeDriverDeals.length > 0
        ? { title: `${activeDriverDeals.length} delivery job${activeDriverDeals.length > 1 ? 's are' : ' is'} active`, detail: 'Open your transport screen and continue the current trip.', href: '/matches', cta: 'Open my transport' }
        : null,
      activeDriverDeals.length === 0 && myTrips.length > 0
        ? { title: 'Look for a matching job', detail: 'Your route is ready. Take a job when one matches your direction.', href: '/browse-trips', cta: 'Find jobs' }
        : null,
    ].filter(Boolean) as TaskItem[];

    recentActivity = [
      ...myTrips.map((trip) => ({
        id: `trip-${trip.id}`,
        label: 'Route published',
        detail: `${trip.from_province} to ${trip.to_province}`,
        date: new Date(trip.created_at),
      })),
      ...driverMatchedDeals.map((deal) => ({
        id: `driver-deal-${deal.id}`,
        label: `Delivery ${deal.status}`,
        detail: `${deal.shipment.pickup_province} to ${deal.demand.delivery_province}`,
        date: new Date(deal.created_at),
      })),
    ];
  }

  recentActivity = recentActivity
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, 6);
  const nextBestAction = getNextBestAction(selectedMode, activeTasks, quickActions);

  return (
    <div className="page-shell space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-0 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.09),0_1px_4px_rgba(0,0,0,0.05)] bg-white sm:rounded-[1.5rem] overflow-hidden">
          <CardContent className="space-y-5 p-8">
            <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50">Dashboard</Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-slate-950">Welcome, {context.profile.name}.</h1>
              <p className="text-lg text-slate-500 max-w-2xl leading-relaxed">
                Pick one mode and do one task at a time. This page is designed to stay simple and clear.
              </p>
              <p className="text-sm font-medium text-slate-400 tracking-wide">{getRoleSummary(context.roleStates)}</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              {availableModes.map((mode) => (
                <Link
                  key={mode}
                  href={`/dashboard?mode=${mode}`}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                    selectedMode === mode
                      ? 'bg-slate-900 text-white shadow-[0_8px_20px_-6px_rgba(15,23,42,0.4)]'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <span>{ROLE_LABELS[mode]}</span>
                </Link>
              ))}
              <Link
                href={`/dashboard?mode=${selectedMode}&guided=${guidedMode ? '0' : '1'}`}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                  guidedMode
                    ? 'bg-emerald-600 text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.4)]'
                    : 'bg-white text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 hover:ring-emerald-300 shadow-sm'
                }`}
              >
                {guidedMode ? 'Guided mode on' : 'Guided mode'}
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.09),0_1px_4px_rgba(0,0,0,0.05)] bg-white sm:rounded-[1.5rem] overflow-hidden flex flex-col">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50">{headline.title}</Badge>
            <CardTitle className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Today</CardTitle>
            <CardDescription className="text-base font-medium text-slate-500">{headline.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-end">
            {quickActions.slice(0, 3).map(({ href, label, detail, icon: Icon }) => (
              <Link
                key={`${selectedMode}-${href}-${label}`}
                href={href}
                className="group flex items-center justify-between rounded-[1.25rem] border-0 bg-slate-50 p-4 transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50 hover:ring-slate-300"
              >
                <span className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-100 group-hover:scale-105 transition-transform duration-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-lg font-bold tracking-tight text-slate-950">{label}</span>
                    <span className="block mt-0.5 text-sm font-medium text-slate-500">{detail}</span>
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 text-slate-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-slate-600" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="border-0 shadow-[0_8px_30px_-12px_rgba(16,185,129,0.15)] bg-gradient-to-br from-emerald-50/80 via-white to-white sm:rounded-[1.5rem] overflow-hidden relative">
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
        <CardContent className="space-y-4 p-8">
          <Badge className="w-fit border-0 bg-emerald-100/80 text-emerald-800 font-bold tracking-wide uppercase px-3 shadow-sm">Next best action</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950">{nextBestAction.title}</h2>
          <p className="text-lg font-medium text-slate-600 max-w-3xl">{nextBestAction.detail}</p>
          <div className="pt-2">
            <Link
              href={nextBestAction.href}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-slate-900 px-8 text-sm font-bold text-white shadow-lg transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl hover:bg-slate-800"
            >
              {nextBestAction.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {guidedMode ? (
        <Card className="border-0 shadow-sm bg-emerald-50/70 sm:rounded-[1.5rem]">
          <CardContent className="p-6 text-sm font-medium text-emerald-800 text-center">
            Guided mode is on. Advanced summary cards are hidden so you can focus on one next action at a time.
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <Card key={`${selectedMode}-${card.title}`} className="border border-slate-200/60 bg-white sm:rounded-2xl">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.title}</p>
                <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{card.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 line-clamp-2">{card.detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {selectedMode === 'driver' && driverEarningsData && !guidedMode && (
        <section className="bg-white rounded-[1.5rem] p-8 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_6px_18px_rgba(0,0,0,0.04)]">
          <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50 mb-4">Earnings transparency</Badge>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 mb-6">Your earnings dashboard</h2>
          <DriverEarningsDashboard 
            earnings={driverEarningsData.earnings} 
            summary={driverEarningsData.summary} 
            trends={driverEarningsData.trends} 
          />
        </section>
      )}

      {selectedMode === 'driver' && driverAdvancedAnalyticsData && !guidedMode && (
        <section className="bg-white rounded-[1.5rem] p-8 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_6px_18px_rgba(0,0,0,0.04)]">
          <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50 mb-4">Advanced earnings analytics</Badge>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 mb-6">Deep performance signals</h2>
          <AdvancedEarningsAnalyticsCard analytics={driverAdvancedAnalyticsData.analytics} />
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-0 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.09),0_1px_4px_rgba(0,0,0,0.05)] bg-white sm:rounded-[1.5rem] overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50">Do this next</Badge>
            <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-slate-950">Next steps for {ROLE_LABELS[selectedMode].toLowerCase()} work</CardTitle>
            <CardDescription className="text-base font-medium text-slate-500">
              Keep the screen simple. Finish the next important job first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-8 pb-8">
            {activeTasks.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-8 text-sm font-medium text-slate-500 text-center">
                No urgent tasks are open in this mode. Switch modes or continue to the main workflow.
              </div>
            ) : (
              activeTasks.map((task) => (
                <div key={`${selectedMode}-${task.title}`} className="group rounded-[1.25rem] border-0 bg-slate-50/80 p-6 transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50 hover:ring-slate-300">
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">{task.title}</h2>
                  <p className="mt-1.5 text-sm font-medium text-slate-600 leading-relaxed">{task.detail}</p>
                  <Link href={task.href} className="mt-4 inline-flex items-center gap-1.5 text-[0.95rem] font-bold text-emerald-600 transition-colors hover:text-emerald-700">
                    {task.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {!guidedMode ? (
          <Card className="border-0 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.09),0_1px_4px_rgba(0,0,0,0.05)] bg-white sm:rounded-[1.5rem] overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50">Latest updates</Badge>
              <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{ROLE_LABELS[selectedMode]} updates</CardTitle>
            <CardDescription className="text-base font-medium text-slate-500">Recent changes in this work mode.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-8 pb-8">
            {recentActivity.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-slate-300/80 bg-slate-50/50 p-8 text-sm font-medium text-slate-500 text-center">
                Activity will appear here as soon as you start operating in this mode.
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="group flex items-start gap-4 rounded-[1.25rem] border-0 bg-slate-50/60 p-4 transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] ring-1 ring-slate-200/50 hover:ring-slate-300">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-white text-slate-600 shadow-sm ring-1 ring-slate-100 group-hover:scale-105 transition-transform duration-300">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-base font-bold tracking-tight text-slate-950">{activity.label}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-600">{activity.detail}</p>
                    <p className="mt-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">
                      {activity.date.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
          </Card>
        ) : null}
      </section>

      <Card className="border-0 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.09),0_1px_4px_rgba(0,0,0,0.05)] bg-white sm:rounded-[1.5rem] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <Badge variant="outline" className="w-fit border-slate-200 text-slate-600 bg-slate-50">Profile and verification</Badge>
          <CardTitle className="mt-4 text-2xl font-bold tracking-tight text-slate-950">Manage account details and capability requests</CardTitle>
          <CardDescription className="text-base font-medium text-slate-500">
            Account information, approval status, and farmer/driver upgrade requests stay on the profile page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 px-8 pb-8 pt-2">
          <Link href="/profile" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-slate-900 px-8 text-[0.95rem] font-bold text-white shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95 hover:bg-slate-800">
            Open profile
          </Link>
          {selectedMode === 'buyer' ? (
            <Link href="/marketplace" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white ring-1 ring-slate-200 hover:ring-slate-300 px-8 text-[0.95rem] font-bold text-slate-900 shadow-sm transition-transform duration-300 hover:scale-105 active:scale-95 hover:bg-slate-50">
              Continue to marketplace
            </Link>
          ) : selectedMode === 'farmer' ? (
            <Link href="/post-shipment" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white ring-1 ring-slate-200 hover:ring-slate-300 px-8 text-[0.95rem] font-bold text-slate-900 shadow-sm transition-transform duration-300 hover:scale-105 active:scale-95 hover:bg-slate-50">
              Continue to farmer tools
            </Link>
          ) : (
            <Link href="/browse-trips" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white ring-1 ring-slate-200 hover:ring-slate-300 px-8 text-[0.95rem] font-bold text-slate-900 shadow-sm transition-transform duration-300 hover:scale-105 active:scale-95 hover:bg-slate-50">
              Continue to trip board
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

