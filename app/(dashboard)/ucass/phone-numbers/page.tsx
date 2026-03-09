"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { fetchPhoneNumbers } from "@/lib/api/phone-numbers";
import type { ColumnDef } from "@tanstack/react-table";

export default function PhoneNumbersPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ["phone-numbers", accountId],
    queryFn: () => fetchPhoneNumbers(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<{ phoneNumber: string; extension?: string }>[] = [
    { accessorKey: "phoneNumber", header: "Number" },
    { accessorKey: "extension", header: "Extension" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Phone Numbers
      </h1>
      <p className="text-gray-600 mb-6">
        Manage DIDs and number assignments.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={numbers}
          searchPlaceholder="Search numbers..."
        />
      )}
    </div>
  );
}
