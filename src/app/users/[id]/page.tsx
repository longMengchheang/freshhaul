import Link from 'next/link';
import { desc, or, eq, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, statusToTone } from '@/components/StatusBadge';
import { db } from '@/lib/db';
import { availableTrips, buyerDemands, deals, shipmentRequests, users } from '@/lib/db/schema';
import { getCountryName } from '@/lib/locations';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { deriveRoleStates, getRoleBadgeText, ROLE_LABELS } from '@/lib/user-roles';
import type { AppUserProfile } from '@/types/app';

function isSchemaCompatibilityError(error: unknown) {
  const codes: string[] = [];
  const messages: string[] = [];

  const pushMessage = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      messages.push(value.toLowerCase());
    }
  };

  const pushCode = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      codes.push(value);
    }
  };

  if (error instanceof Error) {
    pushMessage(error.message);
    const errorWithCause = error as Error & { cause?: unknown; code?: unknown };
    pushCode(errorWithCause.code);

    if (errorWithCause.cause && typeof errorWithCause.cause === 'object') {
      const cause = errorWithCause.cause as { message?: unknown; code?: unknown };
      pushMessage(cause.message);
      pushCode(cause.code);
    }
  }

  if (error && typeof error === 'object') {
    const generic = error as {
      message?: unknown;
      code?: unknown;
      detail?: unknown;
      hint?: unknown;
      cause?: unknown;
    };
    pushMessage(generic.message);
    pushMessage(generic.detail);
    pushMessage(generic.hint);
    pushCode(generic.code);

    if (generic.cause && typeof generic.cause === 'object') {
      const nested = generic.cause as { message?: unknown; code?: unknown };
      pushMessage(nested.message);
      pushCode(nested.code);
    }
  }

  if (codes.includes('42P01') || codes.includes('42703')) {
    return true;
  }

  return messages.some((message) => (
    message.includes('does not exist') ||
    message.includes('column') ||
    message.includes('relation') ||
    message.includes('schema') ||
    message.includes('failed query')
  ));
}

async function loadPublicProfile(userId: string) {
  try {
    return (await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        roles: true,
      },
    })) as AppUserProfile | null;
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error;
    }
  }

  const userRows = await db.execute(sql<{
    id: string;
    system_role: string | null;
    name: string;
    phone: string;
    province: string;
    created_at: string | Date;
  }>`
    select id, system_role, name, phone, province, created_at
    from users
    where id = ${userId}
    limit 1
  `);

  const legacyUserRaw = userRows[0] as Record<string, unknown> | undefined;
  if (!legacyUserRaw) {
    return null;
  }

  const legacyUser = {
    id: String(legacyUserRaw.id ?? ''),
    system_role: legacyUserRaw.system_role === 'admin' ? 'admin' as const : 'user' as const,
    name: String(legacyUserRaw.name ?? ''),
    phone: String(legacyUserRaw.phone ?? ''),
    province: String(legacyUserRaw.province ?? ''),
    created_at: legacyUserRaw.created_at instanceof Date
      ? legacyUserRaw.created_at
      : String(legacyUserRaw.created_at ?? new Date().toISOString()),
  };

  if (!legacyUser.id || !legacyUser.name || !legacyUser.phone || !legacyUser.province) {
    return null;
  }

  let roleRows: Array<{
    id: string;
    user_id: string;
    role_name: 'buyer' | 'farmer' | 'driver';
    status: 'active' | 'pending_verification' | 'rejected' | 'suspended';
    created_at: string | Date;
    updated_at: string | Date;
  }> = [];

  try {
    const rolesResult = await db.execute(sql<{
      id: string;
      user_id: string;
      role_name: 'buyer' | 'farmer' | 'driver';
      status: 'active' | 'pending_verification' | 'rejected' | 'suspended';
      created_at: string | Date;
      updated_at: string | Date;
    }>`
      select id, user_id, role_name, status, created_at, updated_at
      from user_roles
      where user_id = ${userId}
    `);
    roleRows = rolesResult.reduce<typeof roleRows>((accumulator, row) => {
      const record = row as Record<string, unknown>;
      const roleName = String(record.role_name ?? '');
      const status = String(record.status ?? '');

      if (!['buyer', 'farmer', 'driver'].includes(roleName)) {
        return accumulator;
      }

      if (!['active', 'pending_verification', 'rejected', 'suspended'].includes(status)) {
        return accumulator;
      }

      accumulator.push({
        id: String(record.id ?? `${legacyUser.id}-${roleName}`),
        user_id: String(record.user_id ?? legacyUser.id),
        role_name: roleName as 'buyer' | 'farmer' | 'driver',
        status: status as 'active' | 'pending_verification' | 'rejected' | 'suspended',
        created_at: record.created_at instanceof Date
          ? record.created_at
          : String(record.created_at ?? legacyUser.created_at),
        updated_at: record.updated_at instanceof Date
          ? record.updated_at
          : String(record.updated_at ?? legacyUser.created_at),
      });

      return accumulator;
    }, []);
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error;
    }
  }

  if (roleRows.length === 0) {
    roleRows = [{
      id: `${legacyUser.id}-buyer`,
      user_id: legacyUser.id,
      role_name: 'buyer',
      status: 'active',
      created_at: legacyUser.created_at,
      updated_at: legacyUser.created_at,
    }];
  }

  return {
    id: legacyUser.id,
    system_role: legacyUser.system_role,
    name: legacyUser.name,
    phone: legacyUser.phone,
    avatar_url: null,
    country_code: 'KH',
    province: legacyUser.province,
    created_at: legacyUser.created_at,
    roles: roleRows,
  };
}

export default async function UserPublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    redirect('/auth/login');
  }

  const { id } = await params;
  const profile = await loadPublicProfile(id);

  if (!profile) {
    notFound();
  }

  const [demandRows, shipmentRows, tripRows, dealRows] = await Promise.all([
    db.query.buyerDemands.findMany({
      where: eq(buyerDemands.buyer_id, profile.id),
      columns: { id: true },
    }),
    db.query.shipmentRequests.findMany({
      where: eq(shipmentRequests.farmer_id, profile.id),
      columns: {
        id: true,
        produce_type: true,
        quantity_kg: true,
        product_image_url: true,
        pickup_province: true,
        status: true,
        deadline: true,
        temp_required: true,
      },
      orderBy: (fields, { desc }) => [desc(fields.created_at)],
      limit: 12,
    }),
    db.query.availableTrips.findMany({
      where: eq(availableTrips.driver_id, profile.id),
      columns: { id: true },
    }),
    db.query.deals.findMany({
      where: or(eq(deals.buyer_id, profile.id), eq(deals.farmer_id, profile.id)),
      columns: { id: true },
    }),
  ]);

  const roleStates = deriveRoleStates(profile.roles);
  const isOwnProfile = profile.id === context.authUser.id;

  return (
    <div className="page-shell space-y-8 pb-14">
      <section className="space-y-1 text-center mt-4">
        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt={profile.name} width={80} height={80} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <span className="text-2xl font-bold">{profile.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">{isOwnProfile ? 'My profile' : 'User profile'}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{profile.name}</h1>
        <p className="text-sm text-slate-500">{profile.province}, {getCountryName(profile.country_code)}</p>
      </section>

      <Card className="premium-card overflow-hidden rounded-[1.9rem]">
        <CardContent className="space-y-8 p-8 lg:p-12">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-100 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Phone</p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{profile.phone}</p>
            </div>
            <div className="rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-100 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Member since</p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(['buyer', 'farmer', 'driver'] as const).map((roleName) => (
              <div key={roleName} className="premium-card rounded-[1.5rem] p-6 text-center">
                <p className="text-base font-bold text-slate-950">{ROLE_LABELS[roleName]}</p>
                <div className="mt-3">
                  <StatusBadge tone={statusToTone(roleStates[roleName])}>{getRoleBadgeText(roleName, roleStates[roleName])}</StatusBadge>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-100 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Buyer demands</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{demandRows.length}</p>
            </div>
            <div className="rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-100 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Farmer offers</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{shipmentRows.length}</p>
            </div>
            <div className="rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-100 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Driver trips</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{tripRows.length}</p>
            </div>
            <div className="rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-100 bg-slate-50/60 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Deals</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{dealRows.length}</p>
            </div>
          </div>

          <section className="space-y-6 pt-4">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Products selling</h2>
            {shipmentRows.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {shipmentRows.map((shipment) => (
                  <article key={shipment.id} className="group premium-card overflow-hidden rounded-[1.5rem] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]">
                    <div className="relative aspect-4/3 bg-slate-100">
                      {shipment.product_image_url ? (
                        <Image
                          src={shipment.product_image_url}
                          alt={shipment.produce_type}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 1024px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="h-full w-full bg-linear-to-br from-slate-100 to-slate-200" />
                      )}
                    </div>
                    <div className="space-y-2 p-5">
                      <p className="text-xl font-bold text-slate-950">{shipment.produce_type}</p>
                      <p className="text-sm font-medium text-slate-600">{Number(shipment.quantity_kg).toLocaleString()} kg <span className="text-slate-300 mx-1">|</span> {shipment.temp_required}</p>
                      <p className="text-sm font-medium text-slate-600">{shipment.pickup_province}</p>
                      <div className="pt-2 flex items-center gap-2">
                        <StatusBadge tone={statusToTone(shipment.status)}>{shipment.status}</StatusBadge>
                        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">
                          {new Date(shipment.deadline).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No products listed yet.
              </div>
            )}
          </section>

          <div className="pt-4 flex justify-center">
            <Link
              href={isOwnProfile ? '/profile' : '/marketplace'}
              className="inline-flex h-12 items-center justify-center rounded-full bg-white border border-slate-200 px-8 text-base font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-50 hover:shadow"
            >
              {isOwnProfile ? 'Open account settings' : 'Back to marketplace'}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
