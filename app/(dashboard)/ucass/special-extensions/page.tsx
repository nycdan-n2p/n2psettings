"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import { getButtonClasses } from "@/components/ui/Button";
import {
  fetchSpecialExtensions,
  createSpecialExtension,
  updateSpecialExtension,
  deleteSpecialExtension,
  type SpecialExtension,
  type CreateSpecialExtensionPayload,
} from "@/lib/api/special-extensions";
import { fetchAccountNumbers, getUnassignedNumbers } from "@/lib/api/onboarding";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2, Phone } from "lucide-react";

const TYPE_OPTIONS_KEYS = [
  { value: "Fax", key: "typeFax" },
  { value: "Paging", key: "typePager" },
  { value: "Ringer", key: "typeRinger" },
  { value: "Intercom", key: "typeIntercom" },
  { value: "Park", key: "typePark" },
] as const;

function formatPhone(num: string): string {
  const d = (num || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return num || "—";
}

const EMPTY_FORM: CreateSpecialExtensionPayload = { name: "", type: "Fax", extension: "" };

export default function SpecialExtensionsPage() {
  const t = useTranslations("specialExtensionsPage");
  const TYPE_OPTIONS = TYPE_OPTIONS_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SpecialExtension | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SpecialExtension | null>(null);
  const [form, setForm] = useState<CreateSpecialExtensionPayload>({ ...EMPTY_FORM });

  const { data: extensions = [], isLoading } = useQuery({
    queryKey: qk.specialExtensions.list(accountId),
    queryFn: () => fetchSpecialExtensions(accountId),
    enabled: !!accountId,
  });

  const { data: accountNumbers = [] } = useQuery({
    queryKey: qk.phoneNumbers.all(accountId),
    queryFn: () => fetchAccountNumbers(accountId),
    enabled: !!accountId,
  });

  const assignableNumbers = getUnassignedNumbers(accountNumbers);
  const unassignedCount = assignableNumbers.length;

  const addMutation = useMutation({
    mutationFn: (payload: CreateSpecialExtensionPayload) => createSpecialExtension(accountId, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.specialExtensions.all(accountId) }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateSpecialExtensionPayload> }) =>
      updateSpecialExtension(accountId, id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.specialExtensions.all(accountId) }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSpecialExtension(accountId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.specialExtensions.all(accountId) }); setDeleteTarget(null); },
  });

  const openAddModal = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEditModal = (ext: SpecialExtension) => {
    setEditing(ext);
    setForm({
      name: ext.name ?? "",
      type: ext.type ?? "Fax",
      extension: ext.extension ?? "",
      phoneNumber: (ext.phoneNumber as string) || undefined,
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm({ ...EMPTY_FORM }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, phoneNumber: form.phoneNumber || undefined };
    if (editing) { updateMutation.mutate({ id: editing.id!, payload }); }
    else { addMutation.mutate(payload); }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<SpecialExtension>[] = [
    {
      id: "name",
      header: "Name",
      accessorFn: (r) => r.name ?? "",
      cell: ({ row }) => {
        const ext = row.original;
        const name = ext.name ?? "—";
        const typeLabel = TYPE_OPTIONS.find((t) => t.value === ext.type)?.label ?? ext.type ?? "";
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-semibold shrink-0">
              E
            </div>
            <div>
              <div className="font-medium text-gray-900">{name}</div>
              {typeLabel && <div className="text-xs text-gray-500">{typeLabel}</div>}
            </div>
          </div>
        );
      },
    },
    { id: "extension", header: "Ext", accessorFn: (r) => r.extension ?? "", cell: ({ row }) => row.original.extension ?? "—" },
    {
      id: "phoneNumber",
      header: "Phone numbers",
      accessorFn: (r) => (r.phoneNumber as string) ?? "",
      cell: ({ row }) => {
        const ext = row.original;
        const phone = ext.phoneNumber as string | undefined;
        if (!phone) return <span className="text-gray-400">{t("unassigned")}</span>;
        return (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#1a73e8] shrink-0" />
            <div>
              <span className="text-gray-900">{formatPhone(phone)}</span>
              <span className="text-xs text-gray-500 ml-1">
                {ext.name ?? ""}{ext.extension ? ` • ${ext.extension}` : ""}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button onClick={() => openEditModal(row.original)} className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded-full border border-gray-200 hover:bg-red-50 text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Special extensions</h1>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <span className="text-sm text-gray-600">Total: {extensions.length}</span>
        <button
          onClick={openAddModal}
          className="relative px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add Special Extension
          {unassignedCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-medium rounded-full">
              {unassignedCount > 99 ? "99+" : unassignedCount}
            </span>
          )}
        </button>
      </div>
      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader variant="inline" label={t("loading")} /></div>
      ) : (
        <DataTable columns={columns} data={extensions} searchPlaceholder={t("search")} />
      )}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? t("editTitle") : t("addTitle")}>
        <form onSubmit={handleSubmit}>
          <TextInput label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Main Fax" required />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm">
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <TextInput label="Extension" value={form.extension ?? ""} onChange={(v) => setForm((f) => ({ ...f, extension: v }))} placeholder="e.g. 701" />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <select
              value={form.phoneNumber ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value || undefined }))}
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
            >
              <option value="">{t("unassignedOption")}</option>
              {editing && form.phoneNumber && !assignableNumbers.some((n) => n.phoneNumber === form.phoneNumber) && (
                <option value={form.phoneNumber}>{formatPhone(form.phoneNumber)} (current)</option>
              )}
              {assignableNumbers.map((n) => (
                <option key={n.phoneNumber} value={n.phoneNumber}>{formatPhone(n.phoneNumber)}</option>
              ))}
            </select>
          </div>
          {(addMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600 mb-2">{((addMutation.error || updateMutation.error) as Error)?.message ?? t("failedToSave")}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className={getButtonClasses({ variant: "secondary", size: "md" })}>Cancel</button>
            <button type="submit" disabled={isMutating} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">{isMutating ? t("saving") : editing ? t("common_save") : t("addButton")}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id!)} title={t("deleteTitle")} message={`Delete special extension "${deleteTarget?.name}"?`} />
    </div>
  );
}
