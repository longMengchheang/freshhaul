import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { requestRoleUpgrade } from '@/app/actions/users';
import ProfileCrudCard from '@/components/ProfileCrudCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { getCurrentAuthUser, getCurrentUserContext } from '@/lib/server/current-user';
import { getRoleBadgeText, ROLE_LABELS } from '@/lib/user-roles';
import type { AppCapabilityState, AppRoleName } from '@/types/app';

export const metadata: Metadata = {
  title: 'Profile — FreshHaul',
};

function CapabilityStatusBadge({
  roleName,
  roleState,
}: {
  roleName: AppRoleName;
  roleState: AppCapabilityState;
}) {
  const tone = roleState === 'active'
    ? 'success'
    : roleState === 'pending_verification'
      ? 'warning'
      : roleState === 'rejected' || roleState === 'suspended'
        ? 'error'
        : 'neutral';

  return <StatusBadge tone={tone}>{getRoleBadgeText(roleName, roleState)}</StatusBadge>;
}

function getRoleStateTone(roleState: AppCapabilityState) {
  if (roleState === 'active') {
    return 'border-emerald-200 bg-emerald-50/70';
  }
  if (roleState === 'pending_verification') {
    return 'border-amber-200 bg-amber-50/70';
  }
  if (roleState === 'rejected' || roleState === 'suspended') {
    return 'border-red-200 bg-red-50/70';
  }

  return 'border-slate-200 bg-slate-50/70';
}

function getLifecycleHint(roleName: AppRoleName, roleState: AppCapabilityState) {
  if (roleState === 'active') {
    return 'Active: module is unlocked and ready.';
  }
  if (roleState === 'pending_verification') {
    return 'Pending review: admin verification is in progress.';
  }
  if (roleState === 'rejected') {
    return 'Rejected: request again after updating verification details.';
  }
  if (roleState === 'suspended') {
    return 'Suspended: contact support/admin for review.';
  }
  return roleName === 'buyer'
    ? 'Buyer is enabled by default.'
    : `Not applied: submit request to unlock ${ROLE_LABELS[roleName].toLowerCase()}.`;
}

export default async function ProfilePage() {
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

  async function requestFarmerAccessAction() {
    'use server';
    await requestRoleUpgrade('farmer');
  }

  async function requestDriverAccessAction() {
    'use server';
    await requestRoleUpgrade('driver');
  }

  const moduleCards = [
    {
      roleName: 'buyer' as const,
      title: 'Buyer workspace',
      description: 'Browse supply, post demand, and manage produce deals immediately.',
      icon: ShoppingBasket,
      href: '/marketplace',
      cta: 'Open marketplace',
      secondaryHref: '/post-demand',
      secondaryLabel: 'Post demand',
    },
    {
      roleName: 'farmer' as const,
      title: 'Farmer operations',
      description: 'Post shipment-ready produce supply once farmer verification is approved.',
      icon: Sprout,
      href: '/post-shipment',
      cta: 'Open shipment posting',
    },
    {
      roleName: 'driver' as const,
      title: 'Driver board',
      description: 'Publish routes and claim transport-ready deals after driver verification.',
      icon: Truck,
      href: '/browse-trips',
      cta: 'Open trip board',
    },
  ];

  return (
    <div className="page-shell space-y-8 pb-14">
      <section className="space-y-1 text-center mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">Account / Profile</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Manage your identity and workspaces</h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto">Keep your profile current and activate role-based modules.</p>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <ProfileCrudCard profile={context.profile} email={context.authUser.email ?? null} />

        <Card className="premium-card h-full overflow-hidden rounded-[1.9rem]">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-3xl font-bold tracking-tight text-slate-950">Module status</CardTitle>
            <CardDescription className="text-base font-medium text-slate-500">Access is enabled per role after verification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-8 pb-8">
            {(['buyer', 'farmer', 'driver'] as const).map((roleName) => (
              <div
                key={`lifecycle-${roleName}`}
                className={`rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-100 px-6 py-5 ${getRoleStateTone(context.roleStates[roleName])}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-bold text-slate-950">{ROLE_LABELS[roleName]}</p>
                  <CapabilityStatusBadge roleName={roleName} roleState={context.roleStates[roleName]} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {getLifecycleHint(roleName, context.roleStates[roleName])}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="premium-card overflow-hidden rounded-[1.9rem]">
        <CardHeader className="p-8 pb-6 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-slate-950">Workspaces</CardTitle>
          <CardDescription className="text-base font-medium text-slate-500 mt-2">Open active modules or request access for locked modules.</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="grid gap-6 md:grid-cols-3">
            {moduleCards.map(({ roleName, title, description, icon: Icon, href, cta, secondaryHref, secondaryLabel }) => {
              const roleState = context.roleStates[roleName];
              const isActive = roleState === 'active';

              return (
                <div key={roleName} className="premium-card rounded-[1.5rem] p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] flex flex-col justify-between group">
                  <div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_10px_18px_-14px_rgba(15,23,42,0.8)] transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-8 space-y-4">
                      <CapabilityStatusBadge roleName={roleName} roleState={roleState} />
                      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
                      <p className="text-base font-medium leading-relaxed text-slate-500">{description}</p>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
                    {isActive ? (
                      <>
                        <Link href={href} className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-6 py-3.5 text-sm font-bold tracking-wide text-white transition-all hover:bg-slate-800 hover:scale-[1.02] shadow-sm">
                          {cta}
                        </Link>
                        {secondaryHref && secondaryLabel ? (
                          <Link href={secondaryHref} className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold tracking-wide text-slate-900 transition-all hover:bg-slate-50 hover:scale-[1.02]">
                            {secondaryLabel}
                          </Link>
                        ) : null}
                      </>
                    ) : roleName === 'farmer' ? (
                      <form action={requestFarmerAccessAction}>
                        <Button type="submit" size="lg" className="w-full rounded-full font-bold shadow-sm">Request farmer access</Button>
                      </form>
                    ) : roleName === 'driver' ? (
                      <form action={requestDriverAccessAction}>
                        <Button type="submit" size="lg" className="w-full rounded-full font-bold shadow-sm">Request driver access</Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

