"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchVirtualAssistants } from "@/lib/api/virtual-assistant";
import type { ColumnDef } from "@tanstack/react-table";

export default function VirtualAssistantPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const { data: menus = [], isLoading } = useQuery({
    queryKey: ["virtual-assistant", accountId],
    queryFn: () => fetchVirtualAssistants(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<{ id: number; name: string; extension?: string }>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "extension", header: "Extension" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Virtual Assistant
      </h1>
      <p className="text-gray-600 mb-6">
        Manage welcome menus and auto-attendants.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={menus}
          searchPlaceholder="Search menus..."
        />
      )}
    </div>
  );
}
