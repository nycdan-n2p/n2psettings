// ─── Role permission model ────────────────────────────────────────────────────

export type ScopeType = "all" | "department" | "call_queue" | "ring_group";

export interface RoleScope {
  type: ScopeType;
  /** IDs of the scoped resources (dept IDs, queue IDs, ring group IDs).
   *  Empty array means entire account (used when type === "all"). */
  ids: (number | string)[];
}

/** One permission entry per nav section */
export type PermissionSection =
  | "dashboard"
  | "analytics"
  | "call_history"
  | "virtual_fax"
  | "company"
  | "team_members"
  | "departments"
  | "company_directory"
  | "delegates"
  | "virtual_assistant"
  | "ring_groups"
  | "call_queues"
  | "schedules"
  | "special_extensions"
  | "phone_numbers"
  | "devices"
  | "device_management"
  | "call_blocking"
  | "sip_trunking"
  | "sip_tie_lines"
  | "webhooks"
  | "api_keys"
  | "emergency_settings"
  | "trust_center"
  | "voicemail_settings"
  | "music_options"
  | "licenses"
  | "number_porting"
  | "bulk_operations"
  | "roles_permissions";

export type Permissions = Record<PermissionSection, { view: boolean; edit: boolean }>;

export type SystemRole = "SuperAdmin" | "Admin" | "Manager" | "User";
export type RoleType = "system" | "custom";

export interface Role {
  id: string;
  name: string;
  /** system = built-in, read-only definition; custom = admin-created */
  type: RoleType;
  /** Matches SystemRole for system roles; free text for custom */
  baseRole: SystemRole;
  description: string;
  memberCount: number;
  scope: RoleScope;
  permissions: Permissions;
  createdAt?: string;
}

export interface RoleAssignment {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  extension?: string;
  scope: RoleScope;
  assignedAt?: string;
}

// ─── Full permissions builders ─────────────────────────────────────────────────

function allPermissions(edit: boolean): Permissions {
  const sections: PermissionSection[] = [
    "dashboard", "analytics", "call_history", "virtual_fax",
    "company", "team_members", "departments", "company_directory", "delegates",
    "virtual_assistant", "ring_groups", "call_queues", "schedules", "special_extensions",
    "phone_numbers", "devices", "device_management", "call_blocking",
    "sip_trunking", "sip_tie_lines", "webhooks", "api_keys",
    "emergency_settings", "trust_center",
    "voicemail_settings", "music_options", "licenses", "number_porting", "bulk_operations",
    "roles_permissions",
  ];
  return Object.fromEntries(sections.map((s) => [s, { view: true, edit }])) as Permissions;
}

function adminPermissions(): Permissions {
  return {
    ...allPermissions(true),
    roles_permissions: { view: true, edit: true },
    sip_trunking: { view: true, edit: false },
    number_porting: { view: true, edit: false },
  };
}

function managerPermissions(): Permissions {
  return {
    dashboard: { view: true, edit: false },
    analytics: { view: true, edit: false },
    call_history: { view: true, edit: false },
    virtual_fax: { view: true, edit: false },
    company: { view: false, edit: false },
    team_members: { view: true, edit: false },
    departments: { view: true, edit: false },
    company_directory: { view: true, edit: false },
    delegates: { view: false, edit: false },
    virtual_assistant: { view: true, edit: false },
    ring_groups: { view: true, edit: false },
    call_queues: { view: true, edit: false },
    schedules: { view: true, edit: false },
    special_extensions: { view: false, edit: false },
    phone_numbers: { view: true, edit: false },
    devices: { view: true, edit: false },
    device_management: { view: false, edit: false },
    call_blocking: { view: false, edit: false },
    sip_trunking: { view: false, edit: false },
    sip_tie_lines: { view: false, edit: false },
    webhooks: { view: false, edit: false },
    api_keys: { view: false, edit: false },
    emergency_settings: { view: false, edit: false },
    trust_center: { view: false, edit: false },
    voicemail_settings: { view: true, edit: false },
    music_options: { view: true, edit: false },
    licenses: { view: false, edit: false },
    number_porting: { view: false, edit: false },
    bulk_operations: { view: false, edit: false },
    roles_permissions: { view: false, edit: false },
  };
}

function userPermissions(): Permissions {
  return {
    dashboard: { view: true, edit: false },
    analytics: { view: false, edit: false },
    call_history: { view: true, edit: false },
    virtual_fax: { view: true, edit: false },
    company: { view: false, edit: false },
    team_members: { view: false, edit: false },
    departments: { view: false, edit: false },
    company_directory: { view: true, edit: false },
    delegates: { view: false, edit: false },
    virtual_assistant: { view: false, edit: false },
    ring_groups: { view: false, edit: false },
    call_queues: { view: false, edit: false },
    schedules: { view: false, edit: false },
    special_extensions: { view: false, edit: false },
    phone_numbers: { view: false, edit: false },
    devices: { view: true, edit: false },
    device_management: { view: false, edit: false },
    call_blocking: { view: false, edit: false },
    sip_trunking: { view: false, edit: false },
    sip_tie_lines: { view: false, edit: false },
    webhooks: { view: false, edit: false },
    api_keys: { view: false, edit: false },
    emergency_settings: { view: false, edit: false },
    trust_center: { view: false, edit: false },
    voicemail_settings: { view: true, edit: true },
    music_options: { view: false, edit: false },
    licenses: { view: false, edit: false },
    number_porting: { view: false, edit: false },
    bulk_operations: { view: false, edit: false },
    roles_permissions: { view: false, edit: false },
  };
}

// ─── Mock role store (replace with real API calls when backend is ready) ──────

let _roles: Role[] = [
  {
    id: "super-admin",
    name: "Super Admin",
    type: "system",
    baseRole: "SuperAdmin",
    description: "Full control over all system configuration, settings, and users.",
    memberCount: 1,
    scope: { type: "all", ids: [] },
    permissions: allPermissions(true),
  },
  {
    id: "admin",
    name: "Admin",
    type: "system",
    baseRole: "Admin",
    description: "Manage users, locations, and most platform settings.",
    memberCount: 3,
    scope: { type: "all", ids: [] },
    permissions: adminPermissions(),
  },
  {
    id: "manager",
    name: "Manager",
    type: "system",
    baseRole: "Manager",
    description: "Manage teams and users within assigned departments. View-only access to most settings.",
    memberCount: 12,
    scope: { type: "all", ids: [] },
    permissions: managerPermissions(),
  },
  {
    id: "user",
    name: "User",
    type: "system",
    baseRole: "User",
    description: "Basic access to personal features: voicemail, call history, and company directory.",
    memberCount: 89,
    scope: { type: "all", ids: [] },
    permissions: userPermissions(),
  },
];

let _assignments: Record<string, RoleAssignment[]> = {
  "super-admin": [],
  admin: [],
  manager: [],
  user: [],
};

// ─── Mock API functions (shaped for easy real-API swap) ───────────────────────

export async function fetchRoles(): Promise<Role[]> {
  return structuredClone(_roles);
}

export async function fetchRole(id: string): Promise<Role | null> {
  return structuredClone(_roles.find((r) => r.id === id) ?? null);
}

export async function createRole(
  payload: Omit<Role, "id" | "memberCount" | "createdAt">
): Promise<Role> {
  const role: Role = {
    ...payload,
    id: `custom-${Date.now()}`,
    memberCount: 0,
    createdAt: new Date().toISOString(),
  };
  _roles = [..._roles, role];
  _assignments[role.id] = [];
  return structuredClone(role);
}

export async function updateRole(
  id: string,
  payload: Partial<Omit<Role, "id" | "type" | "memberCount">>
): Promise<Role> {
  _roles = _roles.map((r) => (r.id === id ? { ...r, ...payload } : r));
  return structuredClone(_roles.find((r) => r.id === id)!);
}

export async function deleteRole(id: string): Promise<void> {
  _roles = _roles.filter((r) => r.id !== id);
  delete _assignments[id];
}

export async function fetchRoleAssignments(roleId: string): Promise<RoleAssignment[]> {
  return structuredClone(_assignments[roleId] ?? []);
}

export async function assignUserToRole(
  roleId: string,
  user: Omit<RoleAssignment, "assignedAt">
): Promise<void> {
  if (!_assignments[roleId]) _assignments[roleId] = [];
  const exists = _assignments[roleId].some((a) => a.userId === user.userId);
  if (!exists) {
    _assignments[roleId] = [
      ..._assignments[roleId],
      { ...user, assignedAt: new Date().toISOString() },
    ];
    _roles = _roles.map((r) =>
      r.id === roleId ? { ...r, memberCount: (_assignments[roleId]?.length ?? 0) } : r
    );
  }
}

export async function removeUserFromRole(roleId: string, userId: number): Promise<void> {
  _assignments[roleId] = (_assignments[roleId] ?? []).filter((a) => a.userId !== userId);
  _roles = _roles.map((r) =>
    r.id === roleId ? { ...r, memberCount: (_assignments[roleId]?.length ?? 0) } : r
  );
}

// ─── Helper: get the base SystemRole from the bootstrap role string ────────────

export function normalizeRole(roleStr: string): SystemRole {
  const lower = roleStr?.toLowerCase() ?? "";
  if (lower.includes("super")) return "SuperAdmin";
  if (lower.includes("admin")) return "Admin";
  if (lower.includes("manager")) return "Manager";
  return "User";
}

/** Role hierarchy for comparison. Higher index = more access. */
export const ROLE_HIERARCHY: SystemRole[] = ["User", "Manager", "Admin", "SuperAdmin"];

export function hasMinRole(userRole: SystemRole, minRole: SystemRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minRole);
}
