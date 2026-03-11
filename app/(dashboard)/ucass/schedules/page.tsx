"use client";

import Image from "next/image";
import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchSchedules,
  fetchTimezones,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type Schedule,
  type ScheduleRule,
  type CreateSchedulePayload,
} from "@/lib/api/schedules";
import { Modal } from "@/components/settings/Modal";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import {
  Plus, Pencil, Trash2, Search, Calendar, Clock,
  ChevronDown, X,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const WEEKDAYS = [
  { label: "Su", value: 1 },
  { label: "Mo", value: 2 },
  { label: "Tu", value: 3 },
  { label: "We", value: 4 },
  { label: "Th", value: 5 },
  { label: "Fr", value: 6 },
  { label: "Sa", value: 7 },
];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const hh = h % 12 === 0 ? 12 : h % 12;
    const mm = m === 0 ? "00" : "30";
    const ampm = h < 12 ? "AM" : "PM";
    TIME_OPTIONS.push(`${String(hh).padStart(2, "0")}:${mm} ${ampm}`);
  }
}
TIME_OPTIONS.push("11:59 PM");

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

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

function formatWeekdays(days: number[]): string {
  if (!days.length) return "—";
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join() === "2,3,4,5,6") return "Mon – Fri";
  if (sorted.join() === "1,2,3,4,5,6,7") return "Every Day";
  if (sorted.join() === "1,7") return "Weekends";
  return WEEKDAYS.filter((d) => sorted.includes(d.value)).map((d) => d.label).join(", ");
}

function formatDateRange(dates: string[]): string {
  if (!dates.length) return "—";
  const fmt = (d: string) => new Date(d).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  if (dates.length === 1) return fmt(dates[0]);
  return `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}`;
}

function usedByTotal(s: Schedule): number {
  const u = s.used;
  if (!u) return 0;
  return (u.users?.length ?? 0) + (u.departments?.length ?? 0) +
    (u.welcomeMenus?.length ?? 0) + (u.ringGroups?.length ?? 0) +
    (u.callQueues?.length ?? 0);
}

// ── Used By popover ───────────────────────────────────────────────────────────
function UsedByBadge({ schedule }: { schedule: Schedule }) {
  const total = usedByTotal(schedule);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (total === 0) return <span className="text-sm text-gray-400">—</span>;

  const u = schedule.used!;
  const sections: { label: string; items: { id: string; name: string }[] }[] = [];
  if (u.ringGroups?.length)   sections.push({ label: "Ring Groups",   items: u.ringGroups });
  if (u.callQueues?.length)   sections.push({ label: "Call Queues",   items: u.callQueues! });
  if (u.users?.length)        sections.push({ label: "Users",         items: u.users! });
  if (u.departments?.length)  sections.push({ label: "Departments",   items: u.departments! });
  if (u.welcomeMenus?.length) sections.push({ label: "Welcome Menus", items: u.welcomeMenus! });

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 group"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(String(schedule.id))}`}>
          {total > 9 ? "9+" : total}
        </div>
        <span className="text-sm text-[#1a73e8] group-hover:underline font-medium">{total}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#1a73e8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#dadce0] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#f1f3f4] bg-[#f8f9fa]">
            <span className="text-xs font-semibold text-gray-600">
              Used by {total} item{total !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-[#e8eaed] text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {sections.map((sec) => (
              <div key={sec.label}>
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {sec.label}
                </p>
                {sec.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f8f9fa]">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(item.name)}`}>
                      {getInitials(item.name)}
                    </div>
                    <span className="text-sm text-gray-700 truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Schedule type badge ───────────────────────────────────────────────────────
function TypeBadge({ type }: { type?: string }) {
  const t = type ?? "Custom";
  const styles: Record<string, string> = {
    "24/7":   "bg-green-100 text-green-700",
    "Open":   "bg-blue-100 text-blue-700",
    "Custom": "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[t] ?? "bg-gray-100 text-gray-600"}`}>
      {t}
    </span>
  );
}

// ── Rule Interval Editor ──────────────────────────────────────────────────────
type RuleMode = "weekdays" | "calendar";

interface DraftRule {
  mode: RuleMode;
  weekDays: number[];
  dateStart: string;
  dateEnd: string;
  timeStart: string;
  timeEnd: string;
  allDay: boolean;
}

function makeEmptyRule(): DraftRule {
  return {
    mode: "weekdays",
    weekDays: [2, 3, 4, 5, 6],
    dateStart: "",
    dateEnd: "",
    timeStart: "09:00 AM",
    timeEnd: "05:00 PM",
    allDay: false,
  };
}

function RuleEditor({
  rule,
  onChange,
  onRemove,
  showRemove,
}: {
  rule: DraftRule;
  onChange: (r: DraftRule) => void;
  onRemove?: () => void;
  showRemove: boolean;
}) {
  const toggleDay = (v: number) => {
    const next = rule.weekDays.includes(v)
      ? rule.weekDays.filter((d) => d !== v)
      : [...rule.weekDays, v];
    onChange({ ...rule, weekDays: next });
  };

  return (
    <div className="border border-[#dadce0] rounded-lg p-4 space-y-3 bg-white">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-0.5 bg-[#f1f3f4] rounded-lg w-fit">
        {(["weekdays", "calendar"] as RuleMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ ...rule, mode: m })}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              rule.mode === m
                ? "bg-white text-[#1a73e8] shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {m === "weekdays" ? "Weekdays" : "Calendar"}
          </button>
        ))}
      </div>

      {/* Day selector */}
      {rule.mode === "weekdays" ? (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Days</p>
          <div className="flex gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`w-9 h-9 rounded-full text-xs font-semibold transition-all ${
                  rule.weekDays.includes(d.value)
                    ? "bg-[#1a73e8] text-white shadow-sm"
                    : "bg-[#f1f3f4] text-gray-600 hover:bg-[#e8eaed]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Date Range</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-0.5 block">From</label>
              <input
                type="date"
                value={rule.dateStart}
                onChange={(e) => onChange({ ...rule, dateStart: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-0.5 block">To</label>
              <input
                type="date"
                value={rule.dateEnd}
                onChange={(e) => onChange({ ...rule, dateEnd: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Time */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-gray-500">Time</p>
          <button
            type="button"
            onClick={() => onChange({ ...rule, allDay: !rule.allDay, timeStart: "12:00 AM", timeEnd: "11:59 PM" })}
            className={`text-xs font-medium px-2 py-0.5 rounded-full transition-all ${
              rule.allDay ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-gray-500 hover:bg-[#f1f3f4]"
            }`}
          >
            {rule.allDay ? "✓ All Day" : "All Day"}
          </button>
        </div>
        {!rule.allDay && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-0.5 block">Start</label>
              <select
                value={rule.timeStart}
                onChange={(e) => onChange({ ...rule, timeStart: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
              >
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-0.5 block">End</label>
              <select
                value={rule.timeEnd}
                onChange={(e) => onChange({ ...rule, timeEnd: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
              >
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {showRemove && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={onRemove} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" /> Remove interval
          </button>
        </div>
      )}
    </div>
  );
}

// ── Draft ↔ API conversion ────────────────────────────────────────────────────
function draftToApiRule(d: DraftRule, idx: number): ScheduleRule {
  const timeStart = d.allDay ? "12:00 AM" : d.timeStart;
  const timeEnd   = d.allDay ? "11:59 PM"  : d.timeEnd;
  return {
    name: `rule${idx + 1}`,
    days: d.mode === "calendar"
      ? { weekDays: null, dates: [d.dateStart, d.dateEnd].filter(Boolean).map((s) => `${s}T00:00:00`), isRange: true }
      : { weekDays: [...d.weekDays].sort((a, b) => a - b), dates: null, isRange: true },
    time: { start: timeStart, end: timeEnd },
  };
}

function apiRuleToDraft(r: ScheduleRule): DraftRule {
  const isCalendar = !!r.days.dates?.length;
  const allDay = r.time.start === "12:00 AM" && r.time.end === "11:59 PM";
  return {
    mode: isCalendar ? "calendar" : "weekdays",
    weekDays: r.days.weekDays ?? [],
    dateStart: r.days.dates?.[0]?.slice(0, 10) ?? "",
    dateEnd:   r.days.dates?.[1]?.slice(0, 10) ?? r.days.dates?.[0]?.slice(0, 10) ?? "",
    timeStart: r.time.start,
    timeEnd:   r.time.end,
    allDay,
  };
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function ScheduleModal({
  isOpen,
  editing,
  onClose,
  onSubmit,
  isPending,
  timezones,
}: {
  isOpen: boolean;
  editing: Schedule | null;
  onClose: () => void;
  onSubmit: (p: CreateSchedulePayload) => void;
  isPending: boolean;
  timezones: { abbreviation: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("EST");
  const [rules, setRules] = useState<DraftRule[]>([makeEmptyRule()]);

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setName(editing.name);
      setTimezone(editing.timezone ?? "EST");
      const r = editing.rules ?? [];
      setRules(r.length ? r.map(apiRuleToDraft) : [makeEmptyRule()]);
    } else {
      setName("");
      setTimezone(timezones[0]?.abbreviation ?? "EST");
      setRules([makeEmptyRule()]);
    }
  }, [isOpen, editing, timezones]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: name.trim(), timezone, rules: rules.map(draftToApiRule) });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit: ${editing.name}` : "Add New Schedule"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editing && (
          <p className="text-sm text-gray-500 bg-[#f8f9fa] rounded-lg px-3 py-2.5">
            Create a schedule that can be used by everyone in the company.
          </p>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Schedule Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            required
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Business Hours"
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
          />
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
          >
            {timezones.map((tz) => (
              <option key={tz.abbreviation} value={tz.abbreviation}>
                {tz.abbreviation} – {tz.name}
              </option>
            ))}
          </select>
        </div>

        {/* Intervals */}
        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Schedule Intervals</p>
          <div className="space-y-3">
            {rules.map((rule, i) => (
              <RuleEditor
                key={i}
                rule={rule}
                onChange={(updated) => setRules((prev) => prev.map((r, idx) => idx === i ? updated : r))}
                onRemove={() => setRules((prev) => prev.filter((_, idx) => idx !== i))}
                showRemove={rules.length > 1}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRules((prev) => [...prev, makeEmptyRule()])}
            className="mt-3 flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Another Interval
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#f1f3f4]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-[#f1f3f4] rounded-md">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-md disabled:opacity-50 flex items-center gap-2"
          >
            {isPending
              ? "Saving…"
              : editing
              ? "Save Changes"
              : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: qk.schedules.list(accountId),
    queryFn: () => fetchSchedules(accountId),
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: timezones = [] } = useQuery({
    queryKey: ["timezones"],
    queryFn: fetchTimezones,
    staleTime: 60 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: (p: CreateSchedulePayload) => createSchedule(accountId, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.schedules.all(accountId) }); setModalOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CreateSchedulePayload }) =>
      updateSchedule(accountId, id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.schedules.all(accountId) }); setModalOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSchedule(accountId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.schedules.all(accountId) }); setDeleteTarget(null); },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return schedules;
    const q = search.toLowerCase();
    return schedules.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.type ?? "").toLowerCase().includes(q) ||
      (s.timezone ?? "").toLowerCase().includes(q)
    );
  }, [schedules, search]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Schedules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define time-based rules for call routing across your account.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-md hover:bg-[#1557b0] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Schedule
        </button>
      </div>

      {/* Search + count */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search schedules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#dadce0] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-gray-50"
          />
        </div>
        <span className="text-sm text-gray-500">
          Total: <strong className="text-gray-900">{schedules.length}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="border border-[#dadce0] rounded-lg overflow-hidden">
        <div className="grid grid-cols-[2fr_3fr_100px_160px_120px_80px] gap-4 px-5 py-2.5 bg-[#f8f9fa] border-b border-[#dadce0] text-xs font-semibold text-gray-400 uppercase tracking-wide">
          <span>Name</span>
          <span>Days / Time</span>
          <span>Timezone</span>
          <span>Added By</span>
          <span>Used By</span>
          <span />
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader variant="inline" label="Loading schedules…" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <Calendar className="w-10 h-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">
              {search ? "No schedules match your search" : "No schedules found"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f1f3f4]">
            {filtered.map((s) => {
              const rules = s.rules ?? [];
              const creator = s.createdBy;
              const creatorName = creator?.name ?? "System Admin";
              const avatarUrl = creator?.avatars?.find((a) => a.size === "120")?.url;

              return (
                <div
                  key={s.id}
                  className="group grid grid-cols-[2fr_3fr_100px_160px_120px_80px] gap-4 items-center px-5 py-3.5 hover:bg-[#f8f9fa] transition-colors"
                >
                  {/* Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-[#1a73e8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <TypeBadge type={s.type} />
                    </div>
                  </div>

                  {/* Days/Time */}
                  <div className="min-w-0">
                    {s.type === "24/7" ? (
                      <span className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5 text-gray-400" /> All hours, every day
                      </span>
                    ) : rules.length === 0 ? (
                      <span className="text-sm text-gray-400">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {rules.slice(0, 2).map((r, i) => {
                          const dayPart = r.days.weekDays?.length
                            ? formatWeekdays(r.days.weekDays)
                            : r.days.dates?.length
                            ? formatDateRange(r.days.dates)
                            : "—";
                          const allDay = r.time.start === "12:00 AM" && r.time.end === "11:59 PM";
                          const timePart = allDay ? "All Day" : `${r.time.start} – ${r.time.end}`;
                          return (
                            <p key={i} className="text-sm text-gray-700 truncate">
                              <span className="font-medium">{dayPart}</span>
                              <span className="text-gray-400 mx-1">·</span>
                              {timePart}
                            </p>
                          );
                        })}
                        {rules.length > 2 && (
                          <p className="text-xs text-gray-400">+{rules.length - 2} more</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Timezone */}
                  <span className="text-sm text-gray-600 font-mono">{s.timezone ?? "—"}</span>

                  {/* Added By */}
                  <div className="flex items-center gap-2 min-w-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={creatorName} width={28} height={28} className="rounded-full object-cover shrink-0" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(creatorName)}`}>
                        {getInitials(creatorName)}
                      </div>
                    )}
                    <span className="text-sm text-gray-700 truncate">{creatorName}</span>
                  </div>

                  {/* Used By */}
                  <UsedByBadge schedule={s} />

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button
                      onClick={() => { setEditing(s); setModalOpen(true); }}
                      className="p-1.5 rounded-md text-gray-400 hover:text-[#1a73e8] hover:bg-[#e8f0fe] transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(s)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ScheduleModal
        isOpen={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={(p) => editing ? updateMutation.mutate({ id: editing.id, payload: p }) : addMutation.mutate(p)}
        isPending={addMutation.isPending || updateMutation.isPending}
        timezones={timezones}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Schedule"
        message={`Delete "${deleteTarget?.name}"? This may affect routing rules that use it.`}
        variant="danger"
      />
    </div>
  );
}
