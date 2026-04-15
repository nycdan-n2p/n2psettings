"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk, lightKeys } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import { Snack } from "@/components/ui/Snack";
import { getButtonClasses } from "@/components/ui/Button";
import {
  ArrowLeft, Save, Users, PhoneCall, Clock, Hash, Music2, BarChart2,
  CheckCircle2, AlertTriangle, Sparkles, Play, Pause, X,
} from "lucide-react";
import {
  fetchCallQueueDetail,
  fetchCallQueues,
  updateCallQueueV2,
  type CallQueueDetail,
  type UpdateCallQueuePayload,
  type QueueAction,
  type QueueActionDestination,
  type QueueKeyAction,
  type QueueAudioSetting,
  type QueueAnnouncementSettings,
} from "@/lib/api/call-queues";
import { fetchMenusLight, type MenuLightItem } from "@/lib/api/virtual-assistant";
import { ReportsSection } from "./ReportsSection";

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = "basics" | "overflow" | "ringing" | "ivr" | "announcements" | "reports";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "basics",        label: "Queue Basics",    icon: Users     },
  { id: "overflow",      label: "Manage Overflow", icon: PhoneCall },
  { id: "ringing",       label: "Ringing Rules",   icon: Clock     },
  { id: "ivr",           label: "IVR Settings",    icon: Hash      },
  { id: "announcements", label: "Announcements",   icon: Music2    },
  { id: "reports",       label: "Reports",         icon: BarChart2 },
];

const RING_STRATEGIES = [
  { value: "ring_all",      label: "Ring All"      },
  { value: "round_robin",   label: "Round Robin"   },
  { value: "longest_idle",  label: "Longest Idle"  },
  { value: "linear",        label: "Linear"        },
  { value: "fewest_calls",  label: "Fewest Calls"  },
];

const IVR_KEYS = ["1","2","3","4","5","6","7","8","9","0","*","#"];

// ── Sub-component: DestinationPicker ─────────────────────────────────────────
function DestinationPicker({
  value,
  onChange,
  menus,
  queues,
}: {
  value?: QueueActionDestination;
  onChange: (d: QueueActionDestination | undefined) => void;
  menus: MenuLightItem[];
  queues: { id: string; name: string }[];
}) {
  const type = value?.type ?? "welcome_menu";
  const destId =
    type === "welcome_menu" ? String(value?.welcome_menu?.id ?? "")
    : type === "call_queue"  ? String(value?.call_queue?.id  ?? "")
    : "";

  function handleTypeChange(t: string) {
    if (t === "welcome_menu") onChange({ type: "welcome_menu", welcome_menu: { id: "" } });
    else if (t === "call_queue") onChange({ type: "call_queue", call_queue: { id: "" } });
    else if (t === "voicemail") onChange({ type: "voicemail" });
    else onChange(undefined);
  }

  function handleIdChange(id: string) {
    if (type === "welcome_menu") onChange({ type: "welcome_menu", welcome_menu: { id } });
    else if (type === "call_queue") onChange({ type: "call_queue", call_queue: { id } });
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <select
        value={type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className="px-2 py-1.5 border border-[#dadce0] rounded-md text-sm"
      >
        <option value="welcome_menu">Welcome Menu</option>
        <option value="call_queue">Call Queue</option>
        <option value="voicemail">Voicemail</option>
      </select>
      {(type === "welcome_menu" || type === "call_queue") && (
        <select
          value={destId}
          onChange={(e) => handleIdChange(e.target.value)}
          className="flex-1 min-w-[180px] px-2 py-1.5 border border-[#dadce0] rounded-md text-sm"
        >
          <option value="">— Select —</option>
          {type === "welcome_menu" &&
            menus.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.name}{m.extension ? ` (${m.extension})` : ""}</option>
            ))}
          {type === "call_queue" &&
            queues.map((q) => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
        </select>
      )}
    </div>
  );
}

// ── Sub-component: ActionPicker (type + destination) ─────────────────────────
function ActionPicker({
  label,
  value,
  onChange,
  menus,
  queues,
}: {
  label: string;
  value?: QueueAction;
  onChange: (a: QueueAction) => void;
  menus: MenuLightItem[];
  queues: { id: string; name: string }[];
}) {
  const actionType = value?.type ?? "forward";

  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="space-y-2">
        <select
          value={actionType}
          onChange={(e) => {
            const t = e.target.value as QueueAction["type"];
            if (t === "hangup") onChange({ type: "hangup" });
            else if (t === "voicemail") onChange({ type: "voicemail" });
            else onChange({ type: "forward", destination: value?.destination });
          }}
          className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
        >
          <option value="forward">Forward to…</option>
          <option value="voicemail">Voicemail</option>
          <option value="hangup">Hang Up</option>
        </select>
        {actionType === "forward" && (
          <DestinationPicker
            value={value?.destination}
            onChange={(d) => onChange({ type: "forward", destination: d })}
            menus={menus}
            queues={queues}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-component: AudioPicker ───────────────────────────────────────────────
function AudioPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: QueueAudioSetting;
  onChange: (a: QueueAudioSetting) => void;
}) {
  const type = value?.type ?? "no_prompt";
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <select
        value={type}
        onChange={(e) => onChange({ type: e.target.value as QueueAudioSetting["type"], id: null })}
        className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
      >
        <option value="no_prompt">No Prompt</option>
        <option value="default">Default (System Music)</option>
        <option value="custom">Custom Audio</option>
      </select>
      {type === "custom" && value?.id && (
        <p className="text-xs text-gray-400 mt-1 truncate">File: {value.id}</p>
      )}
    </div>
  );
}

// ── Section: Queue Basics ─────────────────────────────────────────────────────
function BasicsSection({
  detail,
  onSave,
  saving,
}: {
  detail: CallQueueDetail;
  onSave: (p: UpdateCallQueuePayload) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(detail.display_name ?? "");
  useEffect(() => { setName(detail.display_name ?? ""); }, [detail.display_name]);

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Queue Basics</h3>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Queue Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Extension</label>
        <input
          type="text"
          value={detail.extension ?? "—"}
          readOnly
          className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">Extensions cannot be changed here.</p>
      </div>

      {/* Agents list */}
      {(detail.agents && detail.agents.length > 0) && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Agents <span className="text-gray-400 font-normal">({detail.agents.length})</span>
          </label>
          <div className="border border-[#dadce0] rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {detail.agents.map((agent, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center text-xs font-semibold shrink-0">
                  {(agent.display_name ?? "?")[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-gray-800">{agent.display_name ?? "Unknown"}</span>
                {agent.extension && (
                  <span className="text-xs text-gray-400 ml-auto">{agent.extension}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          onClick={() => onSave({ display_name: name })}
          disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 text-sm font-medium"
        >
          {saving ? <Loader variant="button" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── Section: Manage Overflow ──────────────────────────────────────────────────
function OverflowSection({
  detail,
  menus,
  queues,
  onSave,
  saving,
}: {
  detail: CallQueueDetail;
  menus: MenuLightItem[];
  queues: { id: string; name: string }[];
  onSave: (p: UpdateCallQueuePayload) => void;
  saving: boolean;
}) {
  const [maxCap, setMaxCap] = useState(String(detail.max_capacity ?? ""));
  const [maxWait, setMaxWait] = useState(String(detail.max_wait_time_seconds ?? ""));
  const [noAgentsAction, setNoAgentsAction] = useState<QueueAction>(
    detail.no_agents_action ?? { type: "hangup" }
  );
  const [fullAction, setFullAction] = useState<QueueAction>(
    detail.max_limit_reached_action ?? { type: "hangup" }
  );

  useEffect(() => {
    setMaxCap(String(detail.max_capacity ?? ""));
    setMaxWait(String(detail.max_wait_time_seconds ?? ""));
    setNoAgentsAction(detail.no_agents_action ?? { type: "hangup" });
    setFullAction(detail.max_limit_reached_action ?? { type: "hangup" });
  }, [detail]);

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Manage Overflow</h3>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Queue Size</label>
          <input
            type="number"
            min={0}
            value={maxCap}
            onChange={(e) => setMaxCap(e.target.value)}
            className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            placeholder="e.g. 15"
          />
          <p className="text-xs text-gray-400 mt-1">Max callers allowed in queue</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Wait Time (seconds)</label>
          <input
            type="number"
            min={0}
            value={maxWait}
            onChange={(e) => setMaxWait(e.target.value)}
            className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            placeholder="e.g. 180"
          />
          <p className="text-xs text-gray-400 mt-1">0 = unlimited wait time</p>
        </div>
      </div>

      <ActionPicker
        label="When No Agents Are Available"
        value={noAgentsAction}
        onChange={setNoAgentsAction}
        menus={menus}
        queues={queues}
      />
      <ActionPicker
        label="When Queue is Full or Wait Time Exceeded"
        value={fullAction}
        onChange={setFullAction}
        menus={menus}
        queues={queues}
      />

      <div className="flex justify-end mt-6">
        <button
          onClick={() =>
            onSave({
              max_capacity: maxCap ? Number(maxCap) : undefined,
              max_wait_time_seconds: maxWait ? Number(maxWait) : undefined,
              no_agents_action: noAgentsAction,
              max_limit_reached_action: fullAction,
            })
          }
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 text-sm font-medium"
        >
          {saving ? <Loader variant="button" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── Section: Ringing Rules ────────────────────────────────────────────────────
function RingingSection({
  detail,
  onSave,
  saving,
}: {
  detail: CallQueueDetail;
  onSave: (p: UpdateCallQueuePayload) => void;
  saving: boolean;
}) {
  const [strategy, setStrategy] = useState(detail.ring_strategy?.type ?? "ring_all");
  useEffect(() => { setStrategy(detail.ring_strategy?.type ?? "ring_all"); }, [detail.ring_strategy]);

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Ringing Rules</h3>
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Ring Strategy</label>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
        >
          {RING_STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          {strategy === "ring_all"     && "All agents are rung simultaneously."}
          {strategy === "round_robin"  && "Calls are distributed evenly across agents."}
          {strategy === "longest_idle" && "The agent who has been idle the longest gets the call."}
          {strategy === "linear"       && "Agents are tried in order until one answers."}
          {strategy === "fewest_calls" && "The agent with the fewest calls handled gets the call."}
        </p>
      </div>
      <div className="flex justify-end mt-6">
        <button
          onClick={() => onSave({ ring_strategy: { type: strategy } })}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 text-sm font-medium"
        >
          {saving ? <Loader variant="button" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── Section: IVR Settings ─────────────────────────────────────────────────────
function IvrSection({
  detail,
  menus,
  queues,
  onSave,
  saving,
}: {
  detail: CallQueueDetail;
  menus: MenuLightItem[];
  queues: { id: string; name: string }[];
  onSave: (p: UpdateCallQueuePayload) => void;
  saving: boolean;
}) {
  const [keyActions, setKeyActions] = useState<Record<string, QueueActionDestination | undefined>>(() => {
    const map: Record<string, QueueActionDestination | undefined> = {};
    for (const ka of detail.key_actions ?? []) map[ka.key] = ka.destination;
    return map;
  });

  useEffect(() => {
    const map: Record<string, QueueActionDestination | undefined> = {};
    for (const ka of detail.key_actions ?? []) map[ka.key] = ka.destination;
    setKeyActions(map);
  }, [detail.key_actions]);

  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const ka of detail.key_actions ?? []) map[ka.key] = true;
    return map;
  });

  function handleSave() {
    const actions: QueueKeyAction[] = IVR_KEYS
      .filter((k) => enabled[k] && keyActions[k])
      .map((k) => ({ key: k, destination: keyActions[k] }));
    onSave({ key_actions: actions });
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">IVR Settings</h3>
      <p className="text-sm text-gray-500 mb-4">Configure DTMF key destinations for callers in queue.</p>
      <div className="border border-[#dadce0] rounded-lg divide-y divide-gray-100">
        {IVR_KEYS.map((key) => (
          <div key={key} className="flex items-start gap-3 p-3">
            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-700 shrink-0 mt-0.5">
              {key}
            </div>
            <div className="flex-1 min-w-0">
              {enabled[key] ? (
                <DestinationPicker
                  value={keyActions[key]}
                  onChange={(d) => setKeyActions((prev) => ({ ...prev, [key]: d }))}
                  menus={menus}
                  queues={queues}
                />
              ) : (
                <span className="text-sm text-gray-400 italic">Not configured</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }))}
              className={`text-xs px-2 py-1 rounded-md border shrink-0 transition-colors ${
                enabled[key]
                  ? "border-red-300 text-red-600 hover:bg-red-50"
                  : "border-[#dadce0] text-gray-500 hover:bg-gray-50"
              }`}
            >
              {enabled[key] ? "Remove" : "Add"}
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 text-sm font-medium"
        >
          {saving ? <Loader variant="button" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── ElevenLabs AI Music Generator ──────────────────────────────────────────────
interface MusicGenResult {
  id?: string;
  audioUrl: string;
  audioBase64?: string;
  imageUrl?: string | null;
  title: string;
}

function ElevenLabsMusicGenerator({ onAssign }: { onAssign: (url: string, title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("instrumental, corporate, upbeat");
  const [instrumental, setInstrumental] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MusicGenResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate-moh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, instrumental }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult(data as MusicGenResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate music");
    } finally {
      setGenerating(false);
    }
  }

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio || !result) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      // Use blob URL for playback (avoids CSP issues with long data URLs)
      if (result.audioBase64) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const bin = atob(result.audioBase64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: "audio/mpeg" });
        blobUrlRef.current = URL.createObjectURL(blob);
        audio.src = blobUrlRef.current;
      } else {
        audio.src = result.audioUrl;
      }
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      audio.onended = () => setPlaying(false);
    }
  }

  function handleAssign() {
    if (!result) return;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    onAssign(result.audioUrl, result.title);
    setOpen(false);
    setResult(null);
    setPlaying(false);
  }

  // Hidden audio element for preview
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Generate with AI
      </button>
    );
  }

  return (
    <div className="border border-purple-200 rounded-[16px] bg-purple-50/50 p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-900">Generate AI Hold Music</span>
          <span className="text-xs text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded-full">ElevenLabs</span>
        </div>
        <button
          onClick={() => {
            if (blobUrlRef.current) {
              URL.revokeObjectURL(blobUrlRef.current);
              blobUrlRef.current = null;
            }
            setOpen(false);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Prompt */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">Music description</label>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "Upbeat jazz music for a professional phone queue"'
          className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        />
      </div>

      {/* Style & Instrumental */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Style / genre tags</label>
          <input
            type="text"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="jazz, relaxing, piano"
            className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={instrumental}
              onChange={(e) => setInstrumental(e.target.checked)}
              className="accent-purple-600"
            />
            Instrumental only
          </label>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mb-3 bg-white border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-3">
            {result.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
              <p className="text-xs text-gray-400 truncate">{result.audioUrl.split("?")[0].split("/").pop()}</p>
            </div>
            <button
              type="button"
              onClick={handlePlayPause}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700 shrink-0"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          </div>
          {/* Hidden audio element */}
          <audio
            ref={audioRef}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {generating ? (
            <>
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              Generating… (~15 sec)
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              {result ? "Re-generate" : "Generate"}
            </>
          )}
        </button>
        {result && (
          <button
            type="button"
            onClick={handleAssign}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Use as Hold Music
          </button>
        )}
      </div>
    </div>
  );
}

// ── Section: Announcements ────────────────────────────────────────────────────
function AnnouncementsSection({
  detail,
  onSave,
  saving,
}: {
  detail: CallQueueDetail;
  onSave: (p: UpdateCallQueuePayload) => void;
  saving: boolean;
}) {
  const [holdAudio, setHoldAudio] = useState<QueueAudioSetting>(
    detail.on_hold_audio ?? { type: "default" }
  );
  const [greetingAudio, setGreetingAudio] = useState<QueueAudioSetting>(
    detail.welcome_greeting_audio ?? { type: "no_prompt" }
  );
  const [primaryAudio, setPrimaryAudio] = useState<QueueAudioSetting>(
    detail.announcement_settings?.primary_audio ?? { type: "default" }
  );
  const [primaryDelay, setPrimaryDelay] = useState(
    String(detail.announcement_settings?.primary_audio_delay_seconds ?? 0)
  );
  const [secondaryAudio, setSecondaryAudio] = useState<QueueAudioSetting>(
    detail.announcement_settings?.secondary_audio ?? { type: "default" }
  );

  useEffect(() => {
    setHoldAudio(detail.on_hold_audio ?? { type: "default" });
    setGreetingAudio(detail.welcome_greeting_audio ?? { type: "no_prompt" });
    setPrimaryAudio(detail.announcement_settings?.primary_audio ?? { type: "default" });
    setPrimaryDelay(String(detail.announcement_settings?.primary_audio_delay_seconds ?? 0));
    setSecondaryAudio(detail.announcement_settings?.secondary_audio ?? { type: "default" });
  }, [detail]);

  function handleMusicAssign(audioUrl: string, ..._args: unknown[]) {
    void _args; // additional callback args, unused
    // Set hold music to "custom" type with the audio URL as the ID.
    // Requires BLOB_READ_WRITE_TOKEN for call-queues (ElevenLabs returns a fetchable URL).
    setHoldAudio({ type: "custom", id: audioUrl });
  }

  const announcementSettings: QueueAnnouncementSettings = {
    primary_audio: primaryAudio,
    primary_audio_delay_seconds: Number(primaryDelay) || 0,
    secondary_audio: secondaryAudio,
  };

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Announcements</h3>

      {/* Hold Music with AI generator */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-gray-700">Hold Music</label>
          <ElevenLabsMusicGenerator onAssign={handleMusicAssign} />
        </div>
        <select
          value={holdAudio.type}
          onChange={(e) =>
            setHoldAudio({ type: e.target.value as QueueAudioSetting["type"], id: null })
          }
          className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
        >
          <option value="no_prompt">No Prompt</option>
          <option value="default">Default (System Music)</option>
          <option value="custom">Custom Audio</option>
        </select>
        {holdAudio.type === "custom" && holdAudio.id && (
          <p className="text-xs text-gray-400 mt-1 truncate" title={holdAudio.id}>
            {(holdAudio.id.startsWith("http") || holdAudio.id.startsWith("data:")) ? (
              <>🎵 AI-generated: <span className="text-purple-600">{holdAudio.id.startsWith("data:") ? "ElevenLabs" : holdAudio.id.split("/").pop()?.split("?")[0]}</span></>
            ) : (
              <>File: {holdAudio.id}</>
            )}
          </p>
        )}
      </div>

      <AudioPicker label="Welcome Greeting" value={greetingAudio} onChange={setGreetingAudio} />

      <div className="border-t border-gray-100 pt-4 mt-2">
        <p className="text-sm font-medium text-gray-700 mb-3">Periodic Announcements</p>
        <AudioPicker label="Primary Announcement" value={primaryAudio} onChange={setPrimaryAudio} />
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Announcement Delay (seconds)
          </label>
          <input
            type="number"
            min={0}
            value={primaryDelay}
            onChange={(e) => setPrimaryDelay(e.target.value)}
            className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            placeholder="e.g. 30"
          />
        </div>
        <AudioPicker label="Secondary Announcement" value={secondaryAudio} onChange={setSecondaryAudio} />
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={() =>
            onSave({
              on_hold_audio: holdAudio,
              welcome_greeting_audio: greetingAudio,
              announcement_settings: announcementSettings,
            })
          }
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] disabled:opacity-50 text-sm font-medium"
        >
          {saving ? <Loader variant="button" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CallQueueEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("basics");
  const [savedTab, setSavedTab] = useState<Tab | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: qk.callQueues.detail(accountId, id),
    queryFn: () => fetchCallQueueDetail(id, accountId),
    enabled: !!id && !!accountId,
  });

  const { data: menus = [] } = useQuery({
    queryKey: lightKeys.menus(accountId),
    queryFn: () => fetchMenusLight(accountId),
    enabled: !!accountId,
  });

  const { data: allQueues = [] } = useQuery({
    queryKey: qk.callQueues.list(accountId),
    queryFn: fetchCallQueues,
    enabled: !!accountId,
  });

  // Filter out the current queue from destination options
  const queueOptions = allQueues
    .filter((q) => q.id !== id)
    .map((q) => ({ id: q.id, name: q.name }));

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateCallQueuePayload) => updateCallQueueV2(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.callQueues.detail(accountId, id), updated);
      queryClient.invalidateQueries({ queryKey: qk.callQueues.list(accountId) });
      setSavedTab(activeTab);
      setSaveError(null);
      setTimeout(() => setSavedTab(null), 3000);
    },
    onError: (err: Error) => {
      setSaveError(err.message ?? "Failed to save changes");
    },
  });

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader variant="inline" label="Loading call queue…" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="py-24 text-center">
        <p className="text-red-600 text-sm">{(error as Error)?.message ?? "Queue not found"}</p>
        <button onClick={() => router.back()} className={`mt-3 ${getButtonClasses({ variant: "secondary", size: "md" })}`}>
          ← Back to Call Queues
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/ucass/call-queues")}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{detail.display_name}</h1>
          <p className="text-sm text-gray-500">
            {detail.extension ? `Ext. ${detail.extension} · ` : ""}
            {detail.agents_count ?? 0} agent{detail.agents_count !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Save feedback */}
      {savedTab === activeTab && (
        <Snack icon={<CheckCircle2 className="w-4 h-4" />} onClose={() => setSavedTab(null)}>
          Changes saved successfully.
        </Snack>
      )}
      {saveError && (
        <Snack icon={<AlertTriangle className="w-4 h-4" />} onClose={() => setSaveError(null)}>
          {saveError}
        </Snack>
      )}

      {/* v1 fallback notice */}
      {detail._isV1Fallback && (
        <div className="flex items-start gap-2 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>Limited editing mode</strong> — this queue&apos;s advanced settings (overflow, IVR, announcements)
            are not available via the v2 API. Only Queue Basics and Ringing Rules can be edited here.
          </span>
        </div>
      )}

      {/* Card layout: tabs + content */}
      <div className="bg-white rounded-[16px] border border-gray-200 flex min-h-[500px]">
        {/* Left tab nav */}
        <nav className="w-52 shrink-0 border-r border-gray-100 p-3 space-y-0.5">
          {TABS.map(({ id: tabId, label, icon: Icon }) => {
            const v1Limited = detail._isV1Fallback && (tabId === "overflow" || tabId === "ivr" || tabId === "announcements");
            return (
              <button
                key={tabId}
                onClick={() => { if (!v1Limited) { setActiveTab(tabId); setSaveError(null); } }}
                disabled={v1Limited}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                  activeTab === tabId
                    ? "bg-[#e8f0fe] text-[#1a73e8] font-medium"
                    : v1Limited
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {v1Limited && <span className="ml-auto text-xs text-gray-300">N/A</span>}
                {savedTab === tabId && tabId !== activeTab && !v1Limited && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right content panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === "basics" && (
            <BasicsSection
              detail={detail}
              onSave={(p) => saveMutation.mutate(p)}
              saving={saveMutation.isPending}
            />
          )}
          {activeTab === "overflow" && (
            <OverflowSection
              detail={detail}
              menus={menus}
              queues={queueOptions}
              onSave={(p) => saveMutation.mutate(p)}
              saving={saveMutation.isPending}
            />
          )}
          {activeTab === "ringing" && (
            <RingingSection
              detail={detail}
              onSave={(p) => saveMutation.mutate(p)}
              saving={saveMutation.isPending}
            />
          )}
          {activeTab === "ivr" && (
            <IvrSection
              detail={detail}
              menus={menus}
              queues={queueOptions}
              onSave={(p) => saveMutation.mutate(p)}
              saving={saveMutation.isPending}
            />
          )}
          {activeTab === "announcements" && (
            <AnnouncementsSection
              detail={detail}
              onSave={(p) => saveMutation.mutate(p)}
              saving={saveMutation.isPending}
            />
          )}
          {activeTab === "reports" && (
            <ReportsSection queueId={id} accountId={accountId} />
          )}
        </div>
      </div>
    </div>
  );
}
