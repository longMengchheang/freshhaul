import type {
  AppCapabilityState,
  AppRoleName,
  AppRoleStates,
  UserRoleAssignment,
} from "@/types/app";

export const APP_ROLE_NAMES = ["buyer", "farmer", "driver"] as const;
export const UPGRADEABLE_ROLE_NAMES = ["farmer", "driver"] as const;

export const ROLE_LABELS: Record<AppRoleName, string> = {
  buyer: "Buyer",
  farmer: "Farmer",
  driver: "Driver",
};

export function deriveRoleStates(roles: UserRoleAssignment[]): AppRoleStates {
  const roleStates: AppRoleStates = {
    buyer: "not_applied",
    farmer: "not_applied",
    driver: "not_applied",
  };

  for (const role of roles) {
    roleStates[role.role_name] = role.status;
  }

  if (roleStates.buyer === "not_applied") {
    roleStates.buyer = "active";
  }

  return roleStates;
}

export function getRoleState(
  roles: UserRoleAssignment[],
  roleName: AppRoleName,
): AppCapabilityState {
  return deriveRoleStates(roles)[roleName];
}

export function hasActiveRole(
  roles: UserRoleAssignment[],
  roleName: AppRoleName,
): boolean {
  return getRoleState(roles, roleName) === "active";
}

export function getActiveRoles(roles: UserRoleAssignment[]): AppRoleName[] {
  const roleStates = deriveRoleStates(roles);

  return APP_ROLE_NAMES.filter((roleName) => roleStates[roleName] === "active");
}

export function getRoleBadgeText(
  roleName: AppRoleName,
  roleState: AppCapabilityState,
): string {
  if (roleState === "not_applied") {
    return `${ROLE_LABELS[roleName]} not applied`;
  }

  if (roleState === "pending_verification") {
    return `${ROLE_LABELS[roleName]} pending`;
  }

  return `${ROLE_LABELS[roleName]} ${roleState}`;
}
