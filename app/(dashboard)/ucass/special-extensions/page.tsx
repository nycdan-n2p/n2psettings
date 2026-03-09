"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchSpecialExtensions } from "@/lib/api/special-extensions";
import type { ColumnDef } from "@tanstack/react-table";

export default function SpecialExtensionsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const { data: extensions = [], isLoading } = useQuery({
    queryKey: ["special-extensions", accountId],
    queryFn: () => fetchSpecialExtensions(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<{ extension?: string; name?: string }>[] = [
    { accessorKey: "extension", header: "Extension" },
    { accessorKey: "name", header: "Name" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Special Extensions
      </h1>
      <p className="text-gray-600 mb-6">
        Manage special extension assignments.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={extensions}
          searchPlaceholder="Search extensions..."
        />
      )}
    </div>
  );
}
