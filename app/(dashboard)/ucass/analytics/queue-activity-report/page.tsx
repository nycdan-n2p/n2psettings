"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchCallQueues,
  fetchQueueActivityReport,
  type CallQueue,
  type ReportIntervalSize,
} from "@/lib/api/call-queues";
import { FileDown } from "lucide-react";

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

function getDateRange(preset: TimePreset, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date();
  const tz = "America/New_York";
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });

  const today = new Date(now.toLocaleString("en-US", { timeZone: tz }));
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

function formatIntervalLabel(preset: TimePreset, customStart?: string, customEnd?: string): string {
  if (preset === "custom" && customStart && customEnd) {
    return `Custom Date Range (${customStart} – ${customEnd})`;
  }
  const labels: Record<TimePreset, string> = {
    today: "Today",
    yesterday: "Yesterday",
    last7: "Last 7 days",
    weekToDate: "Week to date",
    lastWeek: "Last week",
    monthToDate: "Month to date",
    lastMonth: "Last month",
    custom: "Custom Date Range",
  };
  return labels[preset];
}

export default function QueueActivityReportPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const [queueId, setQueueId] = useState("");
  const [intervalSize, setIntervalSize] = useState<ReportIntervalSize>("quarter_of_hour");
  const [timePreset, setTimePreset] = useState<TimePreset>("last7");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showEmptySlots, setShowEmptySlots] = useState(false);
  const [reportData, setReportData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: queues = [] } = useQuery({
    queryKey: qk.callQueues.list(accountId),
    queryFn: fetchCallQueues,
    enabled: !!accountId,
  });

  const canGenerate = !!queueId;

  const handleGenerate = async () => {
    if (!queueId) return;
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange(timePreset, customStart || undefined, customEnd || undefined);
      const result = await fetchQueueActivityReport({
        queueId,
        startDate: start,
        endDate: end,
        intervalSize,
      });
      setReportData(result);
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
    a.download = `queue-activity-${queueId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const timePresets: { value: TimePreset; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "last7", label: "Last 7 days" },
    { value: "weekToDate", label: "Week to date" },
    { value: "lastWeek", label: "Last week" },
    { value: "monthToDate", label: "Month to date" },
    { value: "lastMonth", label: "Last month" },
    { value: "custom", label: "Custom Date Range" },
  ];

  const reportRows = Array.isArray(reportData) ? reportData : (reportData as Record<string, unknown>)?.data != null
    ? ((reportData as Record<string, unknown>).data as unknown[])
    : reportData != null
      ? [reportData]
      : [];

  const intervalLabel = INTERVAL_OPTIONS.find((o) => o.value === intervalSize)?.label ?? intervalSize;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Queue Activity Report</h1>
        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">beta</span>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Call Queue</label>
            <select
              value={queueId}
              onChange={(e) => setQueueId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-[#1a73e8]"
            >
              <option value="">Select Queue</option>
              {queues.map((q: CallQueue) => (
                <option key={q.id} value={q.id}>{q.name}{q.extension ? ` (${q.extension})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Interval</label>
            <select
              value={intervalSize}
              onChange={(e) => setIntervalSize(e.target.value as ReportIntervalSize)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-[#1a73e8]"
            >
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Choose a Time Period</label>
          <div className="flex flex-wrap gap-2">
            {timePresets.map((p) => (
              <button
                key={p.value}
                onClick={() => setTimePreset(p.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timePreset === p.value
                    ? "bg-[#1a73e8] text-white"
                    : "bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {timePreset === "custom" && (
          <div className="flex gap-4 items-end">
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

        <p className="text-xs text-gray-500">Reports are only available for calls from June 1, 2025, onward.</p>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
          className={`px-6 py-3 rounded-lg text-sm font-medium ${
            canGenerate && !loading
              ? "bg-[#1a73e8] text-white hover:bg-[#1557b0]"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          {loading ? <Loader variant="button" /> : "Generate Report"}
        </button>
      </div>

      {error && (
        <div className="mt-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {reportData != null && !error && (
        <div className="mt-8">
          <p className="text-sm text-gray-600 mb-2">
            Showing: {intervalLabel} intervals for {formatIntervalLabel(timePreset, customStart || undefined, customEnd || undefined)}
          </p>
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
              className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-4 h-4" />
              Generate CSV
            </button>
          </div>

          {Array.isArray(reportRows) && reportRows.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      {Object.keys(reportRows[0] as Record<string, unknown>).map((k) => (
                        <th key={k} className="px-4 py-3 text-left font-medium text-gray-700">
                          {k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        {Object.values(row as Record<string, unknown>).map((v, j) => (
                          <td key={j} className="px-4 py-3 text-gray-700">
                            {v != null ? String(v) : "—"}
                          </td>
                        ))}
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
