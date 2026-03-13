"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchRingGroups,
  fetchRingGroupDetail,
  fetchUsersLight,
  fetchDepartmentsLight,
  createRingGroup,
  deleteRingGroup,
  type RingGroup,
  type RingGroupDetail,
  type RingGroupMember,
  type CreateRingGroupPayload,
} from "@/lib/api/ring-groups";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2, ChevronDown, X } from "lucide-react";

// ── Avatar helpers ───────────────────────────────────────────────────────────
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

// ── RingGroupMembersPopover ───────────────────────────────────────────────────
function RingGroupMembersPopover({
  ringGroup,
  accountId,
}: {
  ringGroup: RingGroup;
  accountId: number;
}) {
  const count = ringGroup.lines?.length ?? 0;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RingGroupDetail | null>(null);
  const [usersLight, setUsersLight] = useState<Array<{ userId: number; firstName: string; lastName: string; extension?: string }>>([]);
  const [deptsLight, setDeptsLight] = useState<Array<{ id: number | string; name: string; extension?: string }>>([]);
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
    Promise.all([
      fetchRingGroupDetail(accountId, ringGroup.id),
      fetchUsersLight(accountId),
      fetchDepartmentsLight(accountId),
    ])
      .then(([d, users, depts]) => {
        if (!cancelled) {
          if (d) setDetail(d);
          setUsersLight(users ?? []);
          setDeptsLight(depts ?? []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [needsFetch, accountId, ringGroup.id]);

  const members = (() => {
    if (!detail?.timeBlock) return [];
    const seen = new Set<string>();
    const out: RingGroupMember[] = [];
    for (const block of detail.timeBlock) {
      for (const tier of block.tier ?? []) {
        for (const m of tier.members ?? []) {
          const key = `${m.type}:${m.data}`;
          if (!seen.has(key)) { seen.add(key); out.push(m); }
        }
      }
      const ft = block.finalTier;
      if (ft?.members) {
        for (const m of ft.members) {
          const key = `${m.type}:${m.data}`;
          if (!seen.has(key)) { seen.add(key); out.push(m); }
        }
      }
    }
    return out;
  })();

  const getMemberLabel = (m: RingGroupMember) => {
    if (m.type === "user") {
      const u = usersLight.find((u) => String(u.userId) === String(m.data));
      return u ? `${u.firstName} ${u.lastName}${u.extension ? ` · ${u.extension}` : ""}` : `User ${m.data}`;
    }
    const d = deptsLight.find((d) => String(d.id) === String(m.data));
    return d ? `${d.name}${d.extension ? ` · ${d.extension}` : ""}` : `Dept ${m.data}`;
  };

  if (count === 0) return <span className="text-sm text-gray-400">0 members</span>;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 group"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(String(ringGroup.id))}`}>
          {count > 9 ? "9+" : count}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#1a73e8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#dadce0] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#f1f3f4] bg-[#f8f9fa]">
            <span className="text-xs font-semibold text-gray-600">
              {count} member{count !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-[#e8eaed] text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">Loading...</div>
            ) : (
              members.map((m, i) => {
                const label = getMemberLabel(m);
                return (
                  <div key={`${m.type}-${m.data}-${i}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f8f9fa]">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${m.type === "user" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {getInitials(label)}
                    </div>
                    <span className="text-sm text-gray-700 truncate">{label || `Member ${i + 1}`}</span>
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
    queryKey: qk.ringGroups.list(accountId),
    queryFn: () => fetchRingGroups(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateRingGroupPayload) => createRingGroup(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.ringGroups.all(accountId) });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => deleteRingGroup(accountId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.ringGroups.all(accountId) });
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
    {
      id: "members",
      header: "Members",
      accessorFn: (row) => row.lines?.length ?? 0,
      cell: ({ row }) => <RingGroupMembersPopover ringGroup={row.original} accountId={accountId} />,
    },
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
