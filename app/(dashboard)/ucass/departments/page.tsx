"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchDepartments } from "@/lib/api/departments";
import type { ColumnDef } from "@tanstack/react-table";

export default function DepartmentsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments", accountId],
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<{ deptId: number; name: string; extension: string }>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "extension", header: "Extension" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Departments</h1>
      <p className="text-gray-600 mb-6">
        Manage department groups and extensions.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={departments}
          searchPlaceholder="Search departments..."
        />
      )}
    </div>
  );
}
