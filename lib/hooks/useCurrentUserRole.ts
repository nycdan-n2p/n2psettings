"use client";

import { useApp } from "@/contexts/AppContext";
import {
  normalizeRole,
  hasMinRole,
  ROLE_HIERARCHY,
  type SystemRole,
} from "@/lib/api/roles";

export type { SystemRole };
export { hasMinRole, ROLE_HIERARCHY };

/**
 * Returns the current logged-in user's role, normalized to the SystemRole union.
 *
 * Today this reads bootstrap.user.role (a flat string from the API).
 * When the backend ships full RBAC, swap the source to bootstrap.user.roleAssignments
 * without changing any call sites.
 */
export function useCurrentUserRole(): SystemRole {
  const { bootstrap } = useApp();
  return normalizeRole(bootstrap?.user?.role ?? "User");
}
