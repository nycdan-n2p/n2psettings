"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk, lightKeys } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchRingGroupDetail,
  fetchRingGroupFeatures,
  updateRingGroupDetail,
  updateRingGroupFeature,
  fetchUsersLight,
  fetchDepartmentsLight,
  type RingGroupDetail,
  type RingGroupMember,
  type CallerIdModifier,
  type RingGroupTimeBlock,
} from "@/lib/api/ring-groups";
import { fetchPhoneNumbers, type PhoneNumber } from "@/lib/api/phone-numbers";
import {
  ArrowLeft, Save, Users, Route, PhoneIncoming, Plus, Trash2,
  CheckCircle2, AlertTriangle, Info, Clock, Phone,
} from "lucide-react";

type Tab = "settings" | "routing" | "callerid";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "settings", label: "Settings",            icon: Users         },
  { id: "routing",  label: "Call Routing",         icon: Route         },
  { id: "callerid", label: "Caller ID Prefixing",  icon: PhoneIncoming },
];

const MODE_OPTIONS = [
  { value: "prefix",  label: "Prefix",  desc: "Adds something before the caller ID" },
  { value: "suffix",  label: "Suffix",  desc: "Adds something after the caller ID"  },
  { value: "replace", label: "Replace", desc: "Replaces the caller ID with something" },
  { value: "none",    label: "None",    desc: "Do not modify the caller ID"          },
] as const;

function applyModifier(original: string, mod: CallerIdModifier): string {
  if (!mod || mod.mode === "none") return original;
  const v = mod.value ?? "";
  if (mod.mode === "prefix")  return `${v}${original}`;
  if (mod.mode === "suffix")  return `${original}${v}`;
  if (mod.mode === "replace") return v;
  return original;
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

// ── Add Member Row ────────────────────────────────────────────────────────────
function AddMemberRow({
  users, depts, onAdd,
}: {
  users: Array<{ userId: number; firstName: string; lastName: string; extension?: string }>;
  depts: Array<{ id: number | string; name: string; extension?: string }>;
  onAdd: (type: "user" | "department", id: string) => void;
}) {
  const [type, setType] = useState<"user" | "department">("user");
  const [selectedId, setSelectedId] = useState("");
  return (
    <div className="flex gap-2 items-center mt-2.5">
      <select value={type} onChange={(e) => { setType(e.target.value as "user" | "department"); setSelectedId(""); }}
        className="px-2 py-1.5 border border-[#dadce0] rounded-md text-sm bg-white">
        <option value="user">User</option>
        <option value="department">Department</option>
      </select>
      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 px-2 py-1.5 border border-[#dadce0] rounded-md text-sm bg-white">
        <option value="">Select {type === "user" ? "user" : "department"}…</option>
        {type === "user"
          ? users.map((u) => <option key={u.userId} value={String(u.userId)}>{u.firstName} {u.lastName}{u.extension ? ` · ${u.extension}` : ""}</option>)
          : depts.map((d) => <option key={d.id} value={String(d.id)}>{d.name}{d.extension ? ` · ${d.extension}` : ""}</option>)}
      </select>
      <button onClick={() => { if (!selectedId) return; onAdd(type, selectedId); setSelectedId(""); }}
        disabled={!selectedId}
        className="flex items-center gap-1 px-3 py-1.5 bg-[#1a73e8] text-white rounded-md text-sm hover:bg-[#1557b0] disabled:opacity-40 shrink-0">
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
  );
}

// ── Settings Section ──────────────────────────────────────────────────────────
function SettingsSection({
  rg, features, phoneNumbers, users, onSave, onToggleRecording, saving, saved,
}: {
  rg: RingGroupDetail;
  features: Array<{ id: string; active: boolean }>;
  phoneNumbers: PhoneNumber[];
  users: Array<{ userId: number; firstName: string; lastName: string; extension?: string }>;
  onSave: (p: Partial<RingGroupDetail>) => void;
  onToggleRecording: (v: boolean) => void;
  saving: boolean;
  saved: boolean;
}) {
  const [name, setName] = useState(rg.name);
  const [smsUserId, setSmsUserId] = useState(
    rg.smsDestination?.type === "user" ? String(rg.smsDestination.userId ?? "") : ""
  );
  useEffect(() => { setName(rg.name); }, [rg.name]);
  useEffect(() => { setSmsUserId(rg.smsDestination?.type === "user" ? String(rg.smsDestination.userId ?? "") : ""); }, [rg.smsDestination]);

  const recording = features.find((f) => f.id === "record")?.active ?? false;

  const assignedNumbers = phoneNumbers.filter((pn) =>
    rg.lines?.some((l) => l.lineId === String((pn as Record<string,unknown>).id) || l.lineId === pn.phoneNumber)
  );

  return (
    <div className="max-w-2xl">
      <h3 className="text-base font-semibold text-gray-900 mb-5">Basic Settings</h3>

      <div className="grid grid-cols-[1fr_160px] gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            placeholder="e.g. Sales Team" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Extension <span className="text-gray-400 font-normal text-xs">auto</span></label>
          <input type="text" value={rg.extension ?? "—"} readOnly
            className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>
      </div>

      {assignedNumbers.length > 0 && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned Numbers</label>
          <div className="flex flex-wrap gap-2">
            {assignedNumbers.map((pn, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8f0fe] text-[#1a73e8] rounded-full text-sm">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {pn.phoneNumber}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Assigned from the Phone Numbers page.</p>
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Send SMS to</label>
        <select value={smsUserId} onChange={(e) => setSmsUserId(e.target.value)}
          className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8]">
          <option value="">— None —</option>
          {users.map((u) => (
            <option key={u.userId} value={String(u.userId)}>
              {u.firstName} {u.lastName}{u.extension ? ` · ${u.extension}` : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">Choose a user to receive all Ring Group SMS messages.</p>
      </div>

      <div className="mb-6 p-4 rounded-xl border border-gray-200 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-800">Call Recording</p>
          <p className="text-xs text-gray-500 mt-0.5">Records all incoming and outgoing calls for this ring group.</p>
        </div>
        <Toggle checked={recording} onChange={onToggleRecording} />
      </div>

      <div className="flex justify-end">
        <button onClick={() => onSave({ ...rg, name, smsDestination: smsUserId ? { status: "A", type: "user", userId: Number(smsUserId) } : rg.smsDestination })}
          disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader variant="button" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ── Routing Section ───────────────────────────────────────────────────────────
function RoutingSection({
  rg, users, depts, onSave, saving, saved,
}: {
  rg: RingGroupDetail;
  users: Array<{ userId: number; firstName: string; lastName: string; extension?: string }>;
  depts: Array<{ id: number | string; name: string; extension?: string }>;
  onSave: (p: Partial<RingGroupDetail>) => void;
  saving: boolean;
  saved: boolean;
}) {
  const [timeBlocks, setTimeBlocks] = useState<RingGroupTimeBlock[]>(rg.timeBlock ?? []);
  useEffect(() => { setTimeBlocks(rg.timeBlock ?? []); }, [rg.timeBlock]);

  const getMemberLabel = (m: RingGroupMember) => {
    if (m.type === "user") {
      const u = users.find((u) => String(u.userId) === String(m.data));
      return u ? `${u.firstName} ${u.lastName}${u.extension ? ` · ${u.extension}` : ""}` : `User ${m.data}`;
    }
    const d = depts.find((d) => String(d.id) === String(m.data));
    return d ? `${d.name}${d.extension ? ` · ${d.extension}` : ""}` : `Dept ${m.data}`;
  };

  const addMember = (blockIdx: number, tierIdx: number, type: "user" | "department", dataId: string) => {
    if (!dataId) return;
    setTimeBlocks((prev) => {
      const blocks = structuredClone(prev);
      const tier = blocks[blockIdx].tier[tierIdx];
      if (tier.members.some((m) => m.data === dataId && m.type === type)) return prev;
      tier.members.push({ data: dataId, type, rings: 5, status: "A", redirectToVoicemail: false, orderBy: tier.members.length + 1 });
      return blocks;
    });
  };

  const removeMember = (blockIdx: number, tierIdx: number, mIdx: number) => {
    setTimeBlocks((prev) => { const b = structuredClone(prev); b[blockIdx].tier[tierIdx].members.splice(mIdx, 1); return b; });
  };

  const addTier = (blockIdx: number) => {
    setTimeBlocks((prev) => {
      const b = structuredClone(prev);
      b[blockIdx].tier.push({ id: b[blockIdx].tier.length * -1 - 1, orderBy: b[blockIdx].tier.length + 1, status: "A", members: [] });
      return b;
    });
  };

  const removeTier = (blockIdx: number, tierIdx: number) => {
    setTimeBlocks((prev) => { const b = structuredClone(prev); b[blockIdx].tier.splice(tierIdx, 1); return b; });
  };

  const isAllDay = timeBlocks.length === 1 && timeBlocks[0]?.type === "allDay";

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
        <Info className="w-4 h-4 shrink-0" />
        Calls will be routed based on the following time blocks.
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Time Blocks</h3>
          <p className="text-sm text-gray-500 mt-0.5">Configure routing tiers for each schedule.</p>
        </div>
        <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-sm">
          <span className={`px-3 py-1 rounded-full font-medium transition-colors ${isAllDay ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>24/7</span>
          <span className={`px-3 py-1 rounded-full font-medium transition-colors ${!isAllDay ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}>Custom</span>
        </div>
      </div>

      {timeBlocks.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400">No time blocks configured.</div>
      )}

      <div className="space-y-4">
        {timeBlocks.map((block, blockIdx) => (
          <div key={block.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-[#1a73e8]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{block.name || `Schedule ${blockIdx + 1}`}</p>
                {block.type === "allDay" && <p className="text-xs text-gray-500">24/7 · All day, every day</p>}
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {block.tier.map((tier, tierIdx) => (
                <div key={tier.id} className="bg-gray-50/60 rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tier {tierIdx + 1}</span>
                    {block.tier.length > 1 && (
                      <button onClick={() => removeTier(blockIdx, tierIdx)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tier.members.length === 0 && <span className="text-xs text-gray-400 italic">No members yet</span>}
                    {tier.members.map((m, mIdx) => (
                      <div key={mIdx} className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 bg-white border border-gray-200 rounded-full text-sm shadow-sm">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${m.type === "user" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {getMemberLabel(m).split(" ").slice(0,2).map((w) => w[0]?.toUpperCase() ?? "").join("")}
                        </div>
                        <span className="text-gray-700 text-xs">{getMemberLabel(m)}</span>
                        <button onClick={() => removeMember(blockIdx, tierIdx, mIdx)} className="ml-0.5 text-gray-300 hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                  <AddMemberRow users={users} depts={depts} onAdd={(t, id) => addMember(blockIdx, tierIdx, t, id)} />
                </div>
              ))}

              {block.finalTier && block.finalTier.members.length > 0 && (
                <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Fallback (Final Tier)</p>
                  <div className="flex flex-wrap gap-2">
                    {block.finalTier.members.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-200 rounded-full text-xs text-gray-700">
                        {getMemberLabel(m)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => addTier(blockIdx)} className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline mt-1">
                <Plus className="w-4 h-4" /> Add Tier
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-6">
        <button onClick={() => onSave({ ...rg, timeBlock: timeBlocks })} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader variant="button" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Routing"}
        </button>
      </div>
    </div>
  );
}

// ── Caller ID Section ─────────────────────────────────────────────────────────
function CallerIdSection({
  rg, onSave, saving, saved,
}: {
  rg: RingGroupDetail;
  onSave: (p: Partial<RingGroupDetail>) => void;
  saving: boolean;
  saved: boolean;
}) {
  const [nameModifier, setNameModifier] = useState<CallerIdModifier>(rg.callerIdName ?? { mode: "none", value: "" });
  const [numModifier,  setNumModifier]  = useState<CallerIdModifier>(rg.callerIdNumber ?? { mode: "none", value: "" });
  useEffect(() => { setNameModifier(rg.callerIdName ?? { mode: "none", value: "" }); setNumModifier(rg.callerIdNumber ?? { mode: "none", value: "" }); }, [rg]);

  function ModifierCard({ title, desc, value, onChange, placeholder, hint, fieldName }: {
    title: string; desc: string; value: CallerIdModifier; onChange: (v: CallerIdModifier) => void;
    placeholder: string; hint: string; fieldName: string;
  }) {
    return (
      <div className="mb-6 p-5 border border-gray-200 rounded-xl bg-white">
        <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{title}</h3>
        <p className="text-xs text-gray-500 mb-4">{desc}</p>
        <div className="space-y-2 mb-4">
          {MODE_OPTIONS.map((opt) => (
            <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${value.mode === opt.value ? "border-[#1a73e8] bg-[#e8f0fe]/50" : "border-gray-200 hover:bg-gray-50"}`}>
              <input type="radio" name={fieldName} value={opt.value} checked={value.mode === opt.value}
                onChange={() => onChange({ ...value, mode: opt.value })} className="accent-[#1a73e8] shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                <span className="text-xs text-gray-400 ml-2">{opt.desc}</span>
              </div>
            </label>
          ))}
        </div>
        {value.mode !== "none" && (
          <div>
            <input type="text" value={value.value ?? ""} onChange={(e) => onChange({ ...value, value: e.target.value })}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]" />
            <p className="text-xs text-gray-400 mt-1">{hint}</p>
          </div>
        )}
      </div>
    );
  }

  const previewName = applyModifier("STARK, TONY", nameModifier);
  const previewNum  = applyModifier("201-555-1212", numModifier);

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-5">
        Customize the caller ID details for incoming calls to help distinguish calls based on their origin.
      </p>

      <ModifierCard
        title="Incoming caller ID name"
        desc="Modify how the caller's name appears to ring group members."
        value={nameModifier} onChange={setNameModifier}
        placeholder='e.g. "SALES"'
        hint="Alphanumeric (A–Z, 0–9) and spaces. No special characters."
        fieldName="callerIdName"
      />
      <ModifierCard
        title="Incoming caller ID number"
        desc="Modify how the caller's phone number appears to ring group members."
        value={numModifier} onChange={setNumModifier}
        placeholder="e.g. 15"
        hint="Numeric only (0–9) and spaces. No special characters."
        fieldName="callerIdNumber"
      />

      {/* Preview */}
      <div className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Preview</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Original</p>
            <p className="text-sm font-mono text-gray-700">201-555-1212</p>
            <p className="text-sm font-mono text-gray-700 mt-1">STARK, TONY</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Transformed to</p>
            <p className={`text-sm font-mono ${previewNum !== "201-555-1212" ? "text-[#1a73e8] font-semibold" : "text-gray-700"}`}>{previewNum}</p>
            <p className={`text-sm font-mono mt-1 ${previewName !== "STARK, TONY" ? "text-[#1a73e8] font-semibold" : "text-gray-700"}`}>{previewName}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => onSave({ ...rg, callerIdName: nameModifier, callerIdNumber: numModifier })} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 text-sm font-medium">
          {saving ? <Loader variant="button" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Caller ID"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RingGroupEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [savedTab, setSavedTab] = useState<Tab | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: rg, isLoading } = useQuery({
    queryKey: qk.ringGroups.detail(accountId, id),
    queryFn: () => fetchRingGroupDetail(accountId, id),
    enabled: !!accountId && !!id,
  });

  const { data: features = [] } = useQuery({
    queryKey: qk.ringGroups.features(accountId, id),
    queryFn: () => fetchRingGroupFeatures(accountId, id),
    enabled: !!accountId && !!id,
  });

  const { data: usersLight = [] } = useQuery({
    queryKey: lightKeys.users(accountId),
    queryFn: () => fetchUsersLight(accountId),
    enabled: !!accountId,
  });

  const { data: deptsLight = [] } = useQuery({
    queryKey: lightKeys.departments(accountId),
    queryFn: () => fetchDepartmentsLight(accountId),
    enabled: !!accountId,
  });

  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ["phone-numbers", accountId],
    queryFn: () => fetchPhoneNumbers(accountId),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<RingGroupDetail>) =>
      updateRingGroupDetail(accountId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.ringGroups.detail(accountId, id) });
      queryClient.invalidateQueries({ queryKey: qk.ringGroups.all(accountId) });
      setSavedTab(activeTab);
      setSaveError(null);
      setTimeout(() => setSavedTab(null), 3000);
    },
    onError: (e: Error) => setSaveError(e.message ?? "Failed to save"),
  });

  const featureMutation = useMutation({
    mutationFn: ({ active }: { active: boolean }) =>
      updateRingGroupFeature(accountId, id, "record", active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.ringGroups.features(accountId, id) });
    },
  });

  if (isLoading) {
    return <div className="py-24 flex justify-center"><Loader variant="inline" label="Loading ring group…" /></div>;
  }

  if (!rg) {
    return (
      <div className="py-24 text-center">
        <p className="text-gray-500 text-sm">Ring group not found.</p>
        <button onClick={() => router.back()} className="mt-3 text-sm text-[#1a73e8] hover:underline">← Back</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/ucass/ring-groups")}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{rg.name}</h1>
          <p className="text-sm text-gray-500">{rg.extension ? `Ext. ${rg.extension} · ` : ""}Ring Group</p>
        </div>
      </div>

      {/* Feedback banners */}
      {savedTab === activeTab && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Changes saved successfully.
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {saveError}
        </div>
      )}

      {/* Card with left nav */}
      <div className="bg-white rounded-xl border border-gray-200 flex min-h-[600px]">
        <nav className="w-52 shrink-0 border-r border-gray-100 p-3 space-y-0.5">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button key={tabId} onClick={() => { setActiveTab(tabId); setSaveError(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                activeTab === tabId ? "bg-[#e8f0fe] text-[#1a73e8] font-medium" : "text-gray-600 hover:bg-gray-50"
              }`}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {savedTab === tabId && tabId !== activeTab && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === "settings" && (
            <SettingsSection
              rg={rg} features={features} phoneNumbers={phoneNumbers} users={usersLight}
              onSave={(p) => updateMutation.mutate(p)}
              onToggleRecording={(v) => featureMutation.mutate({ active: v })}
              saving={updateMutation.isPending} saved={savedTab === "settings"}
            />
          )}
          {activeTab === "routing" && (
            <RoutingSection
              rg={rg} users={usersLight} depts={deptsLight}
              onSave={(p) => updateMutation.mutate(p)}
              saving={updateMutation.isPending} saved={savedTab === "routing"}
            />
          )}
          {activeTab === "callerid" && (
            <CallerIdSection
              rg={rg}
              onSave={(p) => updateMutation.mutate(p)}
              saving={updateMutation.isPending} saved={savedTab === "callerid"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
