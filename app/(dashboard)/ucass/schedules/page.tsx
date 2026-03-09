"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchSchedules } from "@/lib/api/schedules";
import type { ColumnDef } from "@tanstack/react-table";

export default function SchedulesPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["schedules", accountId],
    queryFn: () => fetchSchedules(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<{ id: number; name: string; type?: string }>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "type", header: "Type" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Schedules</h1>
      <p className="text-gray-600 mb-6">
        Manage business hours and schedule rules.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={schedules}
          searchPlaceholder="Search schedules..."
        />
      )}
    </div>
  );
}
