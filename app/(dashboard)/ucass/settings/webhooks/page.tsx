"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import {
  fetchWebhooks,
  fetchWebhookEventTypes,
} from "@/lib/api/webhooks";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";

interface Webhook {
  id?: number;
  url?: string;
  eventTypes?: string[];
}

export default function WebhooksPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? 0;
  const [modalOpen, setModalOpen] = useState(false);
  const [formUrl, setFormUrl] = useState("");

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: qk.webhooks.all(accountId, userId),
    queryFn: () => fetchWebhooks(accountId, userId),
    enabled: !!accountId && !!userId,
  });

  const { data: eventTypes = [] } = useQuery({
    queryKey: qk.webhooks.eventTypes(accountId, userId),
    queryFn: () => fetchWebhookEventTypes(accountId, userId),
    enabled: !!accountId && !!userId,
  });

  const columns: ColumnDef<Webhook>[] = [
    { accessorKey: "url", header: "URL" },
    {
      accessorKey: "eventTypes",
      header: "Events",
      cell: ({ row }) =>
        Array.isArray(row.original.eventTypes)
          ? row.original.eventTypes.join(", ")
          : "—",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Webhooks / API
      </h1>
      <p className="text-gray-600 mb-6">
        Configure webhook endpoints and API integrations.
      </p>
      <div className="mb-4">
        <button
          onClick={() => {
            setFormUrl("");
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add webhook
        </button>
      </div>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={columns}
          data={webhooks}
          searchPlaceholder="Search webhooks..."
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add webhook"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setModalOpen(false);
          }}
        >
          <TextInput
            label="Webhook URL"
            value={formUrl}
            onChange={setFormUrl}
            placeholder="https://example.com/webhook"
            required
          />
          {eventTypes.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event types
              </label>
              <div className="space-y-2 max-h-40 overflow-auto">
                {eventTypes.map((et) => (
                  <label key={et} className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">{et}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
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
              Add
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
