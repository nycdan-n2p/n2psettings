"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import {
  fetchTieLines,
  updateTieLine,
  addTieLine,
  deleteTieLine,
  type TieLine,
} from "@/lib/api/tie-lines";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { Toggle } from "@/components/settings/Toggle";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

export default function SIPTieLinesPage() {
  const t = useTranslations("sipTieLinesPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTieLine, setEditingTieLine] = useState<TieLine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TieLine | null>(null);
  const [formDestination, setFormDestination] = useState("");
  const [formPrefix, setFormPrefix] = useState("");
  const [formProtocol, setFormProtocol] = useState("tls");
  const [formEnabled, setFormEnabled] = useState(true);

  const { data: tieLines = [], isLoading } = useQuery({
    queryKey: qk.tieLines.all(accountId),
    queryFn: () => fetchTieLines(accountId),
    enabled: !!accountId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      tieLineId,
      enabled,
    }: {
      tieLineId: number;
      enabled: boolean;
    }) => updateTieLine(accountId, tieLineId, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.tieLines.all(accountId) });
    },
  });

  const addMutation = useMutation({
    mutationFn: (payload: Partial<TieLine>) =>
      addTieLine(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.tieLines.all(accountId) });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      tieLineId,
      payload,
    }: {
      tieLineId: number;
      payload: Partial<TieLine>;
    }) => updateTieLine(accountId, tieLineId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.tieLines.all(accountId) });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tieLineId: number) => deleteTieLine(accountId, tieLineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.tieLines.all(accountId) });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setEditingTieLine(null);
    setFormDestination("");
    setFormPrefix("");
    setFormProtocol("tls");
    setFormEnabled(true);
    setModalOpen(true);
  };

  const openEditModal = (t: TieLine) => {
    setEditingTieLine(t);
    setFormDestination(t.outboundDestination ?? "");
    setFormPrefix(t.outboundPrefix ?? "");
    setFormProtocol(t.transportProtocol ?? "tls");
    setFormEnabled(t.enabled);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTieLine(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTieLine) {
      updateMutation.mutate({
        tieLineId: editingTieLine.tieLineId,
        payload: {
          outboundDestination: formDestination,
          outboundPrefix: formPrefix,
          transportProtocol: formProtocol,
          enabled: formEnabled,
        },
      });
    } else {
      addMutation.mutate({
        outboundDestination: formDestination,
        outboundPrefix: formPrefix,
        transportProtocol: formProtocol,
        enabled: formEnabled,
      });
    }
  };

  const columns: ColumnDef<TieLine>[] = [
    { accessorKey: "tieLineId", header: "Id" },
    {
      accessorKey: "enabled",
      header: t("colEnabled"),
      cell: ({ row }) => (
        <Toggle
          checked={row.original.enabled}
          onChange={(v) =>
            toggleMutation.mutate({
              tieLineId: row.original.tieLineId,
              enabled: v,
            })
          }
          disabled={toggleMutation.isPending}
        />
      ),
    },
    { accessorKey: "outboundDestination", header: t("colDestination") },
    { accessorKey: "transportProtocol", header: t("colProtocol") },
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
          <h1 className="text-2xl font-medium text-gray-900">
            SIP Tie-Lines
          </h1>
          <p className="text-gray-600 mt-2">
            Manage SIP tie-line configurations.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="sm:ml-auto px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add tie-line
        </button>
      </div>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={tieLines}
          searchPlaceholder={t("search")}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingTieLine ? t("editTitle") : t("addTitle")}
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label={t("labelDest")}
            value={formDestination}
            onChange={setFormDestination}
            placeholder="e.g. test.test"
          />
          <TextInput
            label={t("labelPrefix")}
            value={formPrefix}
            onChange={setFormPrefix}
            placeholder="e.g. 81"
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Protocol
            </label>
            <select
              value={formProtocol}
              onChange={(e) => setFormProtocol(e.target.value)}
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
            >
              <option value="tls">TLS</option>
              <option value="udp">UDP</option>
              <option value="tcp">TCP</option>
            </select>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <Toggle
              checked={formEnabled}
              onChange={setFormEnabled}
            />
            <span className="text-sm text-gray-700">{t("labelEnabled")}</span>
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
              {editingTieLine ? t("common_save") : t("addButton")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.tieLineId)
        }
        title={t("deleteTitle")}
        message={`Remove tie-line ${deleteTarget?.tieLineId}?`}
      />
    </div>
  );
}
