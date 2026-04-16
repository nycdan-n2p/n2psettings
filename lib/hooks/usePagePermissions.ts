"use client";

import { useCurrentUserRole } from "./useCurrentUserRole";
import { useApp } from "@/contexts/AppContext";
import type { PermissionSection, SystemRole } from "@/lib/api/roles";

/**
 * Returns permission flags for a given page section based on the current user's role.
 *
 * canView  — should the page/section be accessible at all
 * canEdit  — should edit controls (buttons, inputs, toggles) be enabled
 * readOnly — convenience inverse of canEdit (pass directly to components)
 *
 * Phase 2: when backend ships scoped assignments, this hook will also return
 * scopedIds (the IDs of queues/depts/ring-groups the user may see).
 * For now scopedIds is null, meaning "see all data you have view access to".
 */
export interface PagePermissions {
  canView: boolean;
  canEdit: boolean;
  readOnly: boolean;
  /** null = no scope restriction; array = only show these IDs */
  scopedIds: (number | string)[] | null;
}

// ─── Permission matrix per role ───────────────────────────────────────────────
// Mirrors the data in lib/api/roles.ts but is evaluated client-side at runtime
// so we don't need an async fetch just to decide whether to show an edit button.

type SectionMatrix = Record<PermissionSection, { SuperAdmin: boolean; Admin: boolean; Manager: boolean; User: boolean }>;

const EDIT_MATRIX: SectionMatrix = {
  dashboard:          { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  analytics:          { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  call_history:       { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  virtual_fax:        { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  company:            { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  team_members:       { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  departments:        { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  company_directory:  { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  delegates:          { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  virtual_assistant:  { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  ring_groups:        { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  call_queues:        { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  schedules:          { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  special_extensions: { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  phone_numbers:      { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  devices:            { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  device_management:  { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  call_blocking:      { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  sip_trunking:       { SuperAdmin: true,  Admin: false, Manager: false, User: false },
  sip_tie_lines:      { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  webhooks:           { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  api_keys:           { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  emergency_settings: { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  trust_center:       { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  voicemail_settings: { SuperAdmin: true,  Admin: true,  Manager: false, User: true  },
  music_options:      { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  licenses:           { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  number_porting:     { SuperAdmin: true,  Admin: false, Manager: false, User: false },
  bulk_operations:    { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  roles_permissions:  { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
};

const VIEW_MATRIX: SectionMatrix = {
  dashboard:          { SuperAdmin: true,  Admin: true,  Manager: true,  User: true  },
  analytics:          { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  call_history:       { SuperAdmin: true,  Admin: true,  Manager: true,  User: true  },
  virtual_fax:        { SuperAdmin: true,  Admin: true,  Manager: true,  User: true  },
  company:            { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  team_members:       { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  departments:        { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  company_directory:  { SuperAdmin: true,  Admin: true,  Manager: true,  User: true  },
  delegates:          { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  virtual_assistant:  { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  ring_groups:        { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  call_queues:        { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  schedules:          { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  special_extensions: { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  phone_numbers:      { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  devices:            { SuperAdmin: true,  Admin: true,  Manager: true,  User: true  },
  device_management:  { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  call_blocking:      { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  sip_trunking:       { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  sip_tie_lines:      { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  webhooks:           { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  api_keys:           { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  emergency_settings: { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  trust_center:       { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  voicemail_settings: { SuperAdmin: true,  Admin: true,  Manager: true,  User: true  },
  music_options:      { SuperAdmin: true,  Admin: true,  Manager: true,  User: false },
  licenses:           { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  number_porting:     { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  bulk_operations:    { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
  roles_permissions:  { SuperAdmin: true,  Admin: true,  Manager: false, User: false },
};

export function usePagePermissions(section: PermissionSection): PagePermissions {
  const role = useCurrentUserRole();
  const canView = VIEW_MATRIX[section][role] ?? false;
  const canEdit = EDIT_MATRIX[section][role] ?? false;

  // Phase 2: read scope from bootstrap.user.roleAssignments when available.
  // For now, members[] from bootstrap provides department scope.
  const { bootstrap } = useApp();
  let scopedIds: (number | string)[] | null = null;

  const roleLower = (bootstrap?.user?.role ?? "").toLowerCase();
  const isManager = role === "Manager";

  if (isManager && (section === "departments" || section === "team_members")) {
    const deptIds = (bootstrap?.user?.members ?? []).map((m) => m.id);
    if (deptIds.length > 0) scopedIds = deptIds;
  }

  // ring_groups and call_queues scoped filtering: Phase 2 (needs API scope field)
  void roleLower;

  return { canView, canEdit, readOnly: !canEdit, scopedIds };
}

/** Convenience: get permissions for multiple sections at once */
export function useMultiPagePermissions<T extends PermissionSection>(
  sections: T[]
): Record<T, PagePermissions> {
  const role = useCurrentUserRole();
  const { bootstrap } = useApp();
  return Object.fromEntries(
    sections.map((section) => {
      const canView = VIEW_MATRIX[section][role] ?? false;
      const canEdit = EDIT_MATRIX[section][role] ?? false;
      let scopedIds: (number | string)[] | null = null;
      if (
        role === "Manager" &&
        (section === "departments" || section === "team_members")
      ) {
        const deptIds = (bootstrap?.user?.members ?? []).map((m) => m.id);
        if (deptIds.length > 0) scopedIds = deptIds;
      }
      return [section, { canView, canEdit, readOnly: !canEdit, scopedIds }];
    })
  ) as Record<T, PagePermissions>;
}
