"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { qk } from "@/lib/query-keys";
import {
  fetchInboundBlockList,
  fetchOutboundBlockList,
  addBlockedNumber,
  deleteBlockedNumber,
  type BlockedNumber,
} from "@/lib/api/call-blocking";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Trash2 } from "lucide-react";

export default function CallBlockingPage() {
  const t = useTranslations("callBlockingPage");
  const [tab, setTab] = useState<"inbound" | "outbound">("inbound");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlockedNumber | null>(null);
  const [formNumber, setFormNumber] = useState("");
  const queryClient = useQueryClient();

  const { data: inbound = [], isLoading: inboundLoading } = useQuery({
    queryKey: qk.callBlocking.list("inbound"),
    queryFn: fetchInboundBlockList,
  });

  const { data: outbound = [], isLoading: outboundLoading } = useQuery({
    queryKey: qk.callBlocking.list("outbound"),
    queryFn: fetchOutboundBlockList,
  });

  const data = tab === "inbound" ? inbound : outbound;
  const isLoading = tab === "inbound" ? inboundLoading : outboundLoading;

  const addMutation = useMutation({
    mutationFn: (payload: { number: string }) =>
      addBlockedNumber(tab, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.callBlocking.list(tab),
      });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (number: string) => deleteBlockedNumber(tab, number),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.callBlocking.list(tab),
      });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setFormNumber("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormNumber("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate({ number: formNumber });
  };

  const columns: ColumnDef<BlockedNumber>[] = [
    { accessorKey: "number", header: t("colNumber") },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          onClick={() => setDeleteTarget(row.original)}
          className="p-1.5 rounded hover:bg-red-50 text-red-600"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Call Blocking
      </h1>
      <p className="text-gray-600 mb-6">
        Manage inbound and outbound block lists.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("inbound")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              tab === "inbound"
                ? "bg-[#1a73e8] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Inbound
          </button>
          <button
            onClick={() => setTab("outbound")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              tab === "outbound"
                ? "bg-[#1a73e8] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Outbound
          </button>
        </div>
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
          data={data}
          searchPlaceholder={t("search")}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={`Add ${tab} blocked number`}
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label={t("labelPhoneNumber")}
            value={formNumber}
            onChange={setFormNumber}
            placeholder="e.g. +15551234567"
            type="tel"
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
              Add
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() =>
          deleteTarget?.number && deleteMutation.mutate(deleteTarget.number)
        }
        title={t("removeTitle")}
        message={`Remove ${deleteTarget?.number} from ${tab} block list?`}
      />
    </div>
  );
}
