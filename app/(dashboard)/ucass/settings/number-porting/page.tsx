"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient, type V1Response } from "@/lib/api-client";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";

interface PortingRequest {
  id?: number;
  numbers?: string[];
  status?: string;
  [key: string]: unknown;
}

export default function NumberPortingPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const [modalOpen, setModalOpen] = useState(false);
  const [formNumbers, setFormNumbers] = useState("");
  const [formCarrier, setFormCarrier] = useState("");

  const { data: onboardings = [], isLoading } = useQuery({
    queryKey: qk.porting.all(accountId),
    queryFn: async () => {
      const api = await getApiClient();
      const res = await api.get<V1Response<PortingRequest[]>>(
        `/accounts/${accountId}/porting/onboards`
      );
      const data = res.data.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!accountId,
  });

  const columns: ColumnDef<PortingRequest>[] = [
    { accessorKey: "id", header: "ID" },
    {
      accessorKey: "numbers",
      header: "Numbers",
      cell: ({ row }) =>
        Array.isArray(row.original.numbers)
          ? row.original.numbers.join(", ")
          : "—",
    },
    { accessorKey: "status", header: "Status" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Number Porting
      </h1>
      <p className="text-gray-600 mb-6">
        Port phone numbers to your account.
      </p>
      <div className="mb-4">
        <button
          onClick={() => {
            setFormNumbers("");
            setFormCarrier("");
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          New porting request
        </button>
      </div>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : onboardings.length > 0 ? (
        <DataTable
          columns={columns}
          data={onboardings}
          searchPlaceholder="Search requests..."
        />
      ) : (
        <div className="border border-[#dadce0] rounded-lg bg-white p-6">
          <p className="text-sm text-gray-600">
            No porting requests yet. Click &quot;New porting request&quot; to
            start.
          </p>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New porting request"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setModalOpen(false);
          }}
        >
          <TextInput
            label="Phone numbers (comma-separated)"
            value={formNumbers}
            onChange={setFormNumbers}
            placeholder="e.g. 15551234567, 15559876543"
            required
          />
          <TextInput
            label="Current carrier"
            value={formCarrier}
            onChange={setFormCarrier}
            placeholder="Carrier name"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0]"
            >
              Submit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
