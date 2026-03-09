"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchCallHistory } from "@/lib/api/call-history";
import type { ColumnDef } from "@tanstack/react-table";

export default function CallHistoryPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? 0;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = now.toISOString();

  const { data: cdrs = [], isLoading } = useQuery({
    queryKey: ["call-history", accountId, userId],
    queryFn: () =>
      fetchCallHistory(
        accountId,
        userId,
        startDate.toISOString(),
        endDate
      ),
    enabled: !!accountId && !!userId,
  });

  const columns: ColumnDef<{
    callDate: string;
    callResult: string;
    duration: number;
    from?: { callerId?: string; number?: string };
    to?: { userDisplayName?: string; number?: string };
  }>[] = [
    {
      accessorKey: "callDate",
      header: "Date",
      cell: ({ row }) =>
        new Date(row.original.callDate).toLocaleString(),
    },
    {
      accessorKey: "from",
      header: "From",
      cell: ({ row }) =>
        row.original.from?.callerId ?? row.original.from?.number ?? "—",
    },
    {
      accessorKey: "to",
      header: "To",
      cell: ({ row }) =>
        row.original.to?.userDisplayName ?? row.original.to?.number ?? "—",
    },
    { accessorKey: "callResult", header: "Result" },
    { accessorKey: "duration", header: "Duration (s)" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Call History
      </h1>
      <p className="text-gray-600 mb-6">
        View call detail records and recordings.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={cdrs}
          searchPlaceholder="Search calls..."
        />
      )}
    </div>
  );
}
