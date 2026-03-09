"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import {
  fetchVirtualFaxes,
  addVirtualFax,
  updateVirtualFax,
  deleteVirtualFax,
  type VirtualFax,
} from "@/lib/api/virtual-fax";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { Toggle } from "@/components/settings/Toggle";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

export default function VirtualFaxPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFax, setEditingFax] = useState<VirtualFax | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VirtualFax | null>(null);
  const [formNumber, setFormNumber] = useState("");
  const [formIncoming, setFormIncoming] = useState("");
  const [formOutgoing, setFormOutgoing] = useState("");
  const [formEncrypt, setFormEncrypt] = useState(false);

  const { data: faxes = [], isLoading } = useQuery({
    queryKey: ["virtual-fax", accountId],
    queryFn: () => fetchVirtualFaxes(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: VirtualFax) => addVirtualFax(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["virtual-fax", accountId] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      phoneNumber,
      payload,
    }: {
      phoneNumber: string;
      payload: Partial<VirtualFax>;
    }) => updateVirtualFax(accountId, phoneNumber, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["virtual-fax", accountId] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (phoneNumber: string) =>
      deleteVirtualFax(accountId, phoneNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["virtual-fax", accountId] });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setEditingFax(null);
    setFormNumber("");
    setFormIncoming("");
    setFormOutgoing("");
    setFormEncrypt(false);
    setModalOpen(true);
  };

  const openEditModal = (f: VirtualFax) => {
    setEditingFax(f);
    setFormNumber(f.phoneNumber);
    setFormIncoming(f.incoming?.join(", ") ?? "");
    setFormOutgoing(f.outgoing?.join(", ") ?? "");
    setFormEncrypt(f.encrypt ?? false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingFax(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const incoming = formIncoming
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const outgoing = formOutgoing
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingFax) {
      updateMutation.mutate({
        phoneNumber: editingFax.phoneNumber,
        payload: {
          incoming,
          outgoing,
          encrypt: formEncrypt,
        },
      });
    } else {
      addMutation.mutate({
        phoneNumber: formNumber,
        incoming,
        outgoing,
        encrypt: formEncrypt,
      });
    }
  };

  const columns: ColumnDef<VirtualFax>[] = [
    { accessorKey: "phoneNumber", header: "Number" },
    {
      accessorKey: "incoming",
      header: "Incoming",
      cell: ({ row }) => row.original.incoming?.join(", ") ?? "—",
    },
    {
      accessorKey: "outgoing",
      header: "Outgoing",
      cell: ({ row }) => row.original.outgoing?.join(", ") ?? "—",
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
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Virtual Fax</h1>
      <p className="text-gray-600 mb-6">
        Manage virtual fax numbers and email routing.
      </p>
      <div className="mb-4">
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add fax number
        </button>
      </div>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={faxes}
          searchPlaceholder="Search fax numbers..."
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingFax ? "Edit fax" : "Add fax number"}
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Phone number"
            value={formNumber}
            onChange={setFormNumber}
            placeholder="e.g. 15167582967"
            type="tel"
            required
            disabled={!!editingFax}
          />
          <TextInput
            label="Incoming emails (comma-separated)"
            value={formIncoming}
            onChange={setFormIncoming}
            placeholder="email1@example.com, email2@example.com"
          />
          <TextInput
            label="Outgoing emails (comma-separated)"
            value={formOutgoing}
            onChange={setFormOutgoing}
            placeholder="email1@example.com, email2@example.com"
          />
          <div className="mb-4 flex items-center gap-2">
            <Toggle checked={formEncrypt} onChange={setFormEncrypt} />
            <span className="text-sm text-gray-700">Encrypt</span>
          </div>
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
              {editingFax ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.phoneNumber)
        }
        title="Delete fax number"
        message={`Remove ${deleteTarget?.phoneNumber} from virtual fax?`}
      />
    </div>
  );
}
