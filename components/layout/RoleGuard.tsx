"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUserRole, hasMinRole, type SystemRole } from "@/lib/hooks/useCurrentUserRole";
import { useApp } from "@/contexts/AppContext";

interface RoleGuardProps {
  /** Minimum role needed to view this page */
  minRole: SystemRole;
  children: ReactNode;
  /** Where to redirect if access is denied. Defaults to /ucass/dashboard */
  redirectTo?: string;
}

/**
 * Wraps a page and redirects users whose role is below minRole.
 * Renders nothing while auth is still loading to avoid flash.
 *
 * Usage:
 *   export default function MyAdminPage() {
 *     return <RoleGuard minRole="Admin"><PageContent /></RoleGuard>;
 *   }
 */
export function RoleGuard({ minRole, children, redirectTo = "/ucass/dashboard" }: RoleGuardProps) {
  const { loading } = useApp();
  const role = useCurrentUserRole();
  const router = useRouter();
  const allowed = hasMinRole(role, minRole);

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace(redirectTo);
    }
  }, [loading, allowed, router, redirectTo]);

  // While loading or if we're about to redirect, render nothing
  if (loading || !allowed) return null;

  return <>{children}</>;
}
