import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import {
  getAdminVerificationSnapshot,
  requeueTransportDispatch,
  runExceptionBulkAction,
  updateVerificationStatus,
  upsertMarketplaceHeroPromotion,
} from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { STATUS_TONES } from '@/lib/client/status-tones';
import { getCurrentAuthUser, getCurrentUserContext } from '@/lib/server/current-user';
import { ROLE_LABELS } from '@/lib/user-roles';

type ExceptionFilter = 'all' | 'high' | 'medium' | 'sla';
type ExceptionSort = 'newest' | 'severity' | 'sla_desc';

function formatDateTimeLocalValue(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ exceptionFilter?: string; exceptionSort?: string; exceptionPage?: string }>;
}) {
  const context = await getCurrentUserContext();

  if (!context) {
    const authUser = await getCurrentAuthUser();
    if (authUser) {
      redirect('/auth/complete-profile');
    }

    redirect('/auth/login');
  }

  if (context.systemRole !== 'admin') {
    redirect('/dashboard');
  }

  const snapshot = await getAdminVerificationSnapshot();
  if (!snapshot.success) {
    return (
      <div className="page-shell space-y-6">
        <section className="space-y-3">
          <Badge variant="outline">Admin</Badge>
          <h1 className="section-heading">Verification queue is unavailable.</h1>
          <p className="section-subtitle">{snapshot.error}</p>
        </section>
      </div>
    );
  }

  const { pendingRequests, reviewedRequests, exceptionInbox, heroPromotion } = snapshot.data;
  const resolvedSearchParams = await searchParams;
  const requestedFilter = resolvedSearchParams.exceptionFilter;
  const requestedSort = resolvedSearchParams.exceptionSort;
  const requestedPage = Number(resolvedSearchParams.exceptionPage ?? '1');
  const activeFilter: ExceptionFilter =
    requestedFilter === 'high' || requestedFilter === 'medium' || requestedFilter === 'sla'
      ? requestedFilter
      : 'all';
  const activeSort: ExceptionSort =
    requestedSort === 'severity' || requestedSort === 'sla_desc'
      ? requestedSort
      : 'newest';
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const highSeverityCount = exceptionInbox.filter((exception) => exception.severity === 'high').length;
  const mediumSeverityCount = exceptionInbox.filter((exception) => exception.severity === 'medium').length;
  const slaBreachCount = exceptionInbox.filter((exception) => exception.hoursOpen >= 24).length;
  const filteredExceptionInbox = exceptionInbox.filter((exception) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'high') return exception.severity === 'high';
    if (activeFilter === 'medium') return exception.severity === 'medium';
    return exception.hoursOpen >= 24;
  });

  const sortedExceptionInbox = [...filteredExceptionInbox].sort((left, right) => {
    if (activeSort === 'severity') {
      const severityRank = (value: string) => (value === 'high' ? 2 : value === 'medium' ? 1 : 0);
      const severityDelta = severityRank(right.severity) - severityRank(left.severity);
      if (severityDelta !== 0) return severityDelta;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (activeSort === 'sla_desc') {
      if (right.hoursOpen !== left.hoursOpen) return right.hoursOpen - left.hoursOpen;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const EXCEPTION_PAGE_SIZE = 10;
  const totalExceptionPages = Math.max(1, Math.ceil(sortedExceptionInbox.length / EXCEPTION_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalExceptionPages);
  const pageStartIndex = (safePage - 1) * EXCEPTION_PAGE_SIZE;
  const pagedExceptionInbox = sortedExceptionInbox.slice(pageStartIndex, pageStartIndex + EXCEPTION_PAGE_SIZE);
  const visibleTransportDealIds: string[] = [];
  const visibleVerificationRoleIds: string[] = [];
  for (const exception of pagedExceptionInbox) {
    if (exception.type === 'transport_stalled' && 'dealId' in exception) {
      visibleTransportDealIds.push(exception.dealId);
    }
    if (exception.type === 'verification_stale' && 'userRoleId' in exception) {
      visibleVerificationRoleIds.push(exception.userRoleId);
    }
  }

  function getAdminQueryHref(nextFilter: ExceptionFilter, nextSort: ExceptionSort, nextPage: number) {
    const params = new URLSearchParams();
    if (nextFilter !== 'all') params.set('exceptionFilter', nextFilter);
    if (nextSort !== 'newest') params.set('exceptionSort', nextSort);
    if (nextPage > 1) params.set('exceptionPage', String(nextPage));
    const query = params.toString();
    return query ? `/admin?${query}` : '/admin';
  }

  return (
    <div className="page-shell space-y-8">
      <section className="space-y-3">
        <Badge variant="outline">Admin</Badge>
        <h1 className="section-heading">Review farmer and driver verification requests.</h1>
        <p className="section-subtitle max-w-3xl">
          Approvals here unlock restricted marketplace capabilities. Public signup never grants admin access.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending requests</p>
                <p className="text-3xl font-semibold text-slate-950">{pendingRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Approved capabilities</p>
                <p className="text-3xl font-semibold text-slate-950">
                  {reviewedRequests.filter((request) => request.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-800">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Admin account</p>
                <p className="text-lg font-semibold text-slate-950">{context.profile.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <Badge variant="outline">Marketplace spotlight</Badge>
          <CardTitle className="mt-2 text-2xl font-semibold">Hero promotion configuration</CardTitle>
          <CardDescription>Set hero image/video, campaign copy, and optional farmer profile link for marketplace top section.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData) => {
              'use server';
              await upsertMarketplaceHeroPromotion({
                media_type: formData.get('media_type') === 'video' ? 'video' : 'image',
                media_url: String(formData.get('media_url') ?? ''),
                headline: String(formData.get('headline') ?? ''),
                subheadline: String(formData.get('subheadline') ?? '').trim() || null,
                cta_label: String(formData.get('cta_label') ?? '').trim() || null,
                cta_href: String(formData.get('cta_href') ?? '').trim() || null,
                farmer_id: String(formData.get('farmer_id') ?? '').trim() || null,
                is_active: formData.get('is_active') === 'on',
                start_at: String(formData.get('start_at') ?? ''),
                end_at: String(formData.get('end_at') ?? '').trim() || null,
                display_order: Number(formData.get('display_order') ?? '0'),
              });
            }}
            className="grid gap-4 lg:grid-cols-2"
          >
            <div className="space-y-1">
              <label htmlFor="media_type" className="text-sm font-semibold text-slate-800">Media type</label>
              <select
                id="media_type"
                name="media_type"
                defaultValue={heroPromotion?.media_type ?? 'image'}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="display_order" className="text-sm font-semibold text-slate-800">Display order</label>
              <input
                id="display_order"
                name="display_order"
                type="number"
                min={0}
                defaultValue={heroPromotion?.display_order ?? 0}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label htmlFor="media_url" className="text-sm font-semibold text-slate-800">Media URL</label>
              <input
                id="media_url"
                name="media_url"
                type="url"
                required
                defaultValue={heroPromotion?.media_url ?? ''}
                placeholder="https://..."
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label htmlFor="headline" className="text-sm font-semibold text-slate-800">Headline</label>
              <input
                id="headline"
                name="headline"
                required
                defaultValue={heroPromotion?.headline ?? ''}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>

            <div className="space-y-1 lg:col-span-2">
              <label htmlFor="subheadline" className="text-sm font-semibold text-slate-800">Subheadline</label>
              <input
                id="subheadline"
                name="subheadline"
                defaultValue={heroPromotion?.subheadline ?? ''}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cta_label" className="text-sm font-semibold text-slate-800">CTA label</label>
              <input
                id="cta_label"
                name="cta_label"
                defaultValue={heroPromotion?.cta_label ?? ''}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cta_href" className="text-sm font-semibold text-slate-800">CTA link (URL or /path)</label>
              <input
                id="cta_href"
                name="cta_href"
                defaultValue={heroPromotion?.cta_href ?? ''}
                placeholder="/users/..."
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="farmer_id" className="text-sm font-semibold text-slate-800">Farmer user ID (optional)</label>
              <input
                id="farmer_id"
                name="farmer_id"
                defaultValue={heroPromotion?.farmer_id ?? ''}
                placeholder="UUID"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="start_at" className="text-sm font-semibold text-slate-800">Start at</label>
              <input
                id="start_at"
                name="start_at"
                type="datetime-local"
                required
                defaultValue={formatDateTimeLocalValue(heroPromotion?.start_at ?? new Date())}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="end_at" className="text-sm font-semibold text-slate-800">End at (optional)</label>
              <input
                id="end_at"
                name="end_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocalValue(heroPromotion?.end_at)}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              />
            </div>
            <label className="inline-flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              <input type="checkbox" name="is_active" defaultChecked={heroPromotion?.is_active ?? true} className="h-4 w-4" />
              Hero campaign active
            </label>

            <div className="lg:col-span-2">
              <Button type="submit" className="w-full sm:w-auto">Save hero promotion</Button>
            </div>
          </form>
          <p className="text-xs text-slate-500">
            If save fails due missing table, run `npm run db:migrate` (or apply `drizzle/0013_marketplace_promotions.sql`) and retry.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <Badge variant="outline">Exception inbox</Badge>
          <CardTitle className="mt-2 text-2xl font-semibold">Operational issues that need intervention</CardTitle>
          <CardDescription>Prioritized problems that are likely blocking growth, fulfillment, or trust.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className={`rounded-2xl border px-4 py-3 text-sm ${STATUS_TONES.danger}`}>
              <p className="font-semibold">High severity</p>
              <p className="text-2xl font-bold">{highSeverityCount}</p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 text-sm ${STATUS_TONES.warning}`}>
              <p className="font-semibold">Medium severity</p>
              <p className="text-2xl font-bold">{mediumSeverityCount}</p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 text-sm ${STATUS_TONES.neutral}`}>
              <p className="font-semibold">SLA breach (24h+)</p>
              <p className="text-2xl font-bold">{slaBreachCount}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all', label: `All (${exceptionInbox.length})` },
              { key: 'high', label: `High (${highSeverityCount})` },
              { key: 'medium', label: `Medium (${mediumSeverityCount})` },
              { key: 'sla', label: `SLA breach (${slaBreachCount})` },
            ] as const).map((filterOption) => (
              <Link
                key={filterOption.key}
                href={getAdminQueryHref(filterOption.key, activeSort, 1)}
                className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  activeFilter === filterOption.key
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {filterOption.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-700">Sort:</p>
            {([
              { key: 'newest', label: 'Newest' },
              { key: 'severity', label: 'Severity first' },
              { key: 'sla_desc', label: 'Longest open' },
            ] as const).map((sortOption) => (
              <Link
                key={sortOption.key}
                href={getAdminQueryHref(activeFilter, sortOption.key, 1)}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  activeSort === sortOption.key
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {sortOption.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <form
              action={async () => {
                'use server';
                await runExceptionBulkAction({
                  action: 'requeue_stalled_transport',
                  targetIds: visibleTransportDealIds,
                });
              }}
            >
              <Button type="submit" size="sm" className="h-9" disabled={visibleTransportDealIds.length === 0}>
                Requeue visible stalled transport ({visibleTransportDealIds.length})
              </Button>
            </form>
            <form
              action={async () => {
                'use server';
                await runExceptionBulkAction({
                  action: 'approve_stale_verifications',
                  targetIds: visibleVerificationRoleIds,
                });
              }}
            >
              <Button type="submit" size="sm" variant="outline" className="h-9" disabled={visibleVerificationRoleIds.length === 0}>
                Approve visible stale verifications ({visibleVerificationRoleIds.length})
              </Button>
            </form>
            <form
              action={async () => {
                'use server';
                await runExceptionBulkAction({
                  action: 'reject_stale_verifications',
                  targetIds: visibleVerificationRoleIds,
                });
              }}
            >
              <Button type="submit" size="sm" variant="outline" className="h-9" disabled={visibleVerificationRoleIds.length === 0}>
                Reject visible stale verifications ({visibleVerificationRoleIds.length})
              </Button>
            </form>
          </div>
          {pagedExceptionInbox.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
              No exceptions found for the selected filter.
            </div>
          ) : (
            pagedExceptionInbox.map((exception) => (
              <div
                key={exception.id}
                className={`rounded-2xl border px-4 py-3 ${
                  exception.severity === 'high'
                    ? STATUS_TONES.danger
                    : STATUS_TONES.warning
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{exception.title}</p>
                  <Badge variant="outline" className="bg-white text-[0.62rem] uppercase tracking-[0.08em]">
                    {exception.severity} | {exception.hoursOpen}h open
                  </Badge>
                </div>
                <p className="mt-1 text-sm">{exception.detail}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] opacity-80">
                  {new Date(exception.createdAt).toLocaleString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {exception.type === 'transport_stalled' && 'dealId' in exception ? (
                    <>
                      <form
                        action={async () => {
                          'use server';
                          await requeueTransportDispatch({ dealId: exception.dealId });
                        }}
                      >
                        <Button type="submit" size="sm" className="h-9">
                          Requeue dispatch now
                        </Button>
                      </form>
                      <Link
                        href={`/trip/${exception.dealId}`}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                      >
                        Open trip workspace
                      </Link>
                    </>
                  ) : null}
                  {exception.type === 'verification_stale' && 'userRoleId' in exception ? (
                    <>
                      <form
                        action={async () => {
                          'use server';
                          await updateVerificationStatus({ userRoleId: exception.userRoleId, status: 'active' });
                        }}
                      >
                        <Button type="submit" size="sm" className="h-9">
                          Approve now
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          'use server';
                          await updateVerificationStatus({ userRoleId: exception.userRoleId, status: 'rejected' });
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline" className="h-9">
                          Reject now
                        </Button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {sortedExceptionInbox.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p>
                Showing {pageStartIndex + 1}-{Math.min(pageStartIndex + EXCEPTION_PAGE_SIZE, sortedExceptionInbox.length)} of {sortedExceptionInbox.length}
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={getAdminQueryHref(activeFilter, activeSort, Math.max(1, safePage - 1))}
                  className={`inline-flex h-9 items-center rounded-lg border px-3 font-semibold ${
                    safePage <= 1
                      ? 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  Previous
                </Link>
                <span className="text-xs uppercase tracking-[0.08em] text-slate-500">
                  Page {safePage} of {totalExceptionPages}
                </span>
                <Link
                  href={getAdminQueryHref(activeFilter, activeSort, Math.min(totalExceptionPages, safePage + 1))}
                  className={`inline-flex h-9 items-center rounded-lg border px-3 font-semibold ${
                    safePage >= totalExceptionPages
                      ? 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  Next
                </Link>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <Badge variant="outline">Queue</Badge>
          <CardTitle className="mt-2 text-2xl font-semibold">Pending verification requests</CardTitle>
          <CardDescription>Review the request, then approve or reject the capability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
              There are no pending farmer or driver requests right now.
            </div>
          ) : (
            pendingRequests.map((request) => {
              async function approveAction() {
                'use server';
                await updateVerificationStatus({ userRoleId: request.id, status: 'active' });
              }

              async function rejectAction() {
                'use server';
                await updateVerificationStatus({ userRoleId: request.id, status: 'rejected' });
              }

              return (
                <div key={request.id} className="rounded-3xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{ROLE_LABELS[request.role_name]}</Badge>
                        <Badge variant="outline">pending verification</Badge>
                      </div>
                      <h2 className="text-xl font-semibold text-slate-950">{request.user?.name ?? 'Unknown user'}</h2>
                      <p className="text-sm text-slate-600">
                        {request.user?.phone ?? 'No phone'} | {request.user?.province ?? 'No province'}
                      </p>
                      <p className="text-sm text-slate-500">Requested on {new Date(request.updated_at).toLocaleString()}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <form action={approveAction}>
                        <Button type="submit" className="gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                      </form>
                      <form action={rejectAction}>
                        <Button type="submit" variant="destructive" className="gap-2">
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <Badge variant="outline">Recent decisions</Badge>
          <CardTitle className="mt-2 text-2xl font-semibold">Approved and rejected requests</CardTitle>
          <CardDescription>Latest verification outcomes across farmer and driver capabilities.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviewedRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
              No verification decisions have been recorded yet.
            </div>
          ) : (
            reviewedRequests.map((request) => (
              <div key={request.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {request.user?.name ?? 'Unknown user'} requested {ROLE_LABELS[request.role_name].toLowerCase()} access
                  </p>
                  <p className="text-sm text-slate-500">
                    {request.user?.province ?? 'No province'} | updated {new Date(request.updated_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={request.status === 'active' ? 'default' : 'outline'}>{request.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
