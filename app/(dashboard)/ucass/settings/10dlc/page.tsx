"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { fetchBrands, fetchCampaigns } from "@/lib/api/10dlc";
import { qk } from "@/lib/query-keys";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";

interface Brand {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

interface Campaign {
  id?: string;
  name?: string;
  brand_id?: string;
  [key: string]: unknown;
}

export default function TenDlcPage() {
  const [tab, setTab] = useState<"brands" | "campaigns">("brands");
  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState("");

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: qk.dlcBrands.all(),
    queryFn: () => fetchBrands(),
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: qk.dlcCampaigns.all(),
    queryFn: () => fetchCampaigns(),
  });

  const data = tab === "brands" ? brands : campaigns;
  const isLoading = tab === "brands" ? brandsLoading : campaignsLoading;

  const brandColumns: ColumnDef<Brand>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Name" },
  ];

  const campaignColumns: ColumnDef<Campaign>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "brand_id", header: "Brand ID" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">10DLC</h1>
      <p className="text-gray-600 mb-6">
        Campaign registry for SMS (brands and campaigns).
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("brands")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              tab === "brands"
                ? "bg-[#1a73e8] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Brands
          </button>
          <button
            onClick={() => setTab("campaigns")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              tab === "campaigns"
                ? "bg-[#1a73e8] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Campaigns
          </button>
        </div>
        <button
          onClick={() => {
            setFormName("");
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add {tab === "brands" ? "brand" : "campaign"}
        </button>
      </div>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <DataTable
          columns={tab === "brands" ? brandColumns : campaignColumns}
          data={data}
          searchPlaceholder={`Search ${tab}...`}
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Add ${tab === "brands" ? "brand" : "campaign"}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setModalOpen(false);
          }}
        >
          <TextInput
            label="Name"
            value={formName}
            onChange={setFormName}
            placeholder="Name"
            required
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
              Add
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
