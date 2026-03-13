"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchCallQueues,
  fetchCallQueueDetail,
  createCallQueue,
  deleteCallQueue,
  type CallQueue,
  type CreateCallQueuePayload,
  type QueueAgent,
} from "@/lib/api/call-queues";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2, ChevronDown, ChevronRight, X } from "lucide-react";

// ── Avatar helpers (consistent with Departments / Ring Groups) ─────────────────
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function getInitials(label: string): string {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
}

// ── CallQueueAgentsPopover ─────────────────────────────────────────────────────
function CallQueueAgentsPopover({
  queue,
  accountId,
}: {
  queue: CallQueue;
  accountId: number;
}) {
  const count = queue.agents_count ?? 0;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ agents?: QueueAgent[]; supervisors?: QueueAgent[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const needsFetch = count > 0 && open && !detail;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!needsFetch || !accountId) return;
    let cancelled = false;
    setLoading(true);
    fetchCallQueueDetail(queue.id, accountId)
      .then((d) => {
        if (!cancelled && d) setDetail({ agents: d.agents, supervisors: d.supervisors });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [needsFetch, accountId, queue.id]);

  const agents = (() => {
    if (!detail) return [];
    const seen = new Set<string>();
    const out: QueueAgent[] = [];
    for (const a of detail.agents ?? []) {
      const key = String(a.user_id ?? a.id ?? a.display_name ?? "");
      if (!seen.has(key)) { seen.add(key); out.push(a); }
    }
    for (const a of detail.supervisors ?? []) {
      const key = String(a.user_id ?? a.id ?? a.display_name ?? "");
      if (!seen.has(key)) { seen.add(key); out.push(a); }
    }
    return out;
  })();

  const getAgentLabel = (a: QueueAgent) => {
    const name = a.display_name?.trim() || `Agent ${a.user_id ?? a.id ?? "?"}`;
    return a.extension ? `${name} · ${a.extension}` : name;
  };

  if (count === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-100 text-gray-500">
          0
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 group"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(String(queue.id))}`}>
          {count > 9 ? "9+" : count}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#1a73e8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#dadce0] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#f1f3f4] bg-[#f8f9fa]">
            <span className="text-xs font-semibold text-gray-600">
              {count} agent{count !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-[#e8eaed] text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">Loading...</div>
            ) : (
              agents.map((a, i) => {
                const label = getAgentLabel(a);
                return (
                  <div key={`${a.user_id ?? a.id ?? i}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f8f9fa]">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(String(a.user_id ?? a.id ?? i))}`}>
                      {getInitials(a.display_name ?? "")}
                    </div>
                    <span className="text-sm text-gray-700 truncate">{label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
      accessorFn: (row) => row.agents_count ?? 0,
      cell: ({ row }) => <CallQueueAgentsPopover queue={row.original} accountId={accountId} />,
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
