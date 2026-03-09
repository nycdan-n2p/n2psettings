"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchRingGroups } from "@/lib/api/ring-groups";
import type { ColumnDef } from "@tanstack/react-table";

export default function RingGroupsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["ring-groups", accountId],
    queryFn: () => fetchRingGroups(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<{ id: string | number; name: string; extension?: string }>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "extension", header: "Extension" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Ring Groups</h1>
      <p className="text-gray-600 mb-6">
        Manage call distribution and ring groups.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={groups}
          searchPlaceholder="Search ring groups..."
        />
      )}
    </div>
  );
}
