"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type Department,
  type CreateDepartmentPayload,
} from "@/lib/api/departments";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

const EMPTY_FORM: CreateDepartmentPayload = { name: "", extension: "" };

export default function DepartmentsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [form, setForm] = useState<CreateDepartmentPayload>({ ...EMPTY_FORM });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: qk.departments.list(accountId),
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => createDepartment(accountId, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ deptId, payload }: { deptId: number; payload: Partial<CreateDepartmentPayload> }) =>
      updateDepartment(accountId, deptId, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (deptId: number) => deleteDepartment(accountId, deptId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) }); setDeleteTarget(null); },
  });

  const openAddModal = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEditModal = (d: Department) => { setEditing(d); setForm({ name: d.name, extension: d.extension ?? "" }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm({ ...EMPTY_FORM }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) { updateMutation.mutate({ deptId: editing.deptId, payload: form }); }
    else { addMutation.mutate(form); }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<Department>[] = [
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => row.name,
      cell: ({ row }) => {
        const initials = (row.original.name ?? "")
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {initials || "—"}
            </div>
            <span className="font-medium text-gray-900">{row.original.name}</span>
          </div>
        );
      },
    },
    { accessorKey: "extension", header: "Ext", cell: ({ row }) => row.original.extension ?? "—" },
    {
      id: "teamMembers",
      header: "Team Members",
      accessorFn: (row) => row.teamMembersDisplay ?? "",
      cell: ({ row }) => (
        <span className="text-sm text-gray-800 truncate max-w-[300px] block" title={row.original.teamMembersDisplay}>
          {row.original.teamMembersDisplay ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
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
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500 mt-1">Total: <strong>{departments.length}</strong></p>
        </div>
        <button onClick={openAddModal} className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium">Add Department</button>
      </div>
      {isLoading ? <div className="py-12 flex justify-center"><Loader variant="inline" label="Loading departments..." /></div> : (
        <DataTable columns={columns} data={departments} searchPlaceholder="Search" />
      )}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? "Edit Department" : "Add Department"}>
        <form onSubmit={handleSubmit}>
          <TextInput label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Sales" required />
          <TextInput label="Extension" value={form.extension ?? ""} onChange={(v) => setForm((f) => ({ ...f, extension: v }))} placeholder="e.g. 3000" />
          {(addMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600 mb-2">{((addMutation.error || updateMutation.error) as Error)?.message ?? "Failed to save"}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={isMutating} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">{isMutating ? "Saving..." : editing ? "Save" : "Add"}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.deptId)} title="Delete Department" message={`Delete department "${deleteTarget?.name}"? Members will be unassigned.`} />
    </div>
  );
}
