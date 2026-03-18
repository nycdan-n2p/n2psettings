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
import { Pencil, Trash2, Download, Music2, ChevronDown, X } from "lucide-react";

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
  const ref = useRef<HTMLDivElement>(null);
  const items = departmentsStr
    ? departmentsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const t = useTranslations("teamMembersPage");
  if (items.length === 0) return <span className="text-sm text-gray-400">{t("noneOption")}</span>;

  const total = items.length;
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 group hover:opacity-90">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(String(total))}`}>
          {total > 9 ? "9+" : total}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 group-hover:text-[#1a73e8] transition-all ${open ? "rotate-180 text-[#1a73e8]" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#dadce0] overflow-hidden">
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

const EMPTY_FORM: CreateUserPayload = { firstName: "", lastName: "", email: "", extension: "", roleId: undefined, deptId: undefined, password: "" };

export default function TeamMembersPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const t = useTranslations("teamMembersPage");
  const tc = useTranslations("common");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<CreateUserPayload>({ ...EMPTY_FORM });

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} members</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-[#dadce0] rounded-md hover:bg-gray-50">
            <Download className="w-4 h-4" />{t("exportCsv")}
          </button>
          <button onClick={openAddModal} className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium">
            {t("addButton")}
          </button>
        </div>
      </div>

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
