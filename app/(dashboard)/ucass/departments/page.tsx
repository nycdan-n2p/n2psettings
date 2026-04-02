"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk, lightKeys } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchDepartments,
  fetchDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  assignUserToDepartment,
  unassignUserFromDepartment,
  fetchDepartmentFeatures,
  updateDepartmentFeature,
  fetchDepartmentCallForwardRules,
  updateDepartmentCallForwardRules,
  type Department,
  type CreateDepartmentPayload,
  type DepartmentMember,
  type DepartmentCallForwardRules,
} from "@/lib/api/departments";
import { fetchPhoneNumbers } from "@/lib/api/phone-numbers";
import { fetchUsersLight } from "@/lib/api/ring-groups";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2, Phone, ChevronDown, Plus, X, GripVertical, Play } from "lucide-react";

// ── Avatar helpers (for DepartmentMembersPopover) ─────────────────────────────
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
function getInitials(firstName?: string, lastName?: string): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.map((p) => p?.[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?";
}

// ── DepartmentMembersPopover ─────────────────────────────────────────────────
function DepartmentMembersPopover({
  department,
  accountId,
}: {
  department: Department;
  accountId: number;
}) {
  const count = department.memberCount ?? department.members?.length ?? 0;
  const [open, setOpen] = useState(false);
  const [fetchedDept, setFetchedDept] = useState<Department | null>(null);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const members = department.members ?? fetchedDept?.members ?? [];
  const needsFetch = count > 0 && members.length === 0 && open;

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
    fetchDepartment(accountId, department.deptId)
      .then((d) => {
        if (!cancelled && d) setFetchedDept(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [needsFetch, accountId, department.deptId]);

  if (count === 0) return <span className="text-sm text-gray-400">0 members</span>;

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 group"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(String(department.deptId))}`}>
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
              members.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f8f9fa]">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(String(m.userId))}`}>
                    {getInitials(m.firstName, m.lastName)}
                  </div>
                  <span className="text-sm text-gray-700 truncate">
                    {[m.firstName, m.lastName].filter(Boolean).join(" ")}
                    {m.extension ? ` · ${m.extension}` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM: CreateDepartmentPayload = { name: "", extension: "" };

function formatPhoneDisplay(num: string): string {
  const digits = num.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const mid = digits.slice(4, 7);
    const last = digits.slice(7);
    return `(${area}) ${mid}-${last}`;
  }
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const mid = digits.slice(3, 6);
    const last = digits.slice(6);
    return `(${area}) ${mid}-${last}`;
  }
  return num;
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-[#1a73e8]" : "bg-gray-300"
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// ── Call Options Tab ─────────────────────────────────────────────────────────────
const RULE_TYPE_OPTIONS = [
  { value: "seq", label: "Ring 1 Team Member At A Time" },
  { value: "ring_all", label: "Ring All Team Members" },
];

const RINGS_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];

function CallOptionsTab({
  callForwardRules,
  isLoading,
  usersLight,
  onUpdate,
  isUpdating,
}: {
  callForwardRules: DepartmentCallForwardRules | undefined;
  isLoading: boolean;
  usersLight: Array<{ userId: number; firstName: string; lastName: string; extension?: string }>;
  onUpdate: (payload: Partial<DepartmentCallForwardRules>) => void;
  isUpdating: boolean;
}) {
  const rules = callForwardRules ?? { ruletype: "seq", forwardTo: [], callerIdFlag: false, callScreeningFlag: false };
  const defaultRings = rules.forwardTo[0]?.rings ?? 5;

  const getUserName = (userId: string) => {
    const u = usersLight.find((x) => String(x.userId) === userId);
    return u ? `${u.firstName} ${u.lastName}` : `User ${userId}`;
  };

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader variant="inline" label="Loading call options..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="grid grid-cols-[1fr_100px] gap-4 mb-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-2">Call Forwarding Rule</label>
            <select
              value={rules.ruletype}
              onChange={(e) => onUpdate({ ...rules, ruletype: e.target.value })}
              disabled={isUpdating}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-[14px] bg-white focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
            >
              {RULE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-2">Rings</label>
            <select
              value={defaultRings}
              onChange={(e) => {
                const rings = Number(e.target.value);
                const forwardTo = rules.forwardTo.map((f) => ({ ...f, rings }));
                onUpdate({ ...rules, forwardTo });
              }}
              disabled={isUpdating}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-[14px] bg-white focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
            >
              {RINGS_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} Rings</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {rules.forwardTo.length > 0 && (
        <div>
          <label className="block text-[13px] font-medium text-gray-700 mb-2">Call Order</label>
          <div className="flex flex-col gap-2">
            {rules.forwardTo
              .sort((a, b) => Number(a.sequence) - Number(b.sequence))
              .map((item, i) => (
                <div
                  key={`${item.type}-${item.value}-${i}`}
                  className="flex items-center gap-3 py-2.5 px-4 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-medium shrink-0">
                    {(getUserName(item.value) ?? "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <span className="flex-1 text-[14px] text-gray-800">{getUserName(item.value)}</span>
                  <span className="text-[13px] text-gray-600">{item.rings} Rings</span>
                  <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
              ))}
          </div>
          <p className="text-[13px] text-gray-500 mt-1">Call order is determined by the members in the Department tab.</p>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50/30 px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-medium text-gray-900">Incoming Call ID</h4>
          <p className="text-[13px] text-gray-600 mt-0.5">
            Caller ID will show your net2phone number instead of the caller&apos;s phone number.
          </p>
        </div>
        <Toggle
          checked={rules.callerIdFlag}
          onChange={(v) => onUpdate({ ...rules, callerIdFlag: v })}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50/30 px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-medium text-gray-900">Call Screening</h4>
          <p className="text-[13px] text-gray-600 mt-0.5">
            Informs you that it&apos;s a net2phone call, not in your personal line, and provides Accept/Deny Call capabilities.
          </p>
        </div>
        <Toggle
          checked={rules.callScreeningFlag}
          onChange={(v) => onUpdate({ ...rules, callScreeningFlag: v })}
        />
      </div>
    </div>
  );
}

// ── Voicemail Tab ───────────────────────────────────────────────────────────────
function VoicemailTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50/30 px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-medium text-gray-900">Voicemail</h4>
          <p className="text-[13px] text-gray-600 mt-0.5">
            When off, your callers won&apos;t be able to leave you a voicemail if you miss their calls.
          </p>
        </div>
        <Toggle checked={true} onChange={() => {}} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50/30 px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <h4 className="text-[14px] font-medium text-gray-900">Voicemail-To-Email</h4>
          <p className="text-[13px] text-gray-600 mt-0.5">
            Email me when I get a new voicemail.
          </p>
        </div>
        <Toggle checked={true} onChange={() => {}} />
      </div>

      <div className="rounded-lg border border-gray-200 px-4 py-4">
        <h4 className="text-[14px] font-medium text-gray-900 mb-2">Greeting</h4>
        <p className="text-[13px] text-gray-600 mb-3">Playing: Default Voicemail Greeting.</p>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full bg-[#1a73e8] text-white flex items-center justify-center hover:bg-[#1557b0]">
            <Play className="w-4 h-4 ml-0.5 fill-white" />
          </button>
          <div className="flex-1 h-2 bg-gray-200 rounded-full" />
          <span className="text-[13px] text-gray-600">00:00</span>
        </div>
        <div className="mt-3 space-y-2">
          {["Default Voicemail Greeting", "Custom Voicemail Greeting", "Record Greeting via Phone"].map((opt, i) => (
            <label key={opt} className="flex items-center gap-2">
              <input type="radio" name="greeting" defaultChecked={i === 0} className="rounded-full border-gray-300 text-[#1a73e8] focus:ring-[#1a73e8]" />
              <span className="text-[14px] text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      </div>

      <Link
        href="/ucass/settings/voicemail"
        className="text-[14px] text-[#1a73e8] hover:underline"
      >
        Update Password
      </Link>
    </div>
  );
}

// ── Add Member Row ──────────────────────────────────────────────────────────────
function AddMemberRow({
  users,
  currentMembers,
  onAdd,
}: {
  users: Array<{ userId: number; firstName: string; lastName: string; extension?: string }>;
  currentMembers: DepartmentMember[];
  onAdd: (userId: number) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const currentIds = new Set(currentMembers.map((m) => m.userId));
  const available = users.filter((u) => !currentIds.has(u.userId));

  return (
    <div className="flex gap-2 items-center mt-3">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-[14px] bg-white focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
      >
        <option value="">Select team member…</option>
        {available.map((u) => (
          <option key={u.userId} value={String(u.userId)}>
            {u.firstName} {u.lastName}
            {u.extension ? ` · ${u.extension}` : ""}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!selectedId) return;
          onAdd(Number(selectedId));
          setSelectedId("");
        }}
        disabled={!selectedId}
        className="flex items-center gap-1.5 px-4 py-2 bg-[#1a73e8] text-white rounded-lg text-[14px] font-medium hover:bg-[#1557b0] disabled:opacity-40 shrink-0 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add
      </button>
    </div>
  );
}

// ── Department Edit Modal (full edit) ────────────────────────────────────────────
function DepartmentEditModal({
  department,
  isOpen,
  onClose,
  onSuccess,
  onDelete,
}: {
  department: Department;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onDelete: () => void;
}) {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"department" | "callOptions" | "voicemail">("department");
  const [name, setName] = useState(department.name);
  const [members, setMembers] = useState<DepartmentMember[]>(department.members ?? []);

  const { data: departmentsList = [] } = useQuery({
    queryKey: qk.departments.list(accountId),
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId && isOpen,
  });
  const latestDept = departmentsList.find((d) => d.deptId === department.deptId) ?? department;

  useEffect(() => {
    setName(latestDept.name);
    setMembers(latestDept.members ?? []);
  }, [latestDept]);

  const { data: features = [] } = useQuery({
    queryKey: qk.departments.features(accountId, department.deptId),
    queryFn: () => fetchDepartmentFeatures(accountId, department.deptId),
    enabled: !!accountId && !!department.deptId && isOpen,
  });

  const { data: phoneNumbers = [] } = useQuery({
    queryKey: qk.phoneNumbers.all(accountId),
    queryFn: () => fetchPhoneNumbers(accountId),
    enabled: !!accountId && isOpen,
  });

  const { data: usersLight = [] } = useQuery({
    queryKey: lightKeys.users(accountId),
    queryFn: () => fetchUsersLight(accountId),
    enabled: !!accountId && isOpen,
  });

  const { data: callForwardRules, isLoading: callForwardLoading } = useQuery({
    queryKey: qk.departments.callForwardRules(accountId, department.deptId),
    queryFn: () => fetchDepartmentCallForwardRules(accountId, department.deptId),
    enabled: !!accountId && !!department.deptId && isOpen && activeTab === "callOptions",
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CreateDepartmentPayload>) =>
      updateDepartment(accountId, department.deptId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      onSuccess();
    },
  });

  const recordMutation = useMutation({
    mutationFn: (active: boolean) =>
      updateDepartmentFeature(accountId, department.deptId, "record", active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.features(accountId, department.deptId) });
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (userId: number) => assignUserToDepartment(accountId, userId, department.deptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      queryClient.invalidateQueries({ queryKey: lightKeys.users(accountId) });
      queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) });
      // Refresh members from departments list
      queryClient.invalidateQueries({ queryKey: qk.departments.list(accountId) });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (userId: number) => unassignUserFromDepartment(accountId, userId, department.deptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      queryClient.invalidateQueries({ queryKey: lightKeys.users(accountId) });
      queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) });
      queryClient.invalidateQueries({ queryKey: qk.departments.list(accountId) });
    },
  });

  const callForwardMutation = useMutation({
    mutationFn: (payload: Partial<DepartmentCallForwardRules>) =>
      updateDepartmentCallForwardRules(accountId, department.deptId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.callForwardRules(accountId, department.deptId) });
    },
  });

  const recording = features.find((f) => f.id === "record")?.active ?? false;

  const deptNumbers = phoneNumbers.filter(
    (pn) =>
      (pn.routeToId === department.deptId || pn.deptId === department.deptId) &&
      (pn.routeType === "department" || pn.routeType === "Department")
  );
  const lineNumbers = deptNumbers.length > 0
    ? deptNumbers.map((pn) => pn.phoneNumber ?? pn.number ?? "").filter(Boolean)
    : (department.lineNumber ?? []);

  const handleSaveName = () => {
    if (name.trim() && name !== department.name) {
      updateMutation.mutate({ name: name.trim() });
    }
  };

  const handleAddMember = (userId: number) => {
    assignMutation.mutate(userId);
    const u = usersLight.find((x) => x.userId === userId);
    if (u) setMembers((m) => [...m, { userId: u.userId, firstName: u.firstName, lastName: u.lastName, extension: u.extension }]);
  };

  const handleRemoveMember = (userId: number) => {
    unassignMutation.mutate(userId);
    setMembers((m) => m.filter((x) => x.userId !== userId));
  };

  const handleToggleRecording = (v: boolean) => {
    recordMutation.mutate(v);
  };

  const TABS = [
    { id: "department" as const, label: "Department" },
    { id: "callOptions" as const, label: "Call Options" },
    { id: "voicemail" as const, label: "Voicemail" },
  ];

  const initials = (department.name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const headerContent = (
    <div className="flex items-center justify-between px-6 py-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-[14px] font-medium shrink-0">
          {initials || "—"}
        </div>
        <h2 id="modal-title" className="text-[22px] font-normal text-gray-900">
          {department.name}
        </h2>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg" headerContent={headerContent}>
      <div className="flex gap-1 border-b border-gray-200 -mb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-5 py-3 text-[14px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? "border-[#1a73e8] text-gray-900"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {activeTab === "department" && (
          <div className="space-y-6">
            <div className="rounded-lg bg-gray-50/50 border border-gray-200 px-4 py-4">
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-2">Department Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSaveName}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-[14px] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                    placeholder="e.g. Product Management"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-2">Ext Auto</label>
                  <input
                    type="text"
                    value={department.extension ?? "—"}
                    readOnly
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-[14px] bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {lineNumbers.length > 0 && (
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-2">Phone Number</label>
                <div className="flex flex-col gap-2">
                  {lineNumbers.slice(0, 3).map((num, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-50 border border-gray-100 text-[14px] text-gray-700"
                    >
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      {formatPhoneDisplay(num)} · {department.extension}
                    </div>
                  ))}
                  {lineNumbers.length > 3 && (
                    <div className="flex items-center gap-1 py-2 px-3 rounded-lg bg-gray-50 border border-gray-100 text-[14px] text-gray-600">
                      {lineNumbers.length - 3}+ <ChevronDown className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <Link
                  href="/ucass/phone-numbers"
                  className="inline-block mt-2 text-[13px] text-[#1a73e8] hover:underline"
                >
                  Manage phone numbers in Phone Numbers
                </Link>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-2">Team Members Optional</label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const label = [m.firstName, m.lastName].filter(Boolean).join(" ");
                  const ext = m.extension ? ` ${m.extension}` : "";
                  return (
                    <span
                      key={m.userId}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-[14px]"
                    >
                      {label}
                      {ext}
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.userId)}
                        className="rounded-full p-1 hover:bg-gray-200 text-gray-500 transition-colors"
                        aria-label="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <AddMemberRow
                users={usersLight}
                currentMembers={members}
                onAdd={handleAddMember}
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/30 px-4 py-4 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-[14px] font-medium text-gray-900">Call Recording</h4>
                <p className="text-[13px] text-gray-600 mt-0.5">
                  Records all of the department incoming and outgoing calls, to all of its phone numbers.
                </p>
              </div>
              <Toggle
                checked={recording}
                onChange={handleToggleRecording}
              />
            </div>

            {(updateMutation.isError || recordMutation.isError || assignMutation.isError || unassignMutation.isError) && (
              <p className="text-[14px] text-red-600">
                {((updateMutation.error || recordMutation.error || assignMutation.error || unassignMutation.error) as Error)?.message ?? "Failed to save"}
              </p>
            )}

            <div className="border-t border-gray-200 bg-gray-50/50 -mx-6 -mb-4 px-6 py-4 mt-6 flex justify-between items-center">
              <button
                type="button"
                onClick={onDelete}
                className="text-[14px] font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 text-[14px] font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { handleSaveName(); onClose(); }}
                  className="h-9 px-4 text-[14px] font-medium text-white bg-[#1a73e8] rounded-lg hover:bg-[#1557b0] transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "callOptions" && (
          <CallOptionsTab
            callForwardRules={callForwardRules}
            isLoading={callForwardLoading}
            usersLight={usersLight}
            onUpdate={callForwardMutation.mutate}
            isUpdating={callForwardMutation.isPending}
          />
        )}

        {activeTab === "voicemail" && (
          <VoicemailTab />
        )}
      </div>
    </Modal>
  );
}

export default function DepartmentsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [form, setForm] = useState<CreateDepartmentPayload>({ ...EMPTY_FORM });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: qk.departments.list(accountId),
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => createDepartment(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ deptId, payload }: { deptId: number; payload: Partial<CreateDepartmentPayload> }) =>
      updateDepartment(accountId, deptId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (deptId: number) => deleteDepartment(accountId, deptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      setDeleteTarget(null);
      closeModal();
    },
  });

  const openAddModal = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEditModal = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, extension: d.extension ?? "" });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ deptId: editing.deptId, payload: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<Department>[] = [
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => row.name,
      cell: ({ row }) => {
        const initials = (row.original.name ?? "")
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {initials || "—"}
            </div>
            <span className="font-medium text-gray-900">{row.original.name}</span>
          </div>
        );
      },
    },
    { accessorKey: "extension", header: "Ext", cell: ({ row }) => row.original.extension ?? "—" },
    {
      id: "teamMembers",
      header: "Team Members",
      accessorFn: (row) => row.memberCount ?? 0,
      cell: ({ row }) => (
        <DepartmentMembersPopover department={row.original} accountId={accountId} />
      ),
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total: <strong>{departments.length}</strong>
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add Department
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading departments..." />
        </div>
      ) : (
        <DataTable columns={columns} data={departments} searchPlaceholder="Search" />
      )}

      {/* Add modal: simple form */}
      <Modal isOpen={modalOpen && !editing} onClose={closeModal} title="Add Department">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Sales"
            required
          />
          <TextInput
            label="Extension"
            value={form.extension ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, extension: v }))}
            placeholder="e.g. 3000"
          />
          {(addMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600 mb-2">
              {((addMutation.error || updateMutation.error) as Error)?.message ?? "Failed to save"}
            </p>
          )}
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
              disabled={isMutating}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50"
            >
              {isMutating ? "Saving..." : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal: full department edit */}
      {editing && (
        <DepartmentEditModal
          department={editing}
          isOpen={modalOpen}
          onClose={closeModal}
          onSuccess={closeModal}
          onDelete={() => setDeleteTarget(editing)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.deptId)}
        title="Delete Department"
        message={`Delete department "${deleteTarget?.name}"? Members will be unassigned.`}
      />
    </div>
  );
}
