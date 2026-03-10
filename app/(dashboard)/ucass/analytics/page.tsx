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
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchAnalyticsFromCallHistory,
  type DirectionFilter,
} from "@/lib/api/analytics-from-history";
import { DataTable } from "@/components/tables/DataTable";
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

function formatChartDate(dateStr: string, preset: Preset): string {
  const d = new Date(dateStr);
  return preset === "7d" ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? null;
  const [preset, setPreset] = useState<Preset>("7d");
  const [direction, setDirection] = useState<DirectionFilter>("all");

  const days = PRESETS.find((p) => p.value === preset)?.days ?? 7;

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

  const statCards = [
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
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center">
          <Loader variant="inline" label="Loading analytics..." />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
            {statCards.map((s) => (
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
    </div>
  );
}
