'use server';

import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deals, marketplacePromotions, userRoles, users } from '@/lib/db/schema';
import { getCurrentUserContext } from '@/lib/server/current-user';
import { enqueueAutoDispatchForDeal } from '@/lib/server/dispatch';
import type { AppRoleStatus } from '@/types/app';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

async function requireAdminContext() {
  const context = await getCurrentUserContext();
  if (!context || context.systemRole !== 'admin') {
    return null;
  }

  return context;
}

export async function getAdminVerificationSnapshot() {
  try {
    const context = await requireAdminContext();
    if (!context) {
      return {
        success: false,
        error: 'Unauthorized',
        data: {
          pendingRequests: [],
          reviewedRequests: [],
          exceptionInbox: [],
          heroPromotion: null,
        },
      };
    }

    const heroPromotionPromise = db.query.marketplacePromotions.findFirst({
      where: eq(marketplacePromotions.slot, 'marketplace_hero'),
      orderBy: [desc(marketplacePromotions.updated_at)],
    }).catch((error) => {
      const message = error instanceof Error ? error.message : '';
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
      if (code === '42P01' || /relation .*marketplace_promotions.* does not exist/i.test(message)) {
        return null;
      }
      throw error;
    });

    const [pendingRequests, reviewedRequests, stalledTransport, staleVerifications, heroPromotion] = await Promise.all([
      db.query.userRoles.findMany({
        where: and(
          eq(userRoles.status, 'pending_verification'),
          ne(userRoles.role_name, 'buyer'),
        ),
        with: {
          user: true,
        },
        orderBy: [desc(userRoles.updated_at), desc(userRoles.created_at)],
      }),
      db.query.userRoles.findMany({
        where: and(
          inArray(userRoles.status, ['active', 'rejected', 'suspended']),
          ne(userRoles.role_name, 'buyer'),
        ),
        with: {
          user: true,
        },
        orderBy: [desc(userRoles.updated_at), desc(userRoles.created_at)],
        limit: 12,
      }),
      db.query.deals.findMany({
        where: eq(deals.status, 'transport_pending'),
        with: {
          buyer: { columns: { name: true } },
          farmer: { columns: { name: true } },
          matches: { columns: { id: true } },
          demand: true,
          shipment: true,
        },
        orderBy: [desc(deals.created_at)],
        limit: 25,
      }),
      db.query.userRoles.findMany({
        where: and(
          eq(userRoles.status, 'pending_verification'),
          ne(userRoles.role_name, 'buyer'),
        ),
        with: { user: true },
        orderBy: [desc(userRoles.updated_at)],
        limit: 25,
      }),
      heroPromotionPromise,
    ]);

    const now = Date.now();
    const exceptionInbox = [
      ...stalledTransport
        .filter((deal) => {
          if (deal.matches.length > 0) {
            return false;
          }
          const ageHours = (now - new Date(deal.created_at).getTime()) / (1000 * 60 * 60);
          return ageHours >= 6;
        })
        .map((deal) => ({
          id: `transport-${deal.id}`,
          type: 'transport_stalled',
          severity: 'high',
          dealId: deal.id,
          title: `Transport stalled: ${deal.shipment.produce_type}`,
          detail: `${deal.shipment.pickup_province} -> ${deal.demand.delivery_province} | Buyer ${deal.buyer?.name ?? 'Unknown'} | Farmer ${deal.farmer?.name ?? 'Unknown'}`,
          createdAt: deal.created_at,
          hoursOpen: Math.floor((now - new Date(deal.created_at).getTime()) / (1000 * 60 * 60)),
        })),
      ...staleVerifications
        .filter((request) => {
          const ageHours = (now - new Date(request.updated_at).getTime()) / (1000 * 60 * 60);
          return ageHours >= 24;
        })
        .map((request) => ({
          id: `verification-${request.id}`,
          type: 'verification_stale',
          severity: 'medium',
          userRoleId: request.id,
          title: `Verification waiting: ${request.role_name}`,
          detail: `${request.user?.name ?? 'Unknown user'} | ${request.user?.province ?? 'No province'}`,
          createdAt: request.updated_at,
          hoursOpen: Math.floor((now - new Date(request.updated_at).getTime()) / (1000 * 60 * 60)),
        })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      success: true,
      data: {
        pendingRequests,
        reviewedRequests,
        exceptionInbox,
        heroPromotion,
      },
    };
  } catch (error) {
    console.error('Get Admin Verification Snapshot Error:', error);
    return {
      success: false,
      error: 'Failed to load admin verification queue',
      data: {
        pendingRequests: [],
        reviewedRequests: [],
        exceptionInbox: [],
        heroPromotion: null,
      },
    };
  }
}

const verificationDecisionSchema = z.object({
  userRoleId: z.string().uuid(),
  status: z.enum(['active', 'rejected', 'suspended']),
});

const exceptionBulkActionSchema = z.object({
  action: z.enum(['requeue_stalled_transport', 'approve_stale_verifications', 'reject_stale_verifications']),
  targetIds: z.array(z.string().uuid()).max(500).optional(),
});

export async function updateVerificationStatus(data: {
  userRoleId: string;
  status: Extract<AppRoleStatus, 'active' | 'rejected' | 'suspended'>;
}) {
  try {
    const context = await requireAdminContext();
    if (!context) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = verificationDecisionSchema.parse(data);
    const existingRole = await db.query.userRoles.findFirst({
      where: eq(userRoles.id, parsed.userRoleId),
      with: {
        user: true,
      },
    });

    if (!existingRole) {
      return { success: false, error: 'Verification request not found.' };
    }

    if (existingRole.role_name === 'buyer') {
      return { success: false, error: 'Buyer access is not review-managed.' };
    }

    await db
      .update(userRoles)
      .set({
        status: parsed.status,
        updated_at: new Date(),
      })
      .where(eq(userRoles.id, parsed.userRoleId));

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Update Verification Status Error:', error);
    return { success: false, error: 'Failed to update verification status' };
  }
}

export async function getAdminAccountGuide() {
  try {
    const context = await requireAdminContext();
    if (!context) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const userRows = await db.query.users.findMany({
      where: ne(users.system_role, 'admin'),
      orderBy: [desc(users.created_at)],
      limit: 5,
    });

    return { success: true, data: userRows };
  } catch (error) {
    console.error('Get Admin Account Guide Error:', error);
    return { success: false, error: 'Failed to load admin account guide', data: null };
  }
}

const dispatchRequeueSchema = z.object({
  dealId: z.string().uuid(),
});

const marketplaceHeroPromotionSchema = z.object({
  media_type: z.enum(['image', 'video']),
  media_url: z.string().url(),
  headline: z.string().trim().min(3).max(120),
  subheadline: z.string().trim().max(240).optional().nullable(),
  cta_label: z.string().trim().max(40).optional().nullable(),
  cta_href: z.string().trim().max(500).optional().nullable().refine((value) => {
    if (!value) return true;
    if (value.startsWith('/')) return true;
    try {
      // Validate absolute URLs for external campaign links.
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, 'CTA link must be a relative path (/) or full URL'),
  farmer_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean(),
  start_at: z.coerce.date(),
  end_at: z.coerce.date().optional().nullable(),
  display_order: z.coerce.number().int().min(0).max(999).default(0),
});

export async function requeueTransportDispatch(data: { dealId: string }) {
  try {
    const context = await requireAdminContext();
    if (!context) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = dispatchRequeueSchema.parse(data);
    const result = await enqueueAutoDispatchForDeal(parsed.dealId);
    revalidatePath('/admin');
    revalidatePath('/browse-trips');
    revalidatePath('/deals');
    return { success: true, queued: result.queued };
  } catch (error) {
    console.error('Requeue Transport Dispatch Error:', error);
    return { success: false, error: 'Failed to requeue transport dispatch.' };
  }
}

export async function upsertMarketplaceHeroPromotion(data: {
  media_type: 'image' | 'video';
  media_url: string;
  headline: string;
  subheadline?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  farmer_id?: string | null;
  is_active: boolean;
  start_at: Date | string;
  end_at?: Date | string | null;
  display_order?: number;
}) {
  try {
    const context = await requireAdminContext();
    if (!context) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = marketplaceHeroPromotionSchema.parse(data);
    const existing = await db.query.marketplacePromotions.findFirst({
      where: eq(marketplacePromotions.slot, 'marketplace_hero'),
      orderBy: [desc(marketplacePromotions.updated_at)],
    });

    const payload = {
      slot: 'marketplace_hero' as const,
      media_type: parsed.media_type,
      media_url: parsed.media_url,
      headline: parsed.headline,
      subheadline: parsed.subheadline?.trim() ? parsed.subheadline : null,
      cta_label: parsed.cta_label?.trim() ? parsed.cta_label : null,
      cta_href: parsed.cta_href?.trim() ? parsed.cta_href : null,
      farmer_id: parsed.farmer_id ?? null,
      is_active: parsed.is_active,
      start_at: parsed.start_at,
      end_at: parsed.end_at ?? null,
      display_order: parsed.display_order ?? 0,
      created_by: context.authUser.id,
      updated_at: new Date(),
    };

    if (existing) {
      await db
        .update(marketplacePromotions)
        .set(payload)
        .where(eq(marketplacePromotions.id, existing.id));
    } else {
      await db.insert(marketplacePromotions).values(payload);
    }

    revalidatePath('/admin');
    revalidatePath('/marketplace');
    return { success: true };
  } catch (error) {
    console.error('Upsert Marketplace Hero Promotion Error:', error);
    const message = error instanceof Error ? error.message : '';
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
    if (code === '42P01' || /relation .*marketplace_promotions.* does not exist/i.test(message)) {
      return { success: false, error: 'Marketplace promotion table is missing. Run latest migration first.' };
    }
    return { success: false, error: 'Failed to save marketplace hero promotion.' };
  }
}

export async function runExceptionBulkAction(data: {
  action: 'requeue_stalled_transport' | 'approve_stale_verifications' | 'reject_stale_verifications';
  targetIds?: string[];
}) {
  try {
    const context = await requireAdminContext();
    if (!context) {
      return { success: false, error: 'Unauthorized', affected: 0 };
    }

    const parsed = exceptionBulkActionSchema.parse(data);
    const now = Date.now();

    if (parsed.action === 'requeue_stalled_transport') {
      const stalledDeals = await db.query.deals.findMany({
        where: parsed.targetIds?.length
          ? and(eq(deals.status, 'transport_pending'), inArray(deals.id, parsed.targetIds))
          : eq(deals.status, 'transport_pending'),
        with: { matches: { columns: { id: true } } },
        orderBy: [desc(deals.created_at)],
        limit: 100,
      });

      const candidateDeals = stalledDeals.filter((deal) => {
        if (deal.matches.length > 0) return false;
        const ageHours = (now - new Date(deal.created_at).getTime()) / (1000 * 60 * 60);
        return ageHours >= 6;
      });

      let queued = 0;
      for (const deal of candidateDeals) {
        const result = await enqueueAutoDispatchForDeal(deal.id);
        if (result.queued > 0) queued += 1;
      }

      revalidatePath('/admin');
      revalidatePath('/browse-trips');
      revalidatePath('/deals');
      return { success: true, affected: queued };
    }

    const staleRequests = await db.query.userRoles.findMany({
      where: parsed.targetIds?.length
        ? and(
            eq(userRoles.status, 'pending_verification'),
            ne(userRoles.role_name, 'buyer'),
            inArray(userRoles.id, parsed.targetIds),
          )
        : and(eq(userRoles.status, 'pending_verification'), ne(userRoles.role_name, 'buyer')),
      columns: { id: true, updated_at: true },
      orderBy: [desc(userRoles.updated_at)],
      limit: 200,
    });

    const staleIds = (parsed.targetIds?.length
      ? staleRequests
      : staleRequests.filter((request) => {
          const ageHours = (now - new Date(request.updated_at).getTime()) / (1000 * 60 * 60);
          return ageHours >= 24;
        })
    ).map((request) => request.id);

    if (staleIds.length === 0) {
      return { success: true, affected: 0 };
    }

    const status = parsed.action === 'approve_stale_verifications' ? 'active' : 'rejected';
    await db
      .update(userRoles)
      .set({ status, updated_at: new Date() })
      .where(inArray(userRoles.id, staleIds));

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true, affected: staleIds.length };
  } catch (error) {
    console.error('Run Exception Bulk Action Error:', error);
    return { success: false, error: 'Failed to run bulk action.', affected: 0 };
  }
}
