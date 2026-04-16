"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchTeamMembers,
  createUser,
  deleteUser,
  exportUsersCsv,
  type TeamMember,
  type CreateUserPayload,
} from "@/lib/api/team-members";
import { fetchDepartments } from "@/lib/api/departments";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { EditTeamMemberModal } from "@/components/team-members/EditTeamMemberModal";
import { Pencil, Trash2, Download, Music2, ChevronDown, X, UserPlus, ChevronRight } from "lucide-react";

// ─── Product role categories (matches Add New User mockup) ───────────────────

const ROLE_CATEGORIES = [
  {
    id: "ucass",
    label: "Hosted PBX Roles",
    color: "bg-blue-100 text-blue-700",
    roles: [
      { id: 1, label: "Admin", color: "bg-blue-100 text-blue-700" },
      { id: 2, label: "Supervisor", color: "bg-indigo-100 text-indigo-700" },
      { id: 3, label: "User", color: "bg-slate-100 text-slate-600" },
    ],
  },
  {
    id: "agent",
    label: "AI Agent Roles",
    color: "bg-orange-100 text-orange-700",
    roles: [
      { id: 10, label: "AI Agent Admin", color: "bg-orange-100 text-orange-700" },
      { id: 11, label: "AI Agent", color: "bg-amber-100 text-amber-700" },
    ],
  },
  {
    id: "huddle",
    label: "Huddle Roles",
    color: "bg-teal-100 text-teal-700",
    roles: [
      { id: 20, label: "Huddle Admin", color: "bg-teal-100 text-teal-700" },
      { id: 21, label: "Huddle User", color: "bg-cyan-100 text-cyan-700" },
    ],
  },
  {
    id: "coach",
    label: "Coach Roles",
    color: "bg-green-100 text-green-700",
    roles: [
      { id: 30, label: "Coach Admin", color: "bg-green-100 text-green-700" },
      { id: 31, label: "Coach Supervisor", color: "bg-emerald-100 text-emerald-700" },
    ],
  },
  {
    id: "ucontact",
    label: "uContact Roles",
    color: "bg-purple-100 text-purple-700",
    roles: [
      { id: 40, label: "uContact Admin", color: "bg-purple-100 text-purple-700" },
      { id: 41, label: "uContact Agent", color: "bg-violet-100 text-violet-700" },
    ],
  },
  {
    id: "sip",
    label: "SIP-Trunk Roles",
    color: "bg-gray-100 text-gray-600",
    roles: [
      { id: 50, label: "SIP Admin", color: "bg-gray-100 text-gray-600" },
      { id: 51, label: "SIP User", color: "bg-gray-50 text-gray-500" },
    ],
  },
];

const ALL_ROLES = ROLE_CATEGORIES.flatMap((c) => c.roles) as { id: number; label: string; color: string }[];

function getRoleStyle(roleStr: string): string {
  const lower = roleStr.toLowerCase();
  if (lower.includes("admin") && !lower.includes("ai")) return "bg-blue-100 text-blue-700";
  if (lower.includes("supervisor") || lower.includes("super")) return "bg-indigo-100 text-indigo-700";
  if (lower.includes("ai") || lower.includes("agent")) return "bg-orange-100 text-orange-700";
  if (lower.includes("huddle")) return "bg-teal-100 text-teal-700";
  if (lower.includes("coach")) return "bg-green-100 text-green-700";
  if (lower.includes("ucontact") || lower.includes("contact")) return "bg-purple-100 text-purple-700";
  if (lower.includes("sip")) return "bg-gray-100 text-gray-600";
  return "bg-slate-100 text-slate-600";
}

// ─── Nested role picker ───────────────────────────────────────────────────────

function RolePicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (id: number | undefined, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selectedRole = ALL_ROLES.find((r) => r.id === value);
  const hoveredCategory = ROLE_CATEGORIES.find((c) => c.id === hovered);

  return (
    <div className="mb-4 relative" ref={ref}>
      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-[#dadce0] rounded-md text-sm bg-white hover:border-gray-400 transition-colors"
      >
        {selectedRole ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${selectedRole.color}`}>
            {selectedRole.label}
          </span>
        ) : (
          <span className="text-gray-400">Select a role…</span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-[14px] border border-[#e5e7eb] bg-white shadow-xl overflow-hidden flex">
          {/* Category list */}
          <div className="w-1/2 border-r border-[#f3f4f6]">
            <div className="px-3 py-2 border-b border-[#f3f4f6] bg-[#f9f9fb]">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Product</p>
            </div>
            {ROLE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onMouseEnter={() => setHovered(cat.id)}
                onClick={() => setHovered(cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors ${
                  hovered === cat.id ? "bg-[#f0f4ff] text-gray-900" : "hover:bg-[#f9f9fb] text-gray-700"
                }`}
              >
                <span>{cat.label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            ))}
          </div>

          {/* Sub-roles */}
          <div className="w-1/2">
            {hoveredCategory ? (
              <>
                <div className="px-3 py-2 border-b border-[#f3f4f6] bg-[#f9f9fb]">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Role</p>
                </div>
                {hoveredCategory.roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      onChange(role.id, role.label);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[#f0f4ff] transition-colors ${
                      value === role.id ? "bg-[#e8f0fe]" : ""
                    }`}
                  >
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${role.color}`}>
                      {role.label}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-400 py-8">
                Hover a product
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Role tag(s) for table column ────────────────────────────────────────────

function RoleTags({ role }: { role: string }) {
  if (!role) return <span className="text-gray-400 text-sm">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleStyle(role)}`}>
      {role}
    </span>
  );
}

const DISMISS_KEY = "team-members-license-upsell-dismissed";

function LicenseLimitBanner({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("teamMembersPage");
  return (
    <div className="relative mb-6 rounded-[16px] border border-[#1a73e8]/30 bg-gradient-to-r from-[#e8f0fe] to-[#f3e8ff] p-4 flex items-start gap-4">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-[#1a73e8] flex items-center justify-center">
        <UserPlus className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 mb-1">{t("licenseLimitBadgeTitle")}</p>
        <a href="#" className="text-xs text-[#1a73e8] hover:underline font-medium">
          {t("licenseLimitBadgeBody")}
        </a>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 p-1 rounded hover:bg-black/10 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function DepartmentDropdown({ departmentsStr }: { departmentsStr?: string | null }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const items = departmentsStr
    ? departmentsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const flip = window.innerHeight - rect.bottom < 340 && rect.top > 340;
      setPos({ top: flip ? rect.top - 8 : rect.bottom + 8, left: rect.left, flip });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  const t = useTranslations("teamMembersPage");
  if (items.length === 0) return <span className="text-sm text-gray-400">{t("noneOption")}</span>;

  const total = items.length;
  return (
    <div className="inline-block">
      <button ref={buttonRef} onClick={handleToggle} className="flex items-center gap-1.5 group hover:opacity-90">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(String(total))}`}>
          {total > 9 ? "9+" : total}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 group-hover:text-[#1a73e8] transition-all ${open ? "rotate-180 text-[#1a73e8]" : ""}`} />
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos.flip ? undefined : pos.top,
            bottom: pos.flip ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            zIndex: 9999,
          }}
          className="w-64 bg-white rounded-[16px] shadow-xl border border-[#dadce0] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#f1f3f4] bg-[#f8f9fa]">
            <span className="text-xs font-semibold text-gray-600">{total} dept{total !== 1 ? "s" : ""}</span>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-[#e8eaed] text-gray-400"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {items.map((name) => (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f8f9fa]">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(name)}`}>{getInitials(name)}</div>
                <span className="text-sm text-gray-700 truncate">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM: CreateUserPayload & { roleLabel?: string } = { firstName: "", lastName: "", email: "", extension: "", roleId: undefined, deptId: undefined, password: "", roleLabel: undefined };

export default function TeamMembersPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const maxUsers = bootstrap?.account?.maxUsers;
  const queryClient = useQueryClient();
  const t = useTranslations("teamMembersPage");
  const tc = useTranslations("common");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<CreateUserPayload & { roleLabel?: string }>({ ...EMPTY_FORM });
  const [licenseBannerDismissed, setLicenseBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: qk.teamMembers.list(accountId),
    queryFn: () => fetchTeamMembers(accountId),
    enabled: !!accountId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: qk.departments.list(accountId),
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(accountId, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => deleteUser(accountId, userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) }); setDeleteTarget(null); },
  });

  const openAddModal = () => { setEditingUser(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEditModal = (u: TeamMember) => { setEditingUser(u); };
  const closeModal = () => { setModalOpen(false); setForm({ ...EMPTY_FORM }); };

  const atLimit = maxUsers != null && maxUsers > 0 && users.length >= maxUsers;
  const dismissLicenseBanner = () => {
    if (typeof window !== "undefined") localStorage.setItem(DISMISS_KEY, "1");
    setLicenseBannerDismissed(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    addMutation.mutate(payload);
  };

  const handleExportCsv = async () => {
    try {
      const blob = await exportUsersCsv(accountId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "team-members.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch {
      const headers = [t("labelFirstName"), t("labelLastName"), t("labelEmail"), t("labelExtension"), tc("status"), tc("role")];
      const rows = users.map((u) => [u.firstName, u.lastName, u.email, u.extension, u.status, u.role]);
      const csv = [headers, ...rows].map((r) => r.map((v) => `"${v ?? ""}"`).join(",")).join("\n");
      const csvBlob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement("a");
      a.href = url; a.download = "team-members.csv"; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const isMutating = addMutation.isPending;

  const columns: ColumnDef<TeamMember>[] = [
    {
      id: "name",
      header: t("colName"),
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      cell: ({ row }) => (<p className="font-medium text-gray-900">{row.original.firstName} {row.original.lastName}</p>),
    },
    { accessorKey: "extension", header: t("colExt") },
    { accessorKey: "email", header: t("colEmail") },
    {
      id: "department",
      header: t("colDepartment"),
      accessorFn: (row) => row.departments ?? "",
      cell: ({ row }) => <DepartmentDropdown departmentsStr={row.original.departments} />,
    },
    {
      id: "ringGroup",
      header: t("colRingGroup"),
      cell: ({ row }) => row.original.ringGroupStatus ? (
        <span className="inline-flex items-center gap-1.5 text-green-700 text-sm"><span className="w-2 h-2 rounded-full bg-green-500" />{row.original.ringGroupStatus}</span>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      id: "directory",
      header: t("colDirectory"),
      cell: ({ row }) => row.original.directoryEnabled ? (
        <span className="inline-flex items-center gap-1.5 text-green-700 text-sm"><span className="w-2 h-2 rounded-full bg-green-500" />Included</span>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      id: "musicOnHold",
      header: t("colMusicOnHold"),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Music2 className="w-3.5 h-3.5 text-gray-400" />
          {row.original.musicOnHold ?? t("defaultMusicOnHold")}
        </span>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => <RoleTags role={row.original.role} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button onClick={() => openEditModal(row.original)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title={tc("edit")}><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title={tc("delete")}><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {maxUsers != null && maxUsers > 0
              ? t("licensesUsed", { used: users.length, max: maxUsers })
              : t("membersCount", { count: users.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-[#dadce0] rounded-md hover:bg-gray-50">
            <Download className="w-4 h-4" />{t("exportCsv")}
          </button>
          <button
            onClick={openAddModal}
            disabled={atLimit}
            title={atLimit ? t("addDisabledAtLimit") : undefined}
            className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("addButton")}
          </button>
        </div>
      </div>

      {atLimit && !licenseBannerDismissed && (
        <LicenseLimitBanner onDismiss={dismissLicenseBanner} />
      )}

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader variant="inline" label={t("loading")} /></div>
      ) : (
        <DataTable columns={columns} data={users} searchKey="email" searchPlaceholder={t("search")} />
      )}

      <EditTeamMemberModal user={editingUser} isOpen={!!editingUser} onClose={() => setEditingUser(null)} />

      <Modal isOpen={modalOpen && !editingUser} onClose={closeModal} title={t("addTitle")}>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label={t("labelFirstName")} value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} placeholder={t("placeholderFirst")} required />
            <TextInput label={t("labelLastName")} value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} placeholder={t("placeholderLast")} required />
          </div>
          <TextInput label={t("labelEmail")} value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} type="email" placeholder={t("placeholderEmail")} required />
          <TextInput label={t("labelExtension")} value={form.extension} onChange={(v) => setForm((f) => ({ ...f, extension: v }))} placeholder={t("placeholderExt")} required />
          <TextInput label={t("labelPassword")} value={form.password ?? ""} onChange={(v) => setForm((f) => ({ ...f, password: v }))} type="password" placeholder={t("placeholderPassword")} />
          <RolePicker
            value={form.roleId}
            onChange={(id, label) => setForm((f) => ({ ...f, roleId: id, roleLabel: label }))}
          />
          {departments.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{tc("department")}</label>
              <select value={form.deptId ?? ""} onChange={(e) => setForm((f) => ({ ...f, deptId: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm">
                <option value="">{t("noneOption")}</option>
                {departments.map((d) => (<option key={d.deptId} value={d.deptId}>{d.name}</option>))}
              </select>
            </div>
          )}
          {addMutation.isError && (
            <p className="text-sm text-red-600 mb-2">{(addMutation.error as Error)?.message ?? t("failedToAdd")}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">{tc("cancel")}</button>
            <button type="submit" disabled={isMutating} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">
              {isMutating ? t("saving") : tc("add")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.userId)}
        title={t("deleteTitle")}
        message={`Remove ${deleteTarget?.firstName} ${deleteTarget?.lastName} from the account? This cannot be undone.`}
      />
    </div>
  );
}
