"use client";
import { useTranslations } from "next-intl";
// i18n applied

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
import { Pencil, Trash2, ChevronDown, X, Zap, LayoutDashboard, Users } from "lucide-react";

// ── Call Center Essentials upsell banner ──────────────────────────────────────
const DISMISS_KEY = "cce-upsell-ring-groups-dismissed";

function CallCenterUpsellBanner() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISS_KEY) !== "1";
  });

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative mb-6 rounded-[16px] border border-[#1a73e8]/30 bg-gradient-to-r from-[#e8f0fe] to-[#f3e8ff] p-4 flex items-start gap-4">
      <div className="shrink-0 w-9 h-9 rounded-lg bg-[#1a73e8] flex items-center justify-center">
        <Zap className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 mb-1">
          Ready to handle higher call volumes?
        </p>
        <p className="text-xs text-gray-600 leading-relaxed mb-3">
          Ring Groups work great for simple routing — but growing teams need more.{" "}
          <span className="font-semibold text-gray-800">Call Center Essentials</span> unlocks:
        </p>
        <ul className="text-xs text-gray-700 space-y-1 mb-3">
          <li className="flex items-center gap-2">
            <LayoutDashboard className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
            <span><span className="font-medium">Call Queues</span> — priority routing, overflow handling &amp; hold music</span>
          </li>
          <li className="flex items-center gap-2">
            <LayoutDashboard className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
            <span><span className="font-medium">Wallboard</span> — live queue &amp; agent performance at a glance</span>
          </li>
          <li className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#1a73e8] shrink-0" />
            <span><span className="font-medium">Supervisor Panel</span> — monitor, whisper &amp; barge into live calls</span>
          </li>
        </ul>
        <a
          href="mailto:sales@net2phone.com?subject=Call Center Essentials"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] text-white text-xs font-medium rounded-md hover:bg-[#1557b0] transition-colors"
        >
          <Zap className="w-3 h-3" />
          Talk to Sales
        </a>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 p-1 rounded hover:bg-black/10 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

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
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const needsFetch = count > 0 && open && !detail;

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const flip = window.innerHeight - rect.bottom < 340 && rect.top > 340;
      setPos({ top: flip ? rect.top - 8 : rect.bottom + 8, left: rect.left, flip });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
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
    <div className="inline-block">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 group"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(String(ringGroup.id))}`}>
          {count > 9 ? "9+" : count}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#1a73e8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos.flip ? undefined : pos.top,
            bottom: pos.flip ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            zIndex: 9999,
          }}
          className="w-64 bg-white rounded-[16px] shadow-xl border border-[#dadce0] overflow-hidden"
        >
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
  const t = useTranslations("ringGroupsPage");
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
    { accessorKey: "name", header: t("colName") },
    { accessorKey: "extension", header: t("colExt"), cell: ({ row }) => row.original.extension ?? "—" },
    {
      id: "members",
      header: t("colMembers"),
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{groups.length} groups</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add Ring Group
        </button>
      </div>

      <CallCenterUpsellBanner />

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader variant="inline" label={t("loading")} /></div>
      ) : (
        <DataTable columns={columns} data={groups} searchPlaceholder={t("search")} />
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={t("addTitle")}>
        <form onSubmit={handleSubmit}>
          <TextInput
            label={t("labelName")}
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder={t("placeholderName")}
            required
          />
          <TextInput
            label={t("labelExt")}
            value={form.extension ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, extension: v }))}
            placeholder={t("placeholderExt")}
          />
          {addMutation.isError && (
            <p className="text-sm text-red-600 mb-2">{(addMutation.error as Error)?.message ?? t("failedToCreate")}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">
              {addMutation.isPending ? t("creating") : t("addButton")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={t("deleteTitle")}
        message={`Delete ring group "${deleteTarget?.name}"?`}
      />
    </div>
  );
}
