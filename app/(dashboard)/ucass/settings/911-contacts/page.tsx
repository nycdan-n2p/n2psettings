"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import {
  fetchKarisLaw,
  addKarisLawNumber,
  updateKarisLawNumber,
  deleteKarisLawNumber,
  type KariLawEntry,
} from "@/lib/api/karis-law";
import { DataTable } from "@/components/tables/DataTable";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Loader } from "@/components/ui/Loader";
import { Phone, Pencil, Trash2, AlertTriangle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

function formatPhone(s: string): string {
  const d = s.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return s;
}

export default function EmergencySettingsPage() {
  const t = useTranslations("emergencySettingsPage");
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
    mutationFn: ({ id, payload }: { id: number; payload: Partial<KariLawEntry> }) =>
      updateKarisLawNumber(accountId, id, payload),
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
      addMutation.mutate({ number: formNumber, ownerName: formOwner || undefined });
    }
  };

  const columns: ColumnDef<KariLawEntry>[] = [
    {
      id: "number",
      header: t("colNumber"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-gray-400" />
          <span>{formatPhone(row.original.number)}</span>
        </div>
      ),
    },
    {
      accessorKey: "ownerName",
      header: t("colOwner"),
      cell: ({ row }) => row.original.ownerName ?? "—",
    },
    {
      id: "createdAt",
      header: t("colAddedOn"),
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={() => openEditModal(row.original)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
            title={t("editTooltip")}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded hover:bg-red-50 text-red-500"
            title={t("deleteTooltip")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-600 mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={openAddModal}
          className="shrink-0 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          {t("addButton")}
        </button>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">{t("karisLawNotice")}</p>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label={t("loading")} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={entries}
          searchPlaceholder={t("search")}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingEntry ? t("editTitle") : t("addTitle")}
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label={t("labelPhoneNumber")}
            value={formNumber}
            onChange={setFormNumber}
            type="tel"
            placeholder="e.g. (973) 438-4842"
            required
          />
          <TextInput
            label={t("labelOwnerName")}
            value={formOwner}
            onChange={setFormOwner}
            placeholder={t("placeholderOptional")}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50"
            >
              {addMutation.isPending || updateMutation.isPending
                ? t("saving")
                : editingEntry
                ? t("saveButton")
                : t("addButton")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={t("deleteTitle")}
        message={`${t("deleteMessage")} ${deleteTarget ? formatPhone(deleteTarget.number) : ""}?`}
      />
    </div>
  );
}
