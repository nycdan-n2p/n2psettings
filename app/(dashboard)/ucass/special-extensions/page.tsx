"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchSpecialExtensions,
  createSpecialExtension,
  updateSpecialExtension,
  deleteSpecialExtension,
  type SpecialExtension,
  type CreateSpecialExtensionPayload,
} from "@/lib/api/special-extensions";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

const EMPTY_FORM: CreateSpecialExtensionPayload = { name: "", type: "Fax", extension: "" };

export default function SpecialExtensionsPage() {
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
  const openEditModal = (ext: SpecialExtension) => { setEditing(ext); setForm({ name: ext.name ?? "", type: ext.type ?? "Fax", extension: ext.extension ?? "" }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm({ ...EMPTY_FORM }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) { updateMutation.mutate({ id: editing.id!, payload: form }); }
    else { addMutation.mutate(form); }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<SpecialExtension>[] = [
    { id: "name", header: "Name", cell: ({ row }) => row.original.name ?? "—" },
    { id: "type", header: "Type", cell: ({ row }) => row.original.type ?? "—" },
    { id: "extension", header: "Extension", cell: ({ row }) => row.original.extension ?? "—" },
    { id: "phoneNumber", header: "Phone Number", cell: ({ row }) => (row.original.phoneNumber as string | undefined) ?? "Unassigned" },
    {
      id: "actions", header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button onClick={() => openEditModal(row.original)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Special Extensions</h1>
          <p className="text-sm text-gray-500 mt-1">{extensions.length} extensions</p>
        </div>
        <button onClick={openAddModal} className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium">Add Special Extension</button>
      </div>
      {isLoading ? <div className="py-12 flex justify-center"><Loader variant="inline" label="Loading special extensions..." /></div> : (
        <DataTable columns={columns} data={extensions} searchPlaceholder="Search extensions..." />
      )}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? "Edit Special Extension" : "Add Special Extension"}>
        <form onSubmit={handleSubmit}>
          <TextInput label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Main Fax" required />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm">
              <option value="Fax">Fax</option>
              <option value="Paging">Paging</option>
              <option value="Ringer">Ringer</option>
              <option value="Park">Park</option>
            </select>
          </div>
          <TextInput label="Extension" value={form.extension ?? ""} onChange={(v) => setForm((f) => ({ ...f, extension: v }))} placeholder="e.g. 701" />
          {(addMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600 mb-2">{((addMutation.error || updateMutation.error) as Error)?.message ?? "Failed to save"}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={isMutating} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">{isMutating ? "Saving..." : editing ? "Save" : "Add"}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id!)} title="Delete Special Extension" message={`Delete special extension "${deleteTarget?.name}"?`} />
    </div>
  );
}
