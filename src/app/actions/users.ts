'use server';

import { db } from '@/lib/db';
import { userRoles, users } from '@/lib/db/schema';
import type { AppRoleName } from '@/types/app';
import { getCurrentAuthUser, getCurrentUserContext } from '@/lib/server/current-user';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const profileFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  avatar_url: z.string().url().nullish().or(z.literal('')),
  country_code: z.string().trim().regex(/^[A-Z]{2}$/),
  province: z.string().trim().min(2).max(120),
});

const createUserProfileSchema = profileFieldsSchema.extend({
  id: z.string().uuid(),
});

export async function createUserProfile(data: {
  id: string;
  name: string;
  phone: string;
  avatar_url?: string | null;
  country_code: string;
  province: string;
}) {
  try {
    const parsed = createUserProfileSchema.parse(data);

    await db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values(parsed)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            name: parsed.name,
            phone: parsed.phone,
            country_code: parsed.country_code,
            province: parsed.province,
          },
        });

      await tx
        .insert(userRoles)
        .values({
          user_id: parsed.id,
          role_name: 'buyer',
          status: 'active',
        })
        .onConflictDoNothing();
    });

    return { success: true };
  } catch (error) {
    console.error("Drizzle Profile Creation Error:", error);
    return { success: false, error: 'Failed to create profile' };
  }
}

export async function completeCurrentUserProfile(data: {
  name: string;
  phone: string;
  country_code: string;
  province: string;
}) {
  try {
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = profileFieldsSchema.parse(data);

    await db
      .transaction(async (tx) => {
        await tx
          .insert(users)
          .values({
            id: authUser.id,
            ...parsed,
          })
          .onConflictDoUpdate({
            target: users.id,
            set: parsed,
          });

        await tx
          .insert(userRoles)
          .values({
            user_id: authUser.id,
            role_name: 'buyer',
            status: 'active',
          })
          .onConflictDoNothing();
      });

    return { success: true };
  } catch (error) {
    console.error("Complete Current User Profile Error:", error);
    return { success: false, error: 'Failed to save profile' };
  }
}

export async function getCurrentUserProfile() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    return { success: true, data: context.profile };
  } catch (error) {
    console.error("Drizzle Fetch User Profile Error:", error);
    return { success: false, error: 'Failed to fetch user profile', data: null };
  }
}

export async function updateCurrentUserProfile(data: {
  name: string;
  phone: string;
  avatar_url?: string | null;
  country_code: string;
  province: string;
}) {
  try {
    const authUser = await getCurrentAuthUser();
    if (!authUser) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsed = profileFieldsSchema.parse(data);

    await db
      .update(users)
      .set({
        name: parsed.name,
        phone: parsed.phone,
        avatar_url: parsed.avatar_url || null,
        country_code: parsed.country_code,
        province: parsed.province,
      })
      .where(eq(users.id, authUser.id));

    revalidatePath('/profile');
    revalidatePath('/dashboard');
    revalidatePath('/marketplace');
    return { success: true };
  } catch (error) {
    console.error('Update Current User Profile Error:', error);
    return { success: false, error: 'Failed to update profile' };
  }
}

const requestedRoleSchema = z.enum(['farmer', 'driver']);

export async function requestRoleUpgrade(roleName: AppRoleName) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return { success: false, error: 'Unauthorized' };
    }

    const parsedRoleName = requestedRoleSchema.parse(roleName);
    const currentState = context.roleStates[parsedRoleName];

    if (currentState === 'active') {
      return { success: false, error: `${parsedRoleName} access is already active.` };
    }

    if (currentState === 'pending_verification') {
      return { success: false, error: `${parsedRoleName} verification is already pending.` };
    }

    if (currentState === 'suspended') {
      return { success: false, error: `${parsedRoleName} access is suspended. Contact support to review the account.` };
    }

    const existingRole = context.profile.roles.find((role) => role.role_name === parsedRoleName);

    if (existingRole) {
      await db
        .update(userRoles)
        .set({
          status: 'pending_verification',
          updated_at: new Date(),
        })
        .where(eq(userRoles.id, existingRole.id));
    } else {
      await db.insert(userRoles).values({
        user_id: context.authUser.id,
        role_name: parsedRoleName,
        status: 'pending_verification',
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Request Role Upgrade Error:', error);
    return { success: false, error: 'Failed to submit verification request' };
  }
}
