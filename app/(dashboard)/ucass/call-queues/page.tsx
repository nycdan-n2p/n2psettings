"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchCallQueues,
  createCallQueue,
  deleteCallQueue,
  type CallQueue,
  type CreateCallQueuePayload,
} from "@/lib/api/call-queues";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2, Users, ChevronRight } from "lucide-react";

const EMPTY_FORM: CreateCallQueuePayload = { name: "", extension: "", strategy: "round-robin" };

export default function CallQueuesPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CallQueue | null>(null);
  const [form, setForm] = useState<CreateCallQueuePayload>({ ...EMPTY_FORM });

  const { data: queues = [], isLoading } = useQuery({
    queryKey: qk.callQueues.list(accountId),
    queryFn: () => fetchCallQueues(),
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateCallQueuePayload) => createCallQueue(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.callQueues.all(accountId) });
      setAddModalOpen(false);
      setForm({ ...EMPTY_FORM });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCallQueue(accountId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.callQueues.all(accountId) });
      setDeleteTarget(null);
    },
  });

  const columns: ColumnDef<CallQueue>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <button
          onClick={() => router.push(`/ucass/call-queues/${row.original.id}`)}
          className="flex items-center gap-2 text-[#1a73e8] hover:underline font-medium text-sm"
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: "extension",
      header: "Extension",
      cell: ({ row }) => row.original.extension ?? "—",
    },
    {
      id: "agents",
      header: "Agents",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          {row.original.agents_count ?? "—"}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => router.push(`/ucass/call-queues/${row.original.id}`)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded hover:bg-red-50 text-red-500"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <ChevronRight
            className="w-4 h-4 text-gray-300 ml-1 cursor-pointer"
            onClick={() => router.push(`/ucass/call-queues/${row.original.id}`)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Call Queues</h1>
          <p className="text-sm text-gray-500 mt-1">{queues.length} queues</p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add Call Queue
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading call queues..." />
        </div>
      ) : (
        <DataTable columns={columns} data={queues} searchPlaceholder="Search call queues..." />
      )}

      {/* Add modal */}
      <Modal isOpen={addModalOpen} onClose={() => { setAddModalOpen(false); setForm({ ...EMPTY_FORM }); }} title="Add Call Queue">
        <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(form); }}>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Support Queue"
            required
          />
          <TextInput
            label="Extension"
            value={form.extension ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, extension: v }))}
            placeholder="e.g. 6000"
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
            <select
              value={form.strategy ?? "round-robin"}
              onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
            >
              <option value="round-robin">Round Robin</option>
              <option value="ring-all">Ring All</option>
              <option value="longest-idle">Longest Idle</option>
              <option value="least-calls">Fewest Calls</option>
              <option value="linear">Linear</option>
            </select>
          </div>
          {addMutation.isError && (
            <p className="text-sm text-red-600 mb-2">
              {(addMutation.error as Error)?.message ?? "Failed to create queue"}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => { setAddModalOpen(false); setForm({ ...EMPTY_FORM }); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50"
            >
              {addMutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Call Queue"
        message={`Delete call queue "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
  );
}
