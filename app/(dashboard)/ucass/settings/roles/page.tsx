"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { Modal } from "@/components/settings/Modal";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Loader } from "@/components/ui/Loader";
import {
  fetchRoles,
  fetchRoleAssignments,
  createRole,
  updateRole,
  deleteRole,
  assignUserToRole,
  removeUserFromRole,
  type Role,
  type RoleAssignment,
  type RoleScope,
  type ScopeType,
  type Permissions,
  type PermissionSection,
} from "@/lib/api/roles";
import { fetchTeamMembers, type TeamMember } from "@/lib/api/team-members";
import { fetchDepartments, type Department } from "@/lib/api/departments";
import {
  ShieldCheck, ShieldAlert, Shield, User, Users, Pencil, Trash2,
  Plus, Clock, MapPin, X, ChevronDown, Check,
} from "lucide-react";

// ─── Permission section metadata ─────────────────────────────────────────────

const PERMISSION_GROUPS: { label: string; sections: { key: PermissionSection; label: string }[] }[] = [
  {
    label: "Overview",
    sections: [
      { key: "dashboard", label: "Dashboard" },
      { key: "analytics", label: "Analytics" },
    ],
  },
  {
    label: "Communications",
    sections: [
      { key: "call_history", label: "Call History" },
      { key: "virtual_fax", label: "Virtual Fax" },
    ],
  },
  {
    label: "Organization",
    sections: [
      { key: "company", label: "Company" },
      { key: "team_members", label: "Team Members" },
      { key: "departments", label: "Departments" },
      { key: "company_directory", label: "Company Directory" },
      { key: "delegates", label: "Delegates" },
    ],
  },
  {
    label: "Call Routing",
    sections: [
      { key: "virtual_assistant", label: "Virtual Assistant" },
      { key: "ring_groups", label: "Ring Groups" },
      { key: "call_queues", label: "Call Queues" },
      { key: "schedules", label: "Schedules" },
      { key: "special_extensions", label: "Special Extensions" },
    ],
  },
  {
    label: "Resources",
    sections: [
      { key: "phone_numbers", label: "Phone Numbers" },
      { key: "devices", label: "Devices" },
      { key: "device_management", label: "Device Management" },
      { key: "call_blocking", label: "Call Blocking" },
    ],
  },
  {
    label: "Integrations",
    sections: [
      { key: "sip_trunking", label: "SIP Trunking" },
      { key: "sip_tie_lines", label: "SIP Tie-Lines" },
      { key: "webhooks", label: "Webhooks" },
      { key: "api_keys", label: "API Keys" },
    ],
  },
  {
    label: "Compliance",
    sections: [
      { key: "emergency_settings", label: "Emergency Settings" },
      { key: "trust_center", label: "Trust Center" },
    ],
  },
  {
    label: "Settings",
    sections: [
      { key: "voicemail_settings", label: "Voicemail Settings" },
      { key: "music_options", label: "Music Options" },
      { key: "licenses", label: "Licenses" },
      { key: "number_porting", label: "Number Porting" },
      { key: "bulk_operations", label: "Bulk Operations" },
      { key: "roles_permissions", label: "Roles & Permissions" },
    ],
  },
];

// ─── Role badge helpers ───────────────────────────────────────────────────────

function RoleTypeBadge({ type }: { type: "system" | "custom" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        type === "system"
          ? "bg-blue-50 text-blue-700"
          : "bg-purple-50 text-purple-700"
      }`}
    >
      {type === "system" ? "System" : "Custom"}
    </span>
  );
}

function RoleIcon({ baseRole }: { baseRole: Role["baseRole"] }) {
  const cls = "w-5 h-5";
  if (baseRole === "SuperAdmin") return <ShieldCheck className={`${cls} text-blue-600`} />;
  if (baseRole === "Admin") return <ShieldAlert className={`${cls} text-purple-600`} />;
  if (baseRole === "Manager") return <Shield className={`${cls} text-amber-600`} />;
  return <User className={`${cls} text-gray-400`} />;
}

function ScopeSummary({ scope }: { scope: RoleScope }) {
  if (scope.type === "all") return <span className="text-sm text-gray-500">Entire account</span>;
  const label =
    scope.type === "department" ? "Dept" :
    scope.type === "call_queue" ? "Queue" : "Ring Group";
  return (
    <span className="text-sm text-gray-600">
      {label} · <span className="font-medium">{scope.ids.length} scoped</span>
    </span>
  );
}

// ─── Coming Soon card ─────────────────────────────────────────────────────────

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[16px] border border-dashed border-[#e5e7eb] bg-[#fafafa] px-5 py-4 opacity-70">
      <Clock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <span className="ml-auto shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        Coming Soon
      </span>
    </div>
  );
}

// ─── Permission toggle row ────────────────────────────────────────────────────

function PermissionRow({
  label,
  view,
  edit,
  readOnly,
  onChange,
}: {
  label: string;
  view: boolean;
  edit: boolean;
  readOnly: boolean;
  onChange: (field: "view" | "edit", val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#f3f4f6] last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={view}
            disabled={readOnly}
            onChange={(e) => {
              onChange("view", e.target.checked);
              if (!e.target.checked) onChange("edit", false);
            }}
            className="w-4 h-4 rounded accent-[#1a73e8] disabled:cursor-not-allowed"
          />
          <span className="text-xs text-gray-500">View</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={edit}
            disabled={readOnly || !view}
            onChange={(e) => {
              onChange("edit", e.target.checked);
              if (e.target.checked) onChange("view", true);
            }}
            className="w-4 h-4 rounded accent-[#1a73e8] disabled:cursor-not-allowed"
          />
          <span className="text-xs text-gray-500">Edit</span>
        </label>
      </div>
    </div>
  );
}

// ─── Permissions tab ─────────────────────────────────────────────────────────

function PermissionsTab({
  permissions,
  readOnly,
  onChange,
}: {
  permissions: Permissions;
  readOnly: boolean;
  onChange: (perms: Permissions) => void;
}) {
  const handleChange = (section: PermissionSection, field: "view" | "edit", val: boolean) => {
    onChange({ ...permissions, [section]: { ...permissions[section], [field]: val } });
  };

  return (
    <div className="space-y-3 py-2">
      {readOnly && (
        <div className="flex items-center gap-2 rounded-[12px] bg-blue-50 border border-blue-100 px-4 py-2.5 text-sm text-blue-700">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          System role permissions are read-only. Create a custom role to define custom access.
        </div>
      )}
      {PERMISSION_GROUPS.map((group) => (
        <CollapsibleSection
          key={group.label}
          title={group.label}
          defaultExpanded={false}
        >
          {group.sections.map(({ key, label }) => (
            <PermissionRow
              key={key}
              label={label}
              view={permissions[key]?.view ?? false}
              edit={permissions[key]?.edit ?? false}
              readOnly={readOnly}
              onChange={(field, val) => handleChange(key, field, val)}
            />
          ))}
        </CollapsibleSection>
      ))}
    </div>
  );
}

// ─── Scope tab ────────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: { value: ScopeType; label: string; description: string; comingSoon?: boolean }[] = [
  { value: "all", label: "Entire account", description: "This role applies to all resources in the account." },
  { value: "department", label: "Department(s)", description: "Restrict this role to users in specific departments." },
  { value: "call_queue", label: "Call Queue(s)", description: "Restrict this role to specific call queues and their agents." },
  { value: "ring_group", label: "Ring Group(s)", description: "Restrict this role to specific ring groups." },
];

function ScopeTab({
  scope,
  readOnly,
  accountId,
  onChange,
}: {
  scope: RoleScope;
  readOnly: boolean;
  accountId: number;
  onChange: (scope: RoleScope) => void;
}) {
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["light", accountId, "departments"],
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId && scope.type === "department",
  });

  const handleScopeTypeChange = (type: ScopeType) => {
    onChange({ type, ids: [] });
  };

  const toggleId = (id: number | string) => {
    const exists = scope.ids.includes(id);
    onChange({
      ...scope,
      ids: exists ? scope.ids.filter((x) => x !== id) : [...scope.ids, id],
    });
  };

  return (
    <div className="py-2 space-y-4">
      <p className="text-sm text-gray-500">
        Define which resources this role can access. Scoped roles only see data within their assigned scope.
      </p>

      <div className="space-y-2">
        {SCOPE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3.5 rounded-[14px] border transition-colors cursor-pointer ${
              scope.type === opt.value
                ? "border-[#1a73e8] bg-blue-50"
                : "border-[#e5e7eb] hover:border-gray-300 bg-white"
            } ${readOnly ? "cursor-not-allowed opacity-70" : ""}`}
          >
            <input
              type="radio"
              checked={scope.type === opt.value}
              disabled={readOnly}
              onChange={() => handleScopeTypeChange(opt.value)}
              className="mt-0.5 accent-[#1a73e8]"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{opt.label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Department picker */}
      {scope.type === "department" && !readOnly && (
        <div className="rounded-[14px] border border-[#e5e7eb] bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#f3f4f6] bg-[#f9f9fb]">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Select Departments</p>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-[#f3f4f6]">
            {departments.map((d) => (
              <label key={d.deptId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f9f9fb] cursor-pointer">
                <input
                  type="checkbox"
                  checked={scope.ids.includes(d.deptId)}
                  onChange={() => toggleId(d.deptId)}
                  className="w-4 h-4 rounded accent-[#1a73e8]"
                />
                <span className="text-sm text-gray-700">{d.name}</span>
                <span className="ml-auto text-xs text-gray-400">{d.memberCount ?? 0} members</span>
              </label>
            ))}
            {departments.length === 0 && (
              <p className="text-sm text-gray-400 px-4 py-3">No departments found.</p>
            )}
          </div>
        </div>
      )}

      {/* Call Queue / Ring Group: Coming Soon picker */}
      {(scope.type === "call_queue" || scope.type === "ring_group") && (
        <ComingSoonCard
          title={scope.type === "call_queue" ? "Call Queue scope picker" : "Ring Group scope picker"}
          description="Selecting specific queues or ring groups requires backend scope API support. Assignments will apply to all resources of this type until then."
        />
      )}

      {/* Location: Coming Soon */}
      <ComingSoonCard
        title="Location / Site scoping"
        description="Location-based scope will be available once the site entity is added to the API."
      />
    </div>
  );
}

// ─── Members tab ─────────────────────────────────────────────────────────────

function MembersTab({
  roleId,
  accountId,
  readOnly,
}: {
  roleId: string;
  accountId: number;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<RoleAssignment | null>(null);

  const { data: assignments = [], isLoading } = useQuery<RoleAssignment[]>({
    queryKey: qk.roles.assignments(roleId),
    queryFn: () => fetchRoleAssignments(roleId),
    enabled: !!roleId,
  });

  const { data: allUsers = [] } = useQuery<TeamMember[]>({
    queryKey: qk.teamMembers.list(accountId),
    queryFn: () => fetchTeamMembers(accountId),
    enabled: pickerOpen && !!accountId,
  });

  const assignedIds = new Set(assignments.map((a) => a.userId));

  const assignMutation = useMutation({
    mutationFn: (user: TeamMember) =>
      assignUserToRole(roleId, {
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        extension: user.extension,
        scope: { type: "all", ids: [] },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.roles.assignments(roleId) });
      queryClient.invalidateQueries({ queryKey: qk.roles.list() });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => removeUserFromRole(roleId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.roles.assignments(roleId) });
      queryClient.invalidateQueries({ queryKey: qk.roles.list() });
      setRemoveTarget(null);
    },
  });

  const filteredUsers = allUsers.filter((u) => {
    const q = search.toLowerCase();
    return (
      !assignedIds.has(u.userId) &&
      (`${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.extension?.includes(q))
    );
  });

  if (isLoading) return <Loader />;

  return (
    <div className="py-2 space-y-4">
      {!readOnly && (
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-[12px] bg-[#1a73e8] text-white text-sm font-medium hover:bg-[#1557b0] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Assign User
        </button>
      )}

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No users assigned to this role yet.</p>
      ) : (
        <div className="rounded-[14px] border border-[#e5e7eb] overflow-hidden">
          <div className="divide-y divide-[#f3f4f6]">
            {assignments.map((a) => (
              <div key={a.userId} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-[#e5e7eb] flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                  {a.firstName[0]}{a.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {a.firstName} {a.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{a.email}</p>
                </div>
                <ScopeSummary scope={a.scope} />
                {!readOnly && (
                  <button
                    onClick={() => setRemoveTarget(a)}
                    className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coming Soon: multi-role + per-user scope override */}
      <ComingSoonCard
        title="Per-user scope override"
        description="Assign a different scope to individual users within the same role (e.g. Manager for FL Queue only)."
      />

      {/* User picker modal */}
      <Modal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} title="Assign User" size="md">
        <div className="space-y-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or extension..."
            className="w-full px-3 py-2 rounded-[12px] bg-[#f3f4f6] text-sm focus:outline-none"
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto rounded-[12px] border border-[#e5e7eb] divide-y divide-[#f3f4f6]">
            {filteredUsers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                {search ? "No matching users." : "All users are already assigned."}
              </p>
            )}
            {filteredUsers.map((u) => (
              <button
                key={u.userId}
                onClick={() => {
                  assignMutation.mutate(u);
                  setPickerOpen(false);
                  setSearch("");
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f9f9fb] text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#e5e7eb] flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                  {u.firstName[0]}{u.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{u.email} · ext {u.extension}</p>
                </div>
                <Check className="w-4 h-4 text-[#1a73e8] opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.userId)}
        title="Remove user from role"
        message={`Remove ${removeTarget?.firstName} ${removeTarget?.lastName} from this role?`}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}

// ─── Role Modal ───────────────────────────────────────────────────────────────

const EMPTY_PERMISSIONS: Permissions = Object.fromEntries(
  [
    "dashboard","analytics","call_history","virtual_fax","company","team_members",
    "departments","company_directory","delegates","virtual_assistant","ring_groups",
    "call_queues","schedules","special_extensions","phone_numbers","devices",
    "device_management","call_blocking","sip_trunking","sip_tie_lines","webhooks",
    "api_keys","emergency_settings","trust_center","voicemail_settings","music_options",
    "licenses","number_porting","bulk_operations","roles_permissions",
  ].map((k) => [k, { view: false, edit: false }])
) as Permissions;

type ModalTab = "permissions" | "scope" | "members";

function RoleModal({
  role,
  accountId,
  onClose,
  onSaved,
}: {
  role: Role | null;
  accountId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const isNew = !role;
  const isSystem = role?.type === "system";

  const [tab, setTab] = useState<ModalTab>("permissions");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<Permissions>(
    role?.permissions ?? EMPTY_PERMISSIONS
  );
  const [scope, setScope] = useState<RoleScope>(
    role?.scope ?? { type: "all", ids: [] }
  );
  const [saving, setSaving] = useState(false);

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createRole>[0]) => createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.roles.all() });
      onSaved();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateRole>[1] }) =>
      updateRole(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.roles.all() });
      onSaved();
    },
  });

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          type: "custom",
          baseRole: "Manager",
          scope,
          permissions,
        });
      } else if (role) {
        await updateMutation.mutateAsync({
          id: role.id,
          payload: { name: name.trim(), description: description.trim(), scope, permissions },
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const tabOptions = [
    { value: "permissions" as ModalTab, label: "Permissions" },
    { value: "scope" as ModalTab, label: "Scope" },
    ...(!isNew ? [{ value: "members" as ModalTab, label: "Members" }] : []),
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isNew ? "New Role" : role.name}
      size="2xl"
      headerContent={
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f3f4f6]">
          <div className="flex items-center gap-3 min-w-0">
            {role && <RoleIcon baseRole={role.baseRole} />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium text-gray-900 truncate">
                  {isNew ? "New Role" : role.name}
                </h2>
                {role && <RoleTypeBadge type={role.type} />}
              </div>
              {role?.description && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{role.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Name + description (editable for custom roles and new roles) */}
        {(!isSystem || isNew) && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CallCenter Manager Florida"
                className="w-full px-3 py-2 rounded-[12px] border border-[#e5e7eb] text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe what this role can do..."
                className="w-full px-3 py-2 rounded-[12px] border border-[#e5e7eb] text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8] resize-none"
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={tabOptions}
          equalWidth={false}
        />

        {/* Tab content */}
        {tab === "permissions" && (
          <PermissionsTab
            permissions={permissions}
            readOnly={isSystem}
            onChange={setPermissions}
          />
        )}
        {tab === "scope" && (
          <ScopeTab
            scope={scope}
            readOnly={isSystem}
            accountId={accountId}
            onChange={setScope}
          />
        )}
        {tab === "members" && role && (
          <MembersTab
            roleId={role.id}
            accountId={accountId}
            readOnly={false}
          />
        )}

        {/* Save button */}
        {(!isSystem || isNew) && tab !== "members" && (
          <div className="flex justify-end gap-3 pt-2 border-t border-[#f3f4f6]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-[12px] text-sm font-medium text-gray-600 hover:bg-[#f3f4f6] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-5 py-2 rounded-[12px] bg-[#1a73e8] text-white text-sm font-medium hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : isNew ? "Create Role" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function RolesContent() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [modalRole, setModalRole] = useState<Role | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: qk.roles.list(),
    queryFn: fetchRoles,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.roles.all() });
      setDeleteTarget(null);
    },
  });

  const filteredRoles = useMemo(() => {
    const q = search.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.baseRole.toLowerCase().includes(q)
    );
  }, [roles, search]);

  const systemRoles = filteredRoles.filter((r) => r.type === "system");
  const customRoles = filteredRoles.filter((r) => r.type === "custom");

  if (isLoading) return <Loader />;

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Roles &amp; Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define access levels and assign users to roles. Roles control what each user can see and edit.
          </p>
        </div>
        <button
          onClick={() => setModalRole("new")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#1a73e8] text-white text-sm font-medium hover:bg-[#1557b0] transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Role
        </button>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles…"
          className="w-full max-w-sm px-3 py-2 bg-[#F9F9FB] rounded-[12px] text-sm focus:outline-none"
        />
      </div>

      {/* System roles */}
      <section className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">System Roles</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {systemRoles.map((role) => (
            <div
              key={role.id}
              className="flex items-start gap-3 p-4 rounded-[16px] border border-[#e5e7eb] bg-white hover:border-[#d1d5db] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#f3f4f6] flex items-center justify-center shrink-0">
                <RoleIcon baseRole={role.baseRole} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{role.name}</span>
                  <RoleTypeBadge type={role.type} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{role.description}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Users className="w-3.5 h-3.5" />
                    {role.memberCount} {role.memberCount === 1 ? "user" : "users"}
                  </span>
                  <ScopeSummary scope={role.scope} />
                </div>
              </div>
              <button
                onClick={() => setModalRole(role)}
                className="p-1.5 rounded-full hover:bg-[#f3f4f6] text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                aria-label="Edit role"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Custom roles */}
      <section className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Custom Roles</p>
        {customRoles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-[16px] border border-dashed border-[#e5e7eb] bg-[#fafafa]">
            <ShieldCheck className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No custom roles yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Create a role like &quot;CallCenter Manager Florida&quot; scoped to a specific queue.
            </p>
            <button
              onClick={() => setModalRole("new")}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-[12px] text-sm font-medium text-[#1a73e8] hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first custom role
            </button>
          </div>
        ) : (
          <div className="rounded-[16px] border border-[#e5e7eb] overflow-hidden bg-white">
            <div className="divide-y divide-[#f3f4f6]">
              {customRoles.map((role) => (
                <div key={role.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{role.name}</span>
                      <RoleTypeBadge type={role.type} />
                    </div>
                    <div className="flex items-center gap-4 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Users className="w-3.5 h-3.5" />
                        {role.memberCount}
                      </span>
                      <ScopeSummary scope={role.scope} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setModalRole(role)}
                      className="p-1.5 rounded-full hover:bg-[#f3f4f6] text-gray-400 hover:text-gray-700 transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(role)}
                      disabled={role.memberCount > 0}
                      className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Delete"
                      title={role.memberCount > 0 ? "Remove all users before deleting" : "Delete role"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Coming Soon section */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Coming Soon</p>
        <div className="space-y-2">
          <ComingSoonCard
            title="Location / Site Scoping"
            description="Scope roles to specific office locations or sites once the site entity is available in the API."
          />
          <ComingSoonCard
            title="Audit Log"
            description="Track every permission change, login event, and configuration update with IP and timestamp."
          />
          <ComingSoonCard
            title="Scoped Data Filtering"
            description="Users with a scoped role (e.g. CallCenter Manager Florida) will only see their queue's agents and stats."
          />
          <ComingSoonCard
            title="Multi-Role per User"
            description="Assign multiple role assignments to a single user with individual scope overrides."
          />
        </div>
      </section>

      {/* Role Modal */}
      {modalRole !== null && (
        <RoleModal
          role={modalRole === "new" ? null : (modalRole as Role)}
          accountId={accountId}
          onClose={() => setModalRole(null)}
          onSaved={() => setModalRole(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete role"
        message={`Permanently delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default function RolesPage() {
  return (
    <RoleGuard minRole="Admin">
      <RolesContent />
    </RoleGuard>
  );
}
