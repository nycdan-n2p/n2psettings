"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchCallHistory, formatDuration, type CDR } from "@/lib/api/call-history";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import type { ColumnDef } from "@tanstack/react-table";

export default function CallHistoryPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? 0;
  const [cursor, setCursor] = useState<string | null>(null);

  const { data: callData, isLoading } = useQuery({
    queryKey: [...qk.callHistory.list(accountId, userId, ""), cursor],
    queryFn: () => fetchCallHistory(accountId, userId, { userId }, 50, cursor),
    enabled: !!accountId && !!userId,
  });

  const cdrs: CDR[] = callData?.cdrs ?? [];
  const nextCursor = callData?.nextCursor ?? null;
  const prevCursor = callData?.prevCursor ?? null;

  const columns: ColumnDef<CDR>[] = [
    {
      accessorKey: "callDate",
      header: "Date",
      cell: ({ row }) =>
        new Date(row.original.callDate).toLocaleString(),
      sortingFn: (rowA, rowB) =>
        new Date(rowA.original.callDate).getTime() -
        new Date(rowB.original.callDate).getTime(),
    },
    {
      id: "from",
      accessorFn: (row) => row.from?.callerId ?? row.from?.number ?? "",
      header: "From",
      cell: ({ row }) =>
        row.original.from?.callerId ?? row.original.from?.number ?? "—",
    },
    {
      id: "to",
      accessorFn: (row) => row.to?.userDisplayName ?? row.to?.number ?? "",
      header: "To",
      cell: ({ row }) =>
        row.original.to?.userDisplayName ?? row.original.to?.number ?? "—",
    },
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) =>
        row.original.direction === 0 ? "Inbound" : row.original.direction === 1 ? "Outbound" : "—",
    },
    { accessorKey: "callResult", header: "Result" },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => formatDuration(row.original.duration),
    },
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
        <div className="py-8 flex justify-center">
          <Loader variant="inline" label="Loading calls..." />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={cdrs}
            searchPlaceholder="Search calls..."
            initialSorting={[{ id: "callDate", desc: true }]}
          />
          {(prevCursor || nextCursor) && (
            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setCursor(prevCursor)}
                disabled={!prevCursor}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                onClick={() => setCursor(nextCursor)}
                disabled={!nextCursor}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
