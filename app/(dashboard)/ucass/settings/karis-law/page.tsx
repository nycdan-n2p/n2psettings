"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import {
  fetchKarisLaw,
  addKarisLawNumber,
  updateKarisLawNumber,
  deleteKarisLawNumber,
  type KariLawEntry,
} from "@/lib/api/karis-law";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

export default function KarisLawPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KariLawEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KariLawEntry | null>(null);
  const [formNumber, setFormNumber] = useState("");
  const [formOwner, setFormOwner] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: qk.karis.all(accountId),
    queryFn: () => fetchKarisLaw(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: { number: string; ownerName?: string }) =>
      addKarisLawNumber(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.karis.all(accountId) });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<KariLawEntry>;
    }) => updateKarisLawNumber(accountId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.karis.all(accountId) });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteKarisLawNumber(accountId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.karis.all(accountId) });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setEditingEntry(null);
    setFormNumber("");
    setFormOwner("");
    setModalOpen(true);
  };

  const openEditModal = (entry: KariLawEntry) => {
    setEditingEntry(entry);
    setFormNumber(entry.number);
    setFormOwner(entry.ownerName ?? "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEntry(null);
    setFormNumber("");
    setFormOwner("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        payload: { number: formNumber, ownerName: formOwner || undefined },
      });
    } else {
      addMutation.mutate({
        number: formNumber,
        ownerName: formOwner || undefined,
      });
    }
  };

  const columns: ColumnDef<KariLawEntry>[] = [
    { accessorKey: "number", header: "Number" },
    { accessorKey: "ownerName", header: "Owner" },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString()
          : "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(row.original)}
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
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Kari&apos;s Law
      </h1>
      <p className="text-gray-600 mb-6">
        Emergency notification numbers (E911).
      </p>
      <div className="mb-4">
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add number
        </button>
      </div>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          searchPlaceholder="Search numbers..."
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingEntry ? "Edit number" : "Add number"}
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Phone number"
            value={formNumber}
            onChange={setFormNumber}
            placeholder="e.g. 19734384842"
            type="tel"
            required
          />
          <TextInput
            label="Owner name"
            value={formOwner}
            onChange={setFormOwner}
            placeholder="Optional"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50"
            >
              {editingEntry ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete number"
        message={`Remove ${deleteTarget?.number} from emergency notifications?`}
      />
    </div>
  );
}
