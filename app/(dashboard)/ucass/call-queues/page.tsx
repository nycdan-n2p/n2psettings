"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchCallQueues } from "@/lib/api/call-queues";
import type { ColumnDef } from "@tanstack/react-table";

export default function CallQueuesPage() {
  const { bootstrap } = useApp();

  const { data: queues = [], isLoading } = useQuery({
    queryKey: ["call-queues"],
    queryFn: fetchCallQueues,
    enabled: !!bootstrap,
  });

  const columns: ColumnDef<{ id: string; name: string; extension?: string; agents_count?: number }>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "extension", header: "Extension" },
    { accessorKey: "agents_count", header: "Agents" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Call Queues</h1>
      <p className="text-gray-600 mb-6">
        Manage call queues and agent assignments.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={queues}
          searchPlaceholder="Search queues..."
        />
      )}
    </div>
  );
}
