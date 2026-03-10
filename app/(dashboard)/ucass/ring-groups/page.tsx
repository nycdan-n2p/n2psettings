"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import {
  fetchRingGroups,
  createRingGroup,
  deleteRingGroup,
  type RingGroup,
  type CreateRingGroupPayload,
} from "@/lib/api/ring-groups";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

const EMPTY_FORM: CreateRingGroupPayload = { name: "", extension: "" };

export default function RingGroupsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RingGroup | null>(null);
  const [form, setForm] = useState<CreateRingGroupPayload>({ ...EMPTY_FORM });

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["ring-groups", accountId],
    queryFn: () => fetchRingGroups(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateRingGroupPayload) => createRingGroup(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ring-groups", accountId] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => deleteRingGroup(accountId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ring-groups", accountId] });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => { setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setForm({ ...EMPTY_FORM }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(form);
  };

  const columns: ColumnDef<RingGroup>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "extension", header: "Extension", cell: ({ row }) => row.original.extension ?? "—" },
    { id: "members", header: "Members", cell: ({ row }) => row.original.lines?.length ?? 0 },
    {
      id: "actions", header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/ucass/ring-groups/${row.original.id}`)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded hover:bg-red-50 text-red-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Ring Groups</h1>
          <p className="text-sm text-gray-500 mt-1">{groups.length} groups</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add Ring Group
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader variant="inline" label="Loading ring groups..." /></div>
      ) : (
        <DataTable columns={columns} data={groups} searchPlaceholder="Search ring groups..." />
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title="Add Ring Group">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Sales Team"
            required
          />
          <TextInput
            label="Extension"
            value={form.extension ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, extension: v }))}
            placeholder="e.g. 5000"
          />
          {addMutation.isError && (
            <p className="text-sm text-red-600 mb-2">{(addMutation.error as Error)?.message ?? "Failed to create"}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">
              {addMutation.isPending ? "Creating..." : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Ring Group"
        message={`Delete ring group "${deleteTarget?.name}"?`}
      />
    </div>
  );
}
