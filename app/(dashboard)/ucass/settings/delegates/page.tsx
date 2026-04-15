"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import {
  fetchDelegates,
  addDelegate,
  updateDelegate,
  deleteDelegate,
  type Delegate,
} from "@/lib/api/delegates";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

export default function DelegatesPage() {
  const t = useTranslations("delegatesPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDelegate, setEditingDelegate] = useState<Delegate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Delegate | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formType, setFormType] = useState("client");

  const { data: delegates = [], isLoading } = useQuery({
    queryKey: qk.delegates.all(accountId),
    queryFn: () => fetchDelegates(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: { name: string; email: string; type?: string }) =>
      addDelegate(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.delegates.all(accountId) });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<Delegate>;
    }) => updateDelegate(accountId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.delegates.all(accountId) });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDelegate(accountId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.delegates.all(accountId) });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setEditingDelegate(null);
    setFormName("");
    setFormEmail("");
    setFormType("client");
    setModalOpen(true);
  };

  const openEditModal = (d: Delegate) => {
    setEditingDelegate(d);
    setFormName(d.name);
    setFormEmail(d.email);
    setFormType(d.type || "client");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDelegate(null);
    setFormName("");
    setFormEmail("");
    setFormType("client");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDelegate) {
      updateMutation.mutate({
        id: editingDelegate.id,
        payload: { name: formName, email: formEmail, type: formType },
      });
    } else {
      addMutation.mutate({
        name: formName,
        email: formEmail,
        type: formType,
      });
    }
  };

  const columns: ColumnDef<Delegate>[] = [
    { accessorKey: "name", header: t("colName") },
    { accessorKey: "email", header: t("colEmail") },
    { accessorKey: "type", header: t("colType") },
    { accessorKey: "status", header: t("colStatus") },
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-gray-600 mt-2">
            Partner access and delegate management.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="sm:ml-auto px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add delegate
        </button>
      </div>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={delegates}
          searchPlaceholder={t("search")}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingDelegate ? t("editTitle") : t("addTitle")}
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label={t("labelName")}
            value={formName}
            onChange={setFormName}
            placeholder={t("labelName")}
            required
          />
          <TextInput
            label={t("labelEmail")}
            value={formEmail}
            onChange={setFormEmail}
            type="email"
            placeholder="email@example.com"
            required
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
            >
              <option value="client">{t("typeClient")}</option>
              <option value="admin">{t("typeAdmin")}</option>
            </select>
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
              {editingDelegate ? t("common_save") : t("addButton")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={t("deleteTitle")}
        message={`Remove ${deleteTarget?.name} from delegates?`}
      />
    </div>
  );
}
