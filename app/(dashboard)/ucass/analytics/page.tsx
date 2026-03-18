"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useApp } from "@/contexts/AppContext";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchAnalyticsFromCallHistory,
  type DirectionFilter,
} from "@/lib/api/analytics-from-history";
import { fetchCallHistory } from "@/lib/api/call-history";
import { DataTable } from "@/components/tables/DataTable";
import { AnalyzeModal } from "@/components/calls/AnalyzeModal";
import type { CallAnalysis } from "@/app/api/analyze-calls/route";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  TrendingUp,
  Voicemail,
  Mic,
  ArrowDownToLine,
  ArrowUpFromLine,
  MessageSquare,
  Users,
  BarChart2,
} from "lucide-react";

type Preset = "7d" | "30d" | "90d";

const PRESETS: { label: string; value: Preset; days: number }[] = [
  { label: "7 days", value: "7d", days: 7 },
  { label: "30 days", value: "30d", days: 30 },
  { label: "90 days", value: "90d", days: 90 },
];

const DIRECTIONS: { label: string; value: DirectionFilter; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "All", value: "all", icon: Phone },
  { label: "Inbound", value: "inbound", icon: ArrowDownToLine },
  { label: "Outbound", value: "outbound", icon: ArrowUpFromLine },
];

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function formatTimeOnCalls(totalSeconds?: number): string {
  if (!totalSeconds) return "00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function AnalyticsPage() {
  const { bootstrap } = useApp();
  const { formatDate } = useLocaleFormat();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? null;

  const formatChartDate = (dateStr: string, preset: Preset): string => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (preset === "7d") return d.toLocaleDateString(undefined, { weekday: "short" });
    return formatDate(d);
  };
  const [preset, setPreset] = useState<Preset>("7d");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CallAnalysis | null>(null);

  const days = PRESETS.find((p) => p.value === preset)?.days ?? 7;
  const directionNum = direction === "inbound" ? 0 : direction === "outbound" ? 1 : null;
  const dateLabel = `${days} days · ${direction === "all" ? "All" : direction === "inbound" ? "Inbound" : "Outbound"}`;

  const { data: stats, isLoading } = useQuery({
    queryKey: qk.analytics.fromHistory(accountId, preset, direction),
    queryFn: () => fetchAnalyticsFromCallHistory(accountId, userId, direction, days),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  const chartData =
    stats?.dailyVolume.map((d) => ({
      date: formatChartDate(d.date, preset),
      fullDate: d.date,
      calls: d.calls,
      answered: d.answered,
      missed: d.missed,
    })) ?? [];

  type UserRow = NonNullable<typeof stats>["userRows"][number];
  type DeptRow = NonNullable<typeof stats>["deptRows"][number];

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const allData = await fetchCallHistory(
        accountId,
        userId,
        { direction: directionNum },
        500,
        null
      );
      const res = await fetch("/api/analyze-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cdrs: allData.cdrs,
          scope: "company",
          dateLabel,
        }),
      });
      if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);
      const data: CallAnalysis = await res.json();
      setAnalysisResult(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const userColumns: ColumnDef<UserRow>[] = [
    { id: "name", header: "User", accessorFn: (r) => r.name ?? "—" },
    { id: "total", header: "Total Calls", accessorFn: (r) => r.totalCalls ?? 0 },
    { id: "answered", header: "Answered", accessorFn: (r) => r.answeredCalls ?? 0 },
    { id: "missed", header: "Missed", accessorFn: (r) => r.missedCalls ?? 0 },
    {
      id: "avg",
      header: "Avg Duration",
      cell: ({ row }) => formatDuration(row.original.avgDurationSec),
    },
  ];

  const deptColumns: ColumnDef<DeptRow>[] = [
    { id: "name", header: "Department", accessorFn: (r) => r.name ?? "—" },
    { id: "total", header: "Total Calls", accessorFn: (r) => r.totalCalls ?? 0 },
    { id: "answered", header: "Answered", accessorFn: (r) => r.answeredCalls ?? 0 },
    { id: "missed", header: "Missed", accessorFn: (r) => r.missedCalls ?? 0 },
  ];

  const totalDurationSec = stats
    ? (stats.totalCalls ?? 0) * (stats.avgDurationSec ?? 0)
    : 0;

  const statCards = [
    {
      label: "Messages",
      value: "—",
      icon: MessageSquare,
      color: "text-violet-600",
      bg: "bg-violet-50",
      hint: "Messaging data not yet available",
    },
    {
      label: "Calls",
      value: stats?.totalCalls ?? "—",
      icon: Phone,
      color: "text-slate-600",
      bg: "bg-slate-50",
    },
    {
      label: "Unique conversations",
      value: "—",
      icon: Users,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      hint: "Messaging data not yet available",
    },
    {
      label: "Time on calls",
      value: formatTimeOnCalls(totalDurationSec),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Total Calls",
      value: stats?.totalCalls ?? "—",
      icon: Phone,
      color: "text-slate-600",
      bg: "bg-slate-50",
    },
    {
      label: "Answered",
      value: stats?.answeredCalls ?? "—",
      icon: PhoneCall,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Missed",
      value: stats?.missedCalls ?? "—",
      icon: PhoneOff,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      label: "Answer Rate",
      value: stats ? `${stats.answerRatePct}%` : "—",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Avg Duration",
      value: formatDuration(stats?.avgDurationSec),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Voicemails",
      value: stats?.voicemailCalls ?? "—",
      icon: Voicemail,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Recordings",
      value: stats?.recordingCount ?? "—",
      icon: Mic,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Peak Hour",
      value: stats?.peakHour != null ? `${stats.peakHour}:00` : "—",
      icon: Clock,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          Call Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {bootstrap?.account?.company ?? "Account"} · Insights from call history
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Direction:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDirection(d.value)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                  direction === d.value
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <d.icon className="w-4 h-4" />
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Range:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  preset === p.value
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !accountId}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-lg hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <BarChart2 className="w-4 h-4" />
          {analyzing ? "Analyzing…" : "Analyze Calls"}
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Loader variant="inline" label="Loading analytics..." />
        </div>
      ) : (
        <>
          {/* Overview metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {statCards.slice(0, 4).map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border border-gray-100 p-4 ${s.bg} transition-shadow hover:shadow-sm`}
                title={"hint" in s ? s.hint : undefined}
              >
                <div className={`mt-0.5 ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-gray-500 mt-2">{s.label}</p>
                <p className="text-xl font-semibold text-gray-900 mt-0.5">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Call stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            {statCards.slice(4).map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border border-gray-100 p-4 ${s.bg} transition-shadow hover:shadow-sm`}
              >
                <div className={`mt-0.5 ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-gray-500 mt-2">{s.label}</p>
                <p className="text-xl font-semibold text-gray-900 mt-0.5">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="mb-10">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Call volume over time
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm min-h-[320px]">
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                  No call data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      axisLine={{ stroke: "#e5e7eb" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="p-2 space-y-1 text-sm">
                            <div className="font-medium text-gray-900">{p.fullDate}</div>
                            <div>Total: {p.calls}</div>
                            <div className="text-emerald-600">Answered: {p.answered}</div>
                            <div className="text-rose-600">Missed: {p.missed}</div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#callGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Activities: Busy times */}
          <div className="mb-10">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Activities
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Busy times</h3>
              <p className="text-xs text-gray-500 mb-4">
                Call volume by day of week and hour (darker = more calls)
              </p>
              {(() => {
                const grid = stats?.busyTimesGrid ?? [];
                const maxCount = Math.max(
                  1,
                  ...grid.flat()
                );
                return (
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      {/* Hour labels */}
                      <div className="flex mb-1">
                        <div className="w-12 shrink-0" />
                        <div className="flex flex-1 gap-0.5">
                          {Array.from({ length: 24 }, (_, h) => (
                            <div
                              key={h}
                              className="flex-1 text-[10px] text-gray-400 text-center truncate"
                            >
                              {h % 6 === 0 ? h : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Rows: Mon-Sun (grid uses getDay: 0=Sun, 1=Mon, ...) */}
                      {DAY_LABELS.map((label, i) => {
                        const dayIdx = DAY_ORDER[i];
                        return (
                        <div key={label} className="flex items-center gap-1 mb-0.5">
                          <div className="w-12 shrink-0 text-xs text-gray-600">{label}</div>
                          <div className="flex flex-1 gap-0.5">
                            {Array.from({ length: 24 }, (_, hour) => {
                              const count = grid[dayIdx]?.[hour] ?? 0;
                              const intensity = maxCount > 0 ? count / maxCount : 0;
                              const bg =
                                intensity === 0
                                  ? "bg-gray-100"
                                  : intensity < 0.25
                                    ? "bg-indigo-200"
                                    : intensity < 0.5
                                      ? "bg-indigo-400"
                                      : intensity < 0.75
                                        ? "bg-indigo-600"
                                        : "bg-indigo-700";
                              return (
                                <div
                                  key={hour}
                                  className={`flex-1 h-4 rounded-sm ${bg} min-w-[4px]`}
                                  title={`${label} ${hour}:00 — ${count} calls`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );})}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Messaging */}
          <div className="mb-10">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Messaging
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <MessageSquare className="w-5 h-5" />
                <span className="text-sm font-medium text-gray-700">SMS / MMS analytics</span>
              </div>
              <p className="text-sm text-gray-500">
                Messaging data is not yet available. When enabled, you will see message volume, unique conversations, and response metrics here.
              </p>
            </div>
          </div>

          {/* By User */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              By User
            </h2>
            {!stats?.userRows.length ? (
              <p className="text-sm text-gray-500 py-4">No user data for this period.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <DataTable
                  columns={userColumns}
                  data={stats.userRows}
                  searchPlaceholder="Search users..."
                  pageSize={15}
                />
              </div>
            )}
          </div>

          {/* By Department */}
          {stats?.deptRows && stats.deptRows.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                By Department
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <DataTable
                  columns={deptColumns}
                  data={stats.deptRows}
                  searchPlaceholder="Search departments..."
                  pageSize={10}
                />
              </div>
            </div>
          )}
        </>
      )}

      {analysisResult && (
        <AnalyzeModal
          analysis={analysisResult}
          dateLabel={`${dateLabel} · Company`}
          onClose={() => setAnalysisResult(null)}
        />
      )}
    </div>
  );
}
