"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchDevices } from "@/lib/api/devices";
import type { ColumnDef } from "@tanstack/react-table";

export default function DevicesPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices", accountId],
    queryFn: () => fetchDevices(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<{ macId: string; deviceType?: { name: string } }>[] = [
    { accessorKey: "macId", header: "MAC Address" },
    {
      accessorKey: "deviceType",
      header: "Type",
      cell: ({ row }) => row.original.deviceType?.name ?? "—",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Devices</h1>
      <p className="text-gray-600 mb-6">
        Manage provisioned phones and devices.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={devices}
          searchPlaceholder="Search devices..."
        />
      )}
    </div>
  );
}
