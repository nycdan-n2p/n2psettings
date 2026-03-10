"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import { TextInput } from "@/components/settings/TextInput";
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
} from "@/lib/api/ring-groups";
import { ArrowLeft, Plus, Trash2, Users, Route, PhoneIncoming } from "lucide-react";

type Tab = "settings" | "routing" | "callerid";

const MODE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "prefix", label: "Prefix" },
  { value: "suffix", label: "Suffix" },
  { value: "replace", label: "Replace" },
] as const;

function applyModifier(original: string, mod: CallerIdModifier): string {
  if (!mod || mod.mode === "none") return original;
  const v = mod.value ?? "";
  if (mod.mode === "prefix") return `${v}${original}`;
  if (mod.mode === "suffix") return `${original}${v}`;
  if (mod.mode === "replace") return v;
  return original;
}

export default function RingGroupEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Fetch ring group detail ─────────────────────────────────────────────
  const { data: rg, isLoading } = useQuery({
    queryKey: ["ring-group-detail", accountId, id],
    queryFn: () => fetchRingGroupDetail(accountId, id),
    enabled: !!accountId && !!id,
  });

  const { data: features = [] } = useQuery({
    queryKey: ["ring-group-features", accountId, id],
    queryFn: () => fetchRingGroupFeatures(accountId, id),
    enabled: !!accountId && !!id,
  });

  const { data: usersLight = [] } = useQuery({
    queryKey: ["users-light", accountId],
    queryFn: () => fetchUsersLight(accountId),
    enabled: !!accountId,
  });

  const { data: deptsLight = [] } = useQuery({
    queryKey: ["depts-light", accountId],
    queryFn: () => fetchDepartmentsLight(accountId),
    enabled: !!accountId,
  });

  // ─── Local form state ────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [callerIdName, setCallerIdName] = useState<CallerIdModifier>({ mode: "none", value: "" });
  const [callerIdNumber, setCallerIdNumber] = useState<CallerIdModifier>({ mode: "none", value: "" });
  const [timeBlocks, setTimeBlocks] = useState<RingGroupDetail["timeBlock"]>([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (rg) {
      setName(rg.name);
      setCallerIdName(rg.callerIdName ?? { mode: "none", value: "" });
      setCallerIdNumber(rg.callerIdNumber ?? { mode: "none", value: "" });
      setTimeBlocks(rg.timeBlock ?? []);
    }
  }, [rg]);

  useEffect(() => {
    const rec = features.find((f) => f.id === "record");
    if (rec) setRecording(rec.active);
  }, [features]);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<RingGroupDetail>) =>
      updateRingGroupDetail(accountId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ring-group-detail", accountId, id] });
      queryClient.invalidateQueries({ queryKey: ["ring-groups", accountId] });
      setSaveError(null);
    },
    onError: (e: Error) => setSaveError(e.message ?? "Failed to save"),
  });

  const featureMutation = useMutation({
    mutationFn: ({ active }: { active: boolean }) =>
      updateRingGroupFeature(accountId, id, "record", active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ring-group-features", accountId, id] });
    },
  });

  const handleSaveSettings = () => {
    if (!rg) return;
    updateMutation.mutate({ ...rg, name, callerIdName, callerIdNumber, timeBlock: timeBlocks });
  };

  const handleSaveCallerID = () => {
    if (!rg) return;
    updateMutation.mutate({ ...rg, callerIdName, callerIdNumber });
  };

  const handleSaveRouting = () => {
    if (!rg) return;
    updateMutation.mutate({ ...rg, timeBlock: timeBlocks });
  };

  // ─── Member helpers ──────────────────────────────────────────────────────
  const getMemberDisplayName = (m: RingGroupMember) => {
    if (m.type === "user") {
      const u = usersLight.find((u) => String(u.userId) === String(m.data));
      return u ? `${u.firstName} ${u.lastName}${u.extension ? ` (${u.extension})` : ""}` : `User ${m.data}`;
    }
    if (m.type === "department") {
      const d = deptsLight.find((d) => String(d.id) === String(m.data));
      return d ? `${d.name}${d.extension ? ` (${d.extension})` : ""}` : `Dept ${m.data}`;
    }
    return m.data;
  };

  const addMemberToTier = (blockIdx: number, tierIdx: number, type: "user" | "department", dataId: string) => {
    if (!dataId) return;
    setTimeBlocks((prev) => {
      const blocks = structuredClone(prev);
      const tier = blocks[blockIdx].tier[tierIdx];
      if (tier.members.some((m) => m.data === dataId && m.type === type)) return prev;
      tier.members.push({ data: dataId, type, rings: 5, status: "A", redirectToVoicemail: false, orderBy: tier.members.length + 1 });
      return blocks;
    });
  };

  const removeMemberFromTier = (blockIdx: number, tierIdx: number, memberIdx: number) => {
    setTimeBlocks((prev) => {
      const blocks = structuredClone(prev);
      blocks[blockIdx].tier[tierIdx].members.splice(memberIdx, 1);
      return blocks;
    });
  };

  const addTier = (blockIdx: number) => {
    setTimeBlocks((prev) => {
      const blocks = structuredClone(prev);
      const newId = (blocks[blockIdx].tier.length + 1) * -1;
      blocks[blockIdx].tier.push({ id: newId, orderBy: blocks[blockIdx].tier.length + 1, status: "A", members: [] });
      return blocks;
    });
  };

  const removeTier = (blockIdx: number, tierIdx: number) => {
    setTimeBlocks((prev) => {
      const blocks = structuredClone(prev);
      blocks[blockIdx].tier.splice(tierIdx, 1);
      return blocks;
    });
  };

  if (isLoading) {
    return <div className="py-12 flex justify-center"><Loader variant="inline" label="Loading ring group..." /></div>;
  }

  if (!rg) {
    return <div className="py-12 text-center text-gray-500">Ring group not found.</div>;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "settings", label: "Settings", icon: <Users className="w-4 h-4" /> },
    { id: "routing", label: "Call Routing", icon: <Route className="w-4 h-4" /> },
    { id: "callerid", label: "Caller ID Prefixing", icon: <PhoneIncoming className="w-4 h-4" /> },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{rg.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ring Group {rg.extension ? `· Ext ${rg.extension}` : ""}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#1a73e8] text-[#1a73e8]"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{saveError}</div>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === "settings" && (
        <div className="max-w-lg">
          <TextInput
            label="Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Sales Team"
            required
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Extension</label>
            <input
              type="text"
              value={rg.extension ?? ""}
              disabled
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">Extension is auto-assigned</p>
          </div>

          {/* Call Recording */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Call Recording</p>
                <p className="text-xs text-gray-500 mt-0.5">Record all calls for this ring group</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={recording}
                onClick={() => {
                  const newVal = !recording;
                  setRecording(newVal);
                  featureMutation.mutate({ active: newVal });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  recording ? "bg-[#1a73e8]" : "bg-gray-300"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${recording ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-[#1a73e8] text-white rounded-md text-sm font-medium hover:bg-[#1557b0] disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      )}

      {/* ── CALL ROUTING TAB ── */}
      {activeTab === "routing" && (
        <div>
          {timeBlocks.length === 0 && (
            <p className="text-sm text-gray-500">No time blocks configured.</p>
          )}
          {timeBlocks.map((block, blockIdx) => (
            <div key={block.id} className="mb-8 p-5 border border-gray-200 rounded-lg">
              <h3 className="text-base font-medium text-gray-800 mb-4">{block.name || `Schedule ${blockIdx + 1}`}</h3>

              {/* Tiers */}
              {block.tier.map((tier, tierIdx) => (
                <div key={tier.id} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Tier {tierIdx + 1}</span>
                    {block.tier.length > 1 && (
                      <button
                        onClick={() => removeTier(blockIdx, tierIdx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove tier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Members */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {tier.members.map((m, mIdx) => (
                      <div key={mIdx} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1 text-sm">
                        <span className={`w-2 h-2 rounded-full ${m.type === "user" ? "bg-blue-400" : "bg-green-400"}`} />
                        <span className="text-gray-700">{getMemberDisplayName(m)}</span>
                        <button onClick={() => removeMemberFromTier(blockIdx, tierIdx, mIdx)} className="text-gray-400 hover:text-red-500 ml-1">
                          ×
                        </button>
                      </div>
                    ))}
                    {tier.members.length === 0 && (
                      <span className="text-sm text-gray-400 italic">No members</span>
                    )}
                  </div>

                  {/* Add member */}
                  <AddMemberRow
                    users={usersLight}
                    depts={deptsLight}
                    onAdd={(type, id) => addMemberToTier(blockIdx, tierIdx, type, id)}
                  />
                </div>
              ))}

              {/* Final tier (read-only label) */}
              {block.finalTier && block.finalTier.members.length > 0 && (
                <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-sm font-medium text-amber-700 mb-2">Final Tier (Fallback)</p>
                  <div className="flex flex-wrap gap-2">
                    {block.finalTier.members.map((m, mIdx) => (
                      <div key={mIdx} className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-full px-3 py-1 text-sm text-gray-700">
                        {getMemberDisplayName(m)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => addTier(blockIdx)}
                className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline"
              >
                <Plus className="w-4 h-4" /> Add Tier
              </button>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              onClick={handleSaveRouting}
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-[#1a73e8] text-white rounded-md text-sm font-medium hover:bg-[#1557b0] disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save Routing"}
            </button>
          </div>
        </div>
      )}

      {/* ── CALLER ID PREFIXING TAB ── */}
      {activeTab === "callerid" && (
        <div className="max-w-2xl">
          <p className="text-sm text-gray-500 mb-6">Modify caller ID information as it appears to the ring group members when a call comes in.</p>

          {/* Caller ID Name */}
          <div className="mb-6 p-5 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Incoming caller ID name</h3>
            <div className="flex gap-3 mb-3 flex-wrap">
              {MODE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="callerIdNameMode"
                    value={opt.value}
                    checked={callerIdName.mode === opt.value}
                    onChange={() => setCallerIdName((p) => ({ ...p, mode: opt.value }))}
                    className="accent-[#1a73e8]"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            {callerIdName.mode !== "none" && (
              <input
                type="text"
                value={callerIdName.value ?? ""}
                onChange={(e) => setCallerIdName((p) => ({ ...p, value: e.target.value }))}
                placeholder="Caller ID name modification"
                className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
            )}
          </div>

          {/* Caller ID Number */}
          <div className="mb-6 p-5 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Incoming caller ID number</h3>
            <div className="flex gap-3 mb-3 flex-wrap">
              {MODE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="callerIdNumberMode"
                    value={opt.value}
                    checked={callerIdNumber.mode === opt.value}
                    onChange={() => setCallerIdNumber((p) => ({ ...p, mode: opt.value }))}
                    className="accent-[#1a73e8]"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            {callerIdNumber.mode !== "none" && (
              <input
                type="text"
                value={callerIdNumber.value ?? ""}
                onChange={(e) => setCallerIdNumber((p) => ({ ...p, value: e.target.value }))}
                placeholder="Caller ID modification"
                className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
            )}
          </div>

          {/* Preview */}
          <div className="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Preview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Original</p>
                <p className="text-sm text-gray-700 font-mono">201-555-1212</p>
                <p className="text-sm text-gray-700 font-mono mt-1">STARK, TONY</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Transformed to</p>
                <p className="text-sm text-gray-700 font-mono">{applyModifier("201-555-1212", callerIdNumber)}</p>
                <p className="text-sm text-gray-700 font-mono mt-1">{applyModifier("STARK, TONY", callerIdName)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveCallerID}
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-[#1a73e8] text-white rounded-md text-sm font-medium hover:bg-[#1557b0] disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save Caller ID"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Add Member Row ─────────────────────────────────────────

interface AddMemberRowProps {
  users: Array<{ userId: number; firstName: string; lastName: string; extension?: string }>;
  depts: Array<{ id: number | string; name: string; extension?: string }>;
  onAdd: (type: "user" | "department", id: string) => void;
}

function AddMemberRow({ users, depts, onAdd }: AddMemberRowProps) {
  const [type, setType] = useState<"user" | "department">("user");
  const [selectedId, setSelectedId] = useState("");

  const handleAdd = () => {
    if (!selectedId) return;
    onAdd(type, selectedId);
    setSelectedId("");
  };

  return (
    <div className="flex gap-2 items-center mt-2">
      <select
        value={type}
        onChange={(e) => { setType(e.target.value as "user" | "department"); setSelectedId(""); }}
        className="px-2 py-1.5 border border-[#dadce0] rounded-md text-sm"
      >
        <option value="user">User</option>
        <option value="department">Department</option>
      </select>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 px-2 py-1.5 border border-[#dadce0] rounded-md text-sm"
      >
        <option value="">Select {type === "user" ? "user" : "department"}...</option>
        {type === "user"
          ? users.map((u) => (
              <option key={u.userId} value={String(u.userId)}>
                {u.firstName} {u.lastName}{u.extension ? ` (${u.extension})` : ""}
              </option>
            ))
          : depts.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}{d.extension ? ` (${d.extension})` : ""}
              </option>
            ))
        }
      </select>
      <button
        onClick={handleAdd}
        disabled={!selectedId}
        className="flex items-center gap-1 px-3 py-1.5 bg-[#1a73e8] text-white rounded-md text-sm hover:bg-[#1557b0] disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
  );
}
