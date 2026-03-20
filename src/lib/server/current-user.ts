import "server-only";

import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userRoles, users } from "@/lib/db/schema";
import { getActiveRoles, deriveRoleStates } from "@/lib/user-roles";
import type { AppSystemRole, AppUserProfile, CurrentUserContext } from "@/types/app";
import { createClient } from "@/utils/supabase/server";

function isSchemaCompatibilityError(error: unknown) {
  const codes: string[] = [];
  const messages: string[] = [];

  const pushMessage = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      messages.push(value.toLowerCase());
    }
  };

  const pushCode = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      codes.push(value);
    }
  };

  if (error instanceof Error) {
    pushMessage(error.message);
    const errorWithCause = error as Error & { cause?: unknown; code?: unknown };
    pushCode(errorWithCause.code);

    if (errorWithCause.cause && typeof errorWithCause.cause === "object") {
      const cause = errorWithCause.cause as { message?: unknown; code?: unknown };
      pushMessage(cause.message);
      pushCode(cause.code);
    }
  }

  if (error && typeof error === "object") {
    const generic = error as { message?: unknown; code?: unknown; detail?: unknown; hint?: unknown; cause?: unknown };
    pushMessage(generic.message);
    pushMessage(generic.detail);
    pushMessage(generic.hint);
    pushCode(generic.code);

    if (generic.cause && typeof generic.cause === "object") {
      const nested = generic.cause as { message?: unknown; code?: unknown };
      pushMessage(nested.message);
      pushCode(nested.code);
    }
  }

  if (codes.includes("42P01") || codes.includes("42703")) {
    return true;
  }

  return messages.some((message) => (
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("relation") ||
    message.includes("schema") ||
    message.includes("failed query")
  ));
}

function getProfileFromAuthMetadata(authUser: Awaited<ReturnType<typeof getCurrentAuthUser>>): AppUserProfile | null {
  if (!authUser) {
    return null;
  }

  const name = authUser.user_metadata.name;
  const phone = authUser.user_metadata.phone;
  const countryCode = authUser.user_metadata.country_code;
  const province = authUser.user_metadata.province;
  const legacyRole = authUser.user_metadata.role;
  const systemRole = authUser.user_metadata.system_role === "admin" ? "admin" : "user";
  const now = new Date().toISOString();
  const roles: AppUserProfile["roles"] = [
    {
      id: `${authUser.id}-buyer`,
      user_id: authUser.id,
      role_name: "buyer",
      status: "active",
      created_at: now,
      updated_at: now,
    },
  ];

  if (legacyRole === "farmer" || legacyRole === "driver") {
    roles.push({
      id: `${authUser.id}-${legacyRole}`,
      user_id: authUser.id,
      role_name: legacyRole,
      status: "active",
      created_at: now,
      updated_at: now,
    });
  }

  if (
    typeof name === "string" &&
    typeof phone === "string" &&
    typeof province === "string"
  ) {
    return {
      id: authUser.id,
      system_role: systemRole,
      name,
      phone,
      avatar_url: null,
      country_code: typeof countryCode === "string" ? countryCode.toUpperCase() : "KH",
      province,
      created_at: now,
      roles,
    };
  }

  return null;
}

export const getCurrentAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

async function ensureRoleAssignments(profile: AppUserProfile, legacyRole?: unknown) {
  const assignmentsToEnsure: Array<{
    role_name: "buyer" | "farmer" | "driver";
    status: "active";
  }> = [{ role_name: "buyer", status: "active" }];

  if (legacyRole === "farmer" || legacyRole === "driver") {
    assignmentsToEnsure.push({ role_name: legacyRole, status: "active" });
  }

  for (const assignment of assignmentsToEnsure) {
    const existingAssignment = profile.roles.find((role) => role.role_name === assignment.role_name);
    if (existingAssignment) {
      continue;
    }

    try {
      await db
        .insert(userRoles)
        .values({
          user_id: profile.id,
          role_name: assignment.role_name,
          status: assignment.status,
        })
        .onConflictDoNothing();
    } catch (error) {
      if (isSchemaCompatibilityError(error)) {
        return;
      }
      throw error;
    }
  }
}

function getSystemRoleFromAuthMetadata(
  authUser: Awaited<ReturnType<typeof getCurrentAuthUser>>,
): AppSystemRole {
  return authUser?.user_metadata?.system_role === "admin" ? "admin" : "user";
}

const loadUserProfile = cache(async (userId: string): Promise<AppUserProfile | null> => {
  try {
    const profile = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        roles: true,
      },
    });

    if (!profile) {
      return null;
    }

    return profile as AppUserProfile;
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) {
      throw error;
    }
  }

  const legacyUsersResult = await db.execute(sql<{
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

  const legacyUserRaw = legacyUsersResult[0] as Record<string, unknown> | undefined;
  if (!legacyUserRaw) {
    return null;
  }

  const legacyUser: {
    id: string;
    system_role: AppSystemRole;
    name: string;
    phone: string;
    province: string;
    created_at: string | Date;
  } = {
    id: String(legacyUserRaw.id ?? ""),
    system_role: legacyUserRaw.system_role === "admin" ? "admin" : "user",
    name: String(legacyUserRaw.name ?? ""),
    phone: String(legacyUserRaw.phone ?? ""),
    province: String(legacyUserRaw.province ?? ""),
    created_at:
      legacyUserRaw.created_at instanceof Date
        ? legacyUserRaw.created_at
        : String(legacyUserRaw.created_at ?? new Date().toISOString()),
  };

  if (!legacyUser.id || !legacyUser.name || !legacyUser.phone || !legacyUser.province) {
    return null;
  }

  let roleRows: Array<{
    id: string;
    user_id: string;
    role_name: "buyer" | "farmer" | "driver";
    status: "active" | "pending_verification" | "rejected" | "suspended";
    created_at: string | Date;
    updated_at: string | Date;
  }> = [];

  try {
    const rolesResult = await db.execute(sql<{
      id: string;
      user_id: string;
      role_name: "buyer" | "farmer" | "driver";
      status: "active" | "pending_verification" | "rejected" | "suspended";
      created_at: string | Date;
      updated_at: string | Date;
    }>`
      select id, user_id, role_name, status, created_at, updated_at
      from user_roles
      where user_id = ${userId}
    `);

    roleRows = rolesResult.reduce<typeof roleRows>((accumulator, row) => {
      const record = row as Record<string, unknown>;
      const roleName = String(record.role_name ?? "");
      const status = String(record.status ?? "");

      if (!["buyer", "farmer", "driver"].includes(roleName)) {
        return accumulator;
      }

      if (!["active", "pending_verification", "rejected", "suspended"].includes(status)) {
        return accumulator;
      }

      accumulator.push({
        id: String(record.id ?? `${legacyUser.id}-${roleName}`),
        user_id: String(record.user_id ?? legacyUser.id),
        role_name: roleName as "buyer" | "farmer" | "driver",
        status: status as "active" | "pending_verification" | "rejected" | "suspended",
        created_at:
          record.created_at instanceof Date
            ? record.created_at
            : String(record.created_at ?? legacyUser.created_at),
        updated_at:
          record.updated_at instanceof Date
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
    roleRows = [
      {
        id: `${legacyUser.id}-buyer`,
        user_id: legacyUser.id,
        role_name: "buyer",
        status: "active",
        created_at: legacyUser.created_at,
        updated_at: legacyUser.created_at,
      },
    ];
  }

  return {
    id: legacyUser.id,
    system_role: legacyUser.system_role,
    name: legacyUser.name,
    phone: legacyUser.phone,
    avatar_url: null,
    country_code: "KH",
    province: legacyUser.province,
    created_at: legacyUser.created_at,
    roles: roleRows,
  };
});

function buildCurrentUserContext(
  authUser: Awaited<ReturnType<typeof getCurrentAuthUser>>,
  profile: AppUserProfile,
): CurrentUserContext | null {
  if (!authUser) {
    return null;
  }

  const roleStates = deriveRoleStates(profile.roles);

  return {
    authUser,
    profile,
    systemRole: profile.system_role,
    roleStates,
    activeRoles: getActiveRoles(profile.roles),
  };
}

export const getCurrentUserContext = cache(async (): Promise<CurrentUserContext | null> => {
  const authUser = await getCurrentAuthUser();
  if (!authUser) {
    return null;
  }

  const existingProfile = await loadUserProfile(authUser.id);

  if (existingProfile) {
    const authSystemRole = getSystemRoleFromAuthMetadata(authUser);
    if (existingProfile.system_role !== authSystemRole && authSystemRole === "admin") {
      await db
        .update(users)
        .set({ system_role: authSystemRole })
        .where(eq(users.id, authUser.id));
    }

    await ensureRoleAssignments(existingProfile, authUser.user_metadata.role);
    const hydratedProfile = await loadUserProfile(authUser.id);
    if (!hydratedProfile) {
      return null;
    }

    return buildCurrentUserContext(authUser, hydratedProfile);
  }

  const metadataProfile = getProfileFromAuthMetadata(authUser);
  if (!metadataProfile) {
    return null;
  }

  const profileInsert = {
    id: metadataProfile.id,
    system_role: metadataProfile.system_role,
    name: metadataProfile.name,
    phone: metadataProfile.phone,
    province: metadataProfile.province,
    country_code: metadataProfile.country_code,
  };

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values(profileInsert)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            system_role: profileInsert.system_role,
            name: profileInsert.name,
            phone: profileInsert.phone,
            country_code: profileInsert.country_code,
            province: profileInsert.province,
          },
        });

      for (const role of metadataProfile.roles) {
        await tx
          .insert(userRoles)
          .values({
            user_id: metadataProfile.id,
            role_name: role.role_name,
            status: role.status,
          })
          .onConflictDoNothing();
      }
    });
  } catch (error) {
    if (isSchemaCompatibilityError(error)) {
      return buildCurrentUserContext(authUser, metadataProfile);
    }
    throw error;
  }

  const hydratedProfile = await loadUserProfile(authUser.id);
  if (!hydratedProfile) {
    return null;
  }

  return buildCurrentUserContext(authUser, hydratedProfile);
});
