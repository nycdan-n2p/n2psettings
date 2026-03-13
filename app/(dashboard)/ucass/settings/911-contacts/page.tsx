"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import {
  fetchKarisLaw,
  addKarisLawNumber,
  deleteKarisLawNumber,
  type KariLawEntry,
} from "@/lib/api/karis-law";
import { DataTable } from "@/components/tables/DataTable";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Loader } from "@/components/ui/Loader";
import { Phone, Trash2, Info } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

function formatPhone(s: string): string {
  const d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return s;
}

export default function E911ContactsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [formNumber, setFormNumber] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<KariLawEntry | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: qk.karis.all(accountId),
    queryFn: () => fetchKarisLaw(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (number: string) =>
      addKarisLawNumber(accountId, { number }),
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

  const openAdd = () => {
    setFormNumber("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormNumber("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(formNumber);
  };

  const columns: ColumnDef<KariLawEntry>[] = [
    {
      id: "number",
      header: "NUMBER",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-400" />
          <span className="text-[0.65rem]">🇺🇸</span>
          <span>{formatPhone(row.original.number)}</span>
        </div>
      ),
    },
    {
      id: "addedOn",
      header: "ADDED ON",
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
    },
    {
      id: "addedBy",
      header: "ADDED BY",
      cell: ({ row }) =>
        row.original.addedBy ?? row.original.ownerName ?? "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setDeleteTarget(row.original)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            911 / EMERGENCY CALL NOTIFICATION
          </h1>
          <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
            Contacts on this list will be notified by SMS when any extension
            dials 911.
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-xs cursor-help"
              title="These contacts receive SMS notifications when 911 is dialed from any extension."
            >
              <Info className="w-3 h-3" />
            </span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="shrink-0 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium uppercase"
        >
          ADD NUMBER
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading contacts..." />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={contacts}
          searchPlaceholder="Search numbers..."
        />
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title="Add Number">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Phone number"
            value={formNumber}
            onChange={setFormNumber}
            type="tel"
            placeholder="e.g. 19734384842 or (973) 438-4842"
            required
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
              disabled={addMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50"
            >
              {addMutation.isPending ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Remove 911 Contact"
        message={`Remove ${deleteTarget ? formatPhone(deleteTarget.number) : ""} from emergency notifications?`}
      />
    </div>
  );
}
