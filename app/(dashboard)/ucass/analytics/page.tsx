"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchAccountAnalytics,
  fetchUserAnalytics,
  fetchDepartmentAnalytics,
  lastNDays,
  type AnalyticsDateRange,
} from "@/lib/api/analytics";
import { DataTable } from "@/components/tables/DataTable";
import type { ColumnDef } from "@tanstack/react-table";

type Preset = "today" | "7d" | "30d" | "90d";

const PRESETS: { label: string; value: Preset }[] = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

function getRange(preset: Preset): AnalyticsDateRange {
  if (preset === "today") return lastNDays(1);
  if (preset === "7d") return lastNDays(7);
  if (preset === "30d") return lastNDays(30);
  return lastNDays(90);
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function AnalyticsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const [preset, setPreset] = useState<Preset>("7d");
  const range = getRange(preset);

  const { data: accountStats, isLoading: accountLoading } = useQuery({
    queryKey: qk.analytics.account(accountId, preset),
    queryFn: () => fetchAccountAnalytics(accountId, range),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: userRows = [], isLoading: usersLoading } = useQuery({
    queryKey: qk.analytics.users(accountId, preset),
    queryFn: () => fetchUserAnalytics(accountId, range, 0, 100),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: deptRows = [], isLoading: deptsLoading } = useQuery({
    queryKey: qk.analytics.depts(accountId, preset),
    queryFn: () => fetchDepartmentAnalytics(accountId, range, 0, 50),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  type UserRow = typeof userRows[number];
  type DeptRow = typeof deptRows[number];

  const userColumns: ColumnDef<UserRow>[] = [
    { id: "name", header: "User", accessorFn: (r) => r.name ?? "—" },
    { id: "total", header: "Total Calls", accessorFn: (r) => r.totalCalls ?? 0 },
    { id: "answered", header: "Answered", accessorFn: (r) => r.answeredCalls ?? 0 },
    { id: "missed", header: "Missed", accessorFn: (r) => r.missedCalls ?? 0 },
    { id: "avg", header: "Avg Duration", cell: ({ row }) => formatDuration(row.original.avgDuration as number | undefined) },
  ];

  const deptColumns: ColumnDef<DeptRow>[] = [
    { id: "name", header: "Department", accessorFn: (r) => r.name ?? "—" },
    { id: "total", header: "Total Calls", accessorFn: (r) => r.totalCalls ?? 0 },
    { id: "answered", header: "Answered", accessorFn: (r) => r.answeredCalls ?? 0 },
    { id: "missed", header: "Missed", accessorFn: (r) => r.missedCalls ?? 0 },
  ];

  const statItems = [
    { label: "Total Calls", value: accountStats?.totalCalls ?? "—" },
    { label: "Answered", value: accountStats?.answeredCalls ?? "—" },
    { label: "Missed", value: accountStats?.missedCalls ?? "—" },
    { label: "Avg Duration", value: formatDuration(accountStats?.avgDuration as number | undefined) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">{bootstrap?.account?.company ?? "Account"}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                preset === p.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Account totals */}
      {accountLoading ? (
        <div className="py-8 flex justify-center"><Loader variant="inline" label="Loading analytics..." /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statItems.map((s) => (
            <div key={s.label} className="bg-white rounded-lg border border-[#dadce0] p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-user breakdown */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">By User</h2>
        {usersLoading ? (
          <div className="py-6 flex justify-center"><Loader variant="inline" label="Loading user stats..." /></div>
        ) : userRows.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No user data available for this period.</p>
        ) : (
          <DataTable columns={userColumns} data={userRows} searchPlaceholder="Search users..." pageSize={15} />
        )}
      </div>

      {/* Per-department breakdown */}
      {deptRows.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">By Department</h2>
          {deptsLoading ? (
            <div className="py-6 flex justify-center"><Loader variant="inline" label="Loading dept stats..." /></div>
          ) : (
            <DataTable columns={deptColumns} data={deptRows} searchPlaceholder="Search departments..." pageSize={10} />
          )}
        </div>
      )}
    </div>
  );
}
