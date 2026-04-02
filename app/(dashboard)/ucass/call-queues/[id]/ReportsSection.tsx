"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchCallQueueDetail,
  fetchAgentActivityReport,
  fetchQueueActivityReport,
  type ReportIntervalSize,
  type QueueAgent,
} from "@/lib/api/call-queues";
import { FileDown } from "lucide-react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

type TimePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "weekToDate"
  | "lastWeek"
  | "monthToDate"
  | "lastMonth"
  | "custom";

const INTERVAL_OPTIONS: { value: ReportIntervalSize; label: string }[] = [
  { value: "quarter_of_hour", label: "15 Minutes" },
  { value: "hour", label: "1 Hour" },
  { value: "day", label: "1 Day" },
];

function normalizeReportTimezone(value?: string | null): string {
  if (!value) return "US/Eastern";
  if (value.includes("/")) return value;

  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    est: "US/Eastern",
    edt: "US/Eastern",
    "eastern standard time": "US/Eastern",
    "eastern time": "US/Eastern",
    cst: "US/Central",
    cdt: "US/Central",
    "central standard time": "US/Central",
    "central time": "US/Central",
    mst: "US/Mountain",
    mdt: "US/Mountain",
    "mountain standard time": "US/Mountain",
    "mountain time": "US/Mountain",
    pst: "US/Pacific",
    pdt: "US/Pacific",
    "pacific standard time": "US/Pacific",
    "pacific time": "US/Pacific",
  };

  return aliases[normalized] ?? "US/Eastern";
}

function getDateRange(
  preset: TimePreset,
  timezone: string,
  customStart?: string,
  customEnd?: string
): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: timezone });

  const today = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const last7End = new Date(today);
  last7End.setDate(last7End.getDate() - 1);
  const last7Start = new Date(last7End);
  last7Start.setDate(last7Start.getDate() - 6);

  const weekToDateStart = new Date(today);
  const dayOfWeek = weekToDateStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekToDateStart.setDate(weekToDateStart.getDate() + mondayOffset);

  const lastWeekEnd = new Date(weekToDateStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const lastWeekStart = new Date(lastWeekEnd);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);

  const monthToDateStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

  switch (preset) {
    case "today":
      return { start: fmt(today), end: fmt(today) };
    case "yesterday":
      return { start: fmt(yesterday), end: fmt(yesterday) };
    case "last7":
      return { start: fmt(last7Start), end: fmt(last7End) };
    case "weekToDate":
      return { start: fmt(weekToDateStart), end: fmt(today) };
    case "lastWeek":
      return { start: fmt(lastWeekStart), end: fmt(lastWeekEnd) };
    case "monthToDate":
      return { start: fmt(monthToDateStart), end: fmt(today) };
    case "lastMonth":
      return { start: fmt(lastMonthStart), end: fmt(lastMonthEnd) };
    case "custom":
      return {
        start: customStart ?? fmt(yesterday),
        end: customEnd ?? fmt(today),
      };
    default:
      return { start: fmt(yesterday), end: fmt(today) };
  }
}

const TIME_PRESETS: { value: TimePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "weekToDate", label: "Week to date" },
  { value: "lastWeek", label: "Last week" },
  { value: "monthToDate", label: "Month to date" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom Date Range" },
];

export function ReportsSection({
  queueId,
  accountId,
}: {
  queueId: string;
  accountId: number;
}) {
  const { bootstrap } = useApp();
  const { data: queueDetail } = useQuery({
    queryKey: qk.callQueues.detail(accountId, queueId),
    queryFn: () => fetchCallQueueDetail(queueId, accountId),
    enabled: !!queueId && !!accountId,
  });

  const agents: QueueAgent[] = queueDetail?.agents ?? [];

  const [reportType, setReportType] = useState<"agent" | "queue">("agent");
  const [agentId, setAgentId] = useState<string>("all");
  const [intervalSize, setIntervalSize] = useState<ReportIntervalSize>("hour");
  const [timePreset, setTimePreset] = useState<TimePreset>("last7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [reportData, setReportData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmptySlots, setShowEmptySlots] = useState(false);
  const reportTimezone = normalizeReportTimezone(
    bootstrap?.user?.timeZone || bootstrap?.account?.timeZone
  );

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange(
        timePreset,
        reportTimezone,
        customStart || undefined,
        customEnd || undefined
      );
      if (reportType === "agent") {
        const result = await fetchAgentActivityReport({
          accountId,
          queueId,
          startDate: start,
          endDate: end,
          intervalSize,
          ianaTimezoneId: reportTimezone,
          agentIds: agentId === "all" ? undefined : [parseInt(agentId, 10)],
        });
        setReportData(result);
      } else {
        const result = await fetchQueueActivityReport({
          accountId,
          queueId,
          startDate: start,
          endDate: end,
          intervalSize,
          ianaTimezoneId: reportTimezone,
        });
        setReportData(result);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to generate report");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!reportData || !Array.isArray(reportData)) return;
    const rows = reportData as Record<string, unknown>[];
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(",");
    const lines = rows.map((r) => Object.values(r).map((v) => `"${String(v ?? "")}"`).join(","));
    const csv = [headers, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-activity-${queueId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reportRows = (() => {
    if (!reportData) return [];
    const d = reportData as Record<string, unknown>;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d.items)) return d.items as Record<string, unknown>[];
    if (Array.isArray(d.data)) return d.data as Record<string, unknown>[];
    return d.data != null ? [d.data] as Record<string, unknown>[] : [d];
  })();

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Call Queue Reports</h3>
        <p className="text-sm text-gray-500 mb-4">
          Generate agent or queue activity reports for this call queue. Reports are available for calls from June 1, 2025 onward.
        </p>

        <div className="mb-4">
          <SegmentedTabs
            value={reportType}
            onChange={(value) => {
              setReportType(value);
              setReportData(null);
              setError(null);
            }}
            options={[
              { value: "agent", label: "Agent Activity Report" },
              { value: "queue", label: "Queue Activity Report" },
            ]}
            className="w-full max-w-[520px]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {reportType === "agent" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              >
                <option value="all">All Agents</option>
                {agents.map((a) => (
                  <option key={a.user_id ?? a.id} value={String(a.user_id ?? a.id)}>
                    {a.display_name ?? `Agent ${a.user_id ?? a.id}`}{a.extension ? ` · ${a.extension}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Interval</label>
            <select
              value={intervalSize}
              onChange={(e) => setIntervalSize(e.target.value as ReportIntervalSize)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            >
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setTimePreset(p.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  timePreset === p.value ? "bg-[#1a73e8] text-white" : "bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {timePreset === "custom" && (
          <div className="flex gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 py-3 rounded-lg text-sm font-medium bg-[#1a73e8] text-white hover:bg-[#1557b0] disabled:opacity-50"
        >
          {loading ? <Loader variant="button" /> : "Generate Report"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {reportData != null && !error && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showEmptySlots}
                onChange={(e) => setShowEmptySlots(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show time slots with no activity
            </label>
            <button
              onClick={handleExportCsv}
              disabled={!Array.isArray(reportRows) || reportRows.length === 0}
              className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {Array.isArray(reportRows) && reportRows.length > 0 ? (
            <div className="rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="n2p-table w-full text-sm">
                  <thead>
                    <tr>
                      {Object.keys(reportRows[0] as Record<string, unknown>).map((k) => (
                        <th key={k}>
                          {k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row as Record<string, unknown>).map((v, j) => {
                          const display =
                            v == null
                              ? "—"
                              : typeof v === "object"
                                ? (v as Record<string, unknown>).id != null
                                  ? String((v as Record<string, unknown>).id)
                                  : (v as Record<string, unknown>).name != null
                                    ? String((v as Record<string, unknown>).name)
                                    : JSON.stringify(v)
                                : String(v);
                          return (
                            <td key={j}>
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data returned for the selected criteria.</p>
          )}
        </div>
      )}
    </div>
  );
}
