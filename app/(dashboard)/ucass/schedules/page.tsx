"use client";
import { useTranslations } from "next-intl";

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
import { fetchPublicHolidays, type PublicHoliday } from "@/lib/api/holidays";
import { HOLIDAY_REGIONS, REGION_GROUPS, type HolidayRegion } from "@/data/holiday-regions";
import { Modal } from "@/components/settings/Modal";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import {
  Plus, Pencil, Trash2, Search, Calendar, Clock,
  ChevronDown, X, Globe, ChevronRight, ChevronLeft,
  CheckSquare, Square, AlertCircle,
} from "lucide-react";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";

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

function formatTimeLabel(time?: string): string {
  if (!time) return "—";
  const [clock, meridiem] = time.split(" ");
  const [hourRaw, minute] = clock.split(":");
  const hour = String(Number(hourRaw));
  if (minute === "00") return `${hour} ${meridiem}`;
  return `${hour}:${minute} ${meridiem}`;
}

function formatWeekdays(days: number[]): string {
  if (!days.length) return "—";
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join() === "2,3,4,5,6") return "Weekdays";
  if (sorted.join() === "1,2,3,4,5,6,7") return "Every Day";
  if (sorted.join() === "1,7") return "Weekends";

  const selected = WEEKDAYS.filter((d) => sorted.includes(d.value)).map((d) => d.label);
  if (selected.length === 1) {
    const labelMap: Record<string, string> = {
      Su: "Sunday",
      Mo: "Monday",
      Tu: "Tuesday",
      We: "Wednesday",
      Th: "Thursday",
      Fr: "Friday",
      Sa: "Saturday",
    };
    return labelMap[selected[0]] ?? selected[0];
  }
  return selected.join(" / ");
}

function formatDateRange(dates: string[], formatDate: (d: string) => string): string {
  if (!dates.length) return "—";
  if (dates.length === 1) return formatDate(dates[0]);
  return `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;
}

function usedByTotal(s: Schedule): number {
  const u = s.used;
  if (!u) return 0;
  return (u.users?.length ?? 0) + (u.departments?.length ?? 0) +
    (u.welcomeMenus?.length ?? 0) + (u.ringGroups?.length ?? 0) +
    (u.callQueues?.length ?? 0);
}

function formatRuleSummary(rule: ScheduleRule, formatDate?: (d: string) => string): { label: string; detail: string } {
  const fallbackFmt = (d: string) => new Date(d).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const label = rule.days.weekDays?.length
    ? formatWeekdays(rule.days.weekDays)
    : rule.days.dates?.length
    ? formatDateRange(rule.days.dates, formatDate ?? fallbackFmt)
    : "—";

  const allDay = rule.time.start === "12:00 AM" && rule.time.end === "11:59 PM";
  const detail = allDay
    ? "All day"
    : `${formatTimeLabel(rule.time.start)} - ${formatTimeLabel(rule.time.end)}`;

  return { label, detail };
}

// ── Used By popover ───────────────────────────────────────────────────────────
function UsedByBadge({ schedule }: { schedule: Schedule }) {
  const total = usedByTotal(schedule);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  if (total === 0) return <span className="text-sm text-gray-400">—</span>;

  const u = schedule.used!;
  const sections: { label: string; items: { id: string; name: string }[] }[] = [];
  if (u.ringGroups?.length)   sections.push({ label: "Ring Groups",   items: u.ringGroups });
  if (u.callQueues?.length)   sections.push({ label: "Call Queues",   items: u.callQueues! });
  if (u.users?.length)        sections.push({ label: "Users",         items: u.users! });
  if (u.departments?.length)  sections.push({ label: "Departments",   items: u.departments! });
  if (u.welcomeMenus?.length) sections.push({ label: "Welcome Menus", items: u.welcomeMenus! });

  return (
    <div className="inline-block">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 group"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(String(schedule.id))}`}>
          {total > 9 ? "9+" : total}
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

function CreatorAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!avatarUrl || failed) {
    return (
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(name)}`}>
        {getInitials(name)}
      </div>
    );
  }

  return (
    <Image
      src={avatarUrl}
      alt={name}
      width={28}
      height={28}
      className="rounded-full object-cover shrink-0"
      onError={() => setFailed(true)}
      unoptimized
    />
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
    <div className="space-y-3">
      {/* Mode toggle */}
      <SegmentedTabs
        value={rule.mode}
        onChange={(mode) => onChange({ ...rule, mode })}
        options={[
          { value: "weekdays", label: "Weekdays" },
          { value: "calendar", label: "Calendar" },
        ]}
        equalWidth={false}
      />

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
                    ? "bg-black text-white"
                    : "bg-white text-gray-600 border border-[#e5e7eb] hover:bg-[#F9F9FB]"
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
              rule.allDay ? "bg-black text-white" : "text-gray-500 hover:bg-[#F9F9FB]"
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
          <Button
            type="button"
            onClick={() => setRules((prev) => [...prev, makeEmptyRule()])}
            variant="secondary"
            size="md"
            className="mt-3"
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Another Interval
          </Button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-md disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap"
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

// ── Holiday Modal ─────────────────────────────────────────────────────────────

type HolidayStatus = "closed" | "open_custom";

interface HolidayDraft {
  holiday: PublicHoliday;
  enabled: boolean;
  status: HolidayStatus;
  timeStart: string;
  timeEnd: string;
}

type HolidayStep = "region" | "holidays" | "confirm";

function holidayDraftToApiRule(d: HolidayDraft): ScheduleRule {
  return {
    name: d.holiday.name,
    days: {
      weekDays: null,
      dates: [`${d.holiday.date}T00:00:00`],
      isRange: false,
    },
    time:
      d.status === "closed"
        ? { start: "12:00 AM", end: "11:59 PM" }
        : { start: d.timeStart, end: d.timeEnd },
  };
}

function formatHolidayDate(dateStr: string, formatDate?: (d: string) => string): string {
  if (formatDate) return formatDate(`${dateStr}T12:00:00`);
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function HolidayModal({
  isOpen,
  onClose,
  onSubmit,
  isPending,
  timezones,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (p: CreateSchedulePayload) => void;
  isPending: boolean;
  timezones: { abbreviation: string; name: string }[];
}) {
  const { formatDate } = useLocaleFormat();
  const currentYear = new Date().getFullYear();
  const [step, setStep] = useState<HolidayStep>("region");
  const [selectedRegion, setSelectedRegion] = useState<HolidayRegion | null>(null);
  const [year, setYear] = useState(currentYear);
  const [drafts, setDrafts] = useState<HolidayDraft[]>([]);
  const [scheduleName, setScheduleName] = useState("");
  const [timezone, setTimezone] = useState("EST");

  const { data: holidays = [], isFetching } = useQuery({
    queryKey: ["holidays", selectedRegion?.code, year],
    queryFn: () => fetchPublicHolidays(selectedRegion!.code, year),
    enabled: !!selectedRegion && step !== "region",
    staleTime: 24 * 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!isOpen) {
      setStep("region");
      setSelectedRegion(null);
      setDrafts([]);
      setScheduleName("");
      setTimezone("EST");
      setYear(currentYear);
    }
  }, [isOpen, currentYear]);

  useEffect(() => {
    if (holidays.length > 0 && step === "holidays") {
      setDrafts(
        holidays.map((h) => ({
          holiday: h,
          enabled: true,
          status: "closed",
          timeStart: "09:00 AM",
          timeEnd: "05:00 PM",
        }))
      );
    }
  }, [holidays, step]);

  useEffect(() => {
    if (selectedRegion && step === "holidays") {
      const suggestedName = `${selectedRegion.label} Holidays ${year}`;
      setScheduleName(suggestedName);
      setTimezone(
        selectedRegion.code === "US"
          ? "EST"
          : selectedRegion.code === "CA"
          ? "EST"
          : "EST"
      );
    }
  }, [selectedRegion, year, step]);

  const enabledCount = drafts.filter((d) => d.enabled).length;

  function toggleAll(val: boolean) {
    setDrafts((prev) => prev.map((d) => ({ ...d, enabled: val })));
  }

  function updateDraft(idx: number, patch: Partial<HolidayDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  function handleSubmit() {
    const rules = drafts.filter((d) => d.enabled).map(holidayDraftToApiRule);
    onSubmit({ name: scheduleName.trim(), timezone, rules });
  }

  const stepTitles: Record<HolidayStep, string> = {
    region: "Add Holiday Schedule",
    holidays: `${selectedRegion?.flag ?? ""} ${selectedRegion?.label ?? ""} — ${year}`,
    confirm: "Review & Create",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={stepTitles[step]} size="xl" bodyClassName="overflow-hidden p-0 flex min-h-0">
      <div className="relative flex h-full min-h-0 w-full flex-col pt-4 pb-0 bg-white">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-5 px-6">
        {(["region", "holidays", "confirm"] as HolidayStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-[#dadce0]" />}
            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
              step === s
                ? "bg-black text-white"
                : i < ["region", "holidays", "confirm"].indexOf(step)
                ? "bg-[#e8f0fe] text-[#1a73e8]"
                : "bg-[#f1f3f4] text-gray-400"
            }`}>
              <span className="font-bold">{i + 1}</span>
              <span className="hidden sm:inline capitalize">{s === "confirm" ? "Review" : s}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Step 1: Region ── */}
      {step === "region" && (
        <div className="space-y-5 px-6">
          <p className="text-sm text-gray-500">
            Choose a country to automatically import its national holidays. You can set each holiday as Closed or assign custom hours.
          </p>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Year</span>
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => setYear((y) => y - 1)}
                  className="p-1 rounded hover:bg-[#f1f3f4] text-gray-500"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-gray-800 w-12 text-center">{year}</span>
                <button
                  type="button"
                  onClick={() => setYear((y) => y + 1)}
                  disabled={year >= currentYear + 2}
                  className="p-1 rounded hover:bg-[#f1f3f4] text-gray-500 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {REGION_GROUPS.map((group) => (
              <div key={group} className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group}</p>
                <div className="grid grid-cols-3 gap-2">
                  {HOLIDAY_REGIONS.filter((r) => r.group === group).map((region) => (
                    <button
                      key={region.code}
                      type="button"
                      onClick={() => {
                        setSelectedRegion(region);
                        setStep("holidays");
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all hover:border-[#1a73e8] hover:bg-[#f8f9fa] ${
                        selectedRegion?.code === region.code
                          ? "border-[#1a73e8] bg-[#e8f0fe]"
                          : "border-[#dadce0] bg-white"
                      }`}
                    >
                      <span className="text-xl leading-none">{region.flag}</span>
                      <span className="text-sm font-medium text-gray-800 truncate">{region.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Holidays ── */}
      {step === "holidays" && (
        <div className="flex-1 min-h-0 w-full overflow-y-auto px-6 pb-[84px] bg-white">
          <div className="space-y-4">
          {isFetching ? (
            <div className="py-16 flex justify-center">
              <Loader variant="inline" label="Loading holidays…" />
            </div>
          ) : holidays.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
              <AlertCircle className="w-8 h-8 text-gray-300" />
              <p className="text-sm">No holidays found for this country/year.</p>
              <button
                type="button"
                onClick={() => setStep("region")}
                className="text-sm text-[#1a73e8] hover:underline"
              >
                Choose a different region
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <strong className="text-gray-900">{holidays.length}</strong> public holidays found.
                  Select the ones to include and set open or closed.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="text-xs text-[#1a73e8] hover:underline font-medium"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-[#dadce0] overflow-hidden bg-white">
                <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-2 bg-white border-b border-[#dadce0] text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <span />
                  <span>Holiday</span>
                  <span className="text-right pr-1">Status / Hours</span>
                </div>
                <div className="divide-y divide-[#f1f3f4] max-h-[380px] overflow-y-auto">
                  {drafts.map((d, i) => (
                    <div
                      key={d.holiday.date}
                      className={`grid grid-cols-[auto_1fr_auto] gap-3 items-start px-4 py-3 transition-colors ${
                        d.enabled ? "bg-white" : "bg-white opacity-60"
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => updateDraft(i, { enabled: !d.enabled })}
                        className="mt-0.5 text-[#1a73e8]"
                      >
                        {d.enabled
                          ? <CheckSquare className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                          : <Square className="w-[18px] h-[18px] text-gray-300" />}
                      </button>

                      {/* Name + date */}
                      <div>
                        <p className="text-sm font-medium text-gray-800">{d.holiday.localName}</p>
                        {d.holiday.localName !== d.holiday.name && (
                          <p className="text-xs text-gray-400">{d.holiday.name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">{formatHolidayDate(d.holiday.date, formatDate)}</p>
                      </div>

                      {/* Status controls */}
                      {d.enabled && (
                        <div className="flex flex-col items-end gap-1.5 min-w-[180px]">
                          <SegmentedTabs
                            value={d.status}
                            onChange={(value) => updateDraft(i, { status: value })}
                            options={[
                              { value: "closed", label: "Closed" },
                              { value: "open_custom", label: "Open" },
                            ]}
                            equalWidth={false}
                            className="h-[34px] min-h-[34px] max-h-[34px]"
                          />
                          {d.status === "open_custom" && (
                            <div className="flex items-center gap-1">
                              <select
                                value={d.timeStart}
                                onChange={(e) => updateDraft(i, { timeStart: e.target.value })}
                                className="text-xs border border-[#dadce0] rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                              >
                                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <span className="text-xs text-gray-400">–</span>
                              <select
                                value={d.timeEnd}
                                onChange={(e) => updateDraft(i, { timeEnd: e.target.value })}
                                className="text-xs border border-[#dadce0] rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                              >
                                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm ── */}
      {step === "confirm" && (
        <div className="flex-1 min-h-0 w-full overflow-y-auto px-6 pb-[84px] bg-white">
          <div className="w-full space-y-4">
          <div className="w-full p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Schedule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
              />
            </div>
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
          </div>

          <div className="w-full">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {enabledCount} holiday{enabledCount !== 1 ? "s" : ""} will be added
            </p>
            <div className="w-full rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {drafts.filter((d) => d.enabled).map((d) => (
                <div key={d.holiday.date} className="flex items-center justify-between px-4 py-2.5 border-b border-[#f1f3f4] last:border-0">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{d.holiday.localName}</span>
                    <span className="text-xs text-gray-400 ml-2">{formatHolidayDate(d.holiday.date, formatDate)}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    d.status === "closed"
                      ? "bg-red-50 text-red-600"
                      : "bg-blue-50 text-[#1a73e8]"
                  }`}>
                    {d.status === "closed" ? "Closed" : `${d.timeStart} – ${d.timeEnd}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          </div>
        </div>
      )}
      {(step === "holidays" || step === "confirm") && (
        <div className="n2p-holiday-footer absolute bottom-0 left-0 right-0 z-20 m-0 p-0 border-t border-[#e5e7eb] bg-white" style={{ backgroundColor: "#ffffff" }}>
          <div className="flex items-center justify-between px-6 py-[10px] bg-white" style={{ backgroundColor: "#ffffff" }}>
            <Button
              type="button"
              onClick={() => setStep(step === "holidays" ? "region" : "holidays")}
              variant="secondary"
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            {step === "holidays" ? (
              <button
                type="button"
                disabled={enabledCount === 0 || isFetching || holidays.length === 0}
                onClick={() => setStep("confirm")}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-md hover:bg-[#1557b0] disabled:opacity-40 transition-colors"
              >
                Continue with {enabledCount} holiday{enabledCount !== 1 ? "s" : ""}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending || !scheduleName.trim()}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-md hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
              >
                {isPending ? "Creating…" : "Create Holiday Schedule"}
              </button>
            )}
          </div>
        </div>
      )}
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const t = useTranslations("schedulesPage");
  const { bootstrap } = useApp();
  const { formatDate } = useLocaleFormat();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.schedules.all(accountId) });
      setModalOpen(false);
      setHolidayModalOpen(false);
    },
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
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define time-based rules for call routing across your account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setHolidayModalOpen(true)}
            variant="secondary"
            icon={<Globe className="w-4 h-4" />}
          >
            Add Holiday Schedule
          </Button>
          <Button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
          >
            Add Schedule
          </Button>
        </div>
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

      {/* Cards */}
      <div className="space-y-3">
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
          filtered.map((s) => {
            const rules = s.rules ?? [];
            const creator = s.createdBy;
            const creatorName = creator?.name ?? "System Admin";
            const avatarUrl = creator?.avatars?.find((a) => a.size === "120")?.url;

            return (
              <div key={s.id} className="rounded-[16px] bg-[#F9F9FB] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#e8f0fe] flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-[#1a73e8]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <TypeBadge type={s.type} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
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

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Days / Time</p>
                    {s.type === "24/7" ? (
                      <div className="rounded-lg bg-[#f8f9fa] px-3 py-2 border border-[#eef1f4]">
                        <p className="text-sm font-medium text-gray-800">Every Day</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          All hours, every day
                        </p>
                      </div>
                    ) : rules.length === 0 ? (
                      <span className="text-sm text-gray-400">—</span>
                    ) : (
                      <div className="space-y-2">
                        {rules.slice(0, 2).map((r, i) => {
                          const summary = formatRuleSummary(r, formatDate);
                          return (
                            <div key={i} className="rounded-lg bg-[#f8f9fa] px-3 py-2 border border-[#eef1f4]">
                              <p className="text-sm font-medium text-gray-800 truncate">{summary.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{summary.detail}</p>
                            </div>
                          );
                        })}
                        {rules.length > 2 && (
                          <p className="text-xs text-gray-400">+{rules.length - 2} more</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Timezone</p>
                      <span className="text-sm text-gray-600 font-mono">{s.timezone ?? "—"}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Used By</p>
                      <UsedByBadge schedule={s} />
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Added By</p>
                      <div className="flex items-center gap-2 min-w-0">
                        <CreatorAvatar name={creatorName} avatarUrl={avatarUrl} />
                        <span className="text-sm text-gray-700 truncate">{creatorName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
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

      <HolidayModal
        isOpen={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        onSubmit={(p) => addMutation.mutate(p)}
        isPending={addMutation.isPending}
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
