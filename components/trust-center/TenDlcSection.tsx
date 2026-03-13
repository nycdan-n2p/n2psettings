"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import {
  fetchBrands,
  fetchCampaigns,
  fetchOptOutEntries,
  fetchVerticals,
  createBrand,
  updateBrand,
  deleteBrand,
  formatBrandType,
  type CampaignBrand,
  type CampaignCampaign,
  type OptOutEntry,
  type CreateBrandPayload,
} from "@/lib/api/10dlc";
import { qk } from "@/lib/query-keys";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Loader } from "@/components/ui/Loader";
import { MessageCircle, Search, Trash2, Pencil, Check, X } from "lucide-react";

type TabId = "brands" | "campaigns" | "optout";

function formatRegisteredDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const LEGAL_FORMS = [
  { value: "private_profit", label: "Privately Owned ($10 brand registration)" },
  { value: "sole_proprietor", label: "Sole Proprietor" },
  { value: "public_profit", label: "Publicly Traded Company" },
  { value: "non_profit", label: "Non-Profit Organization" },
  { value: "government", label: "Government" },
];

export function TenDlcSection() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("brands");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<CampaignBrand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampaignBrand | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<Partial<CreateBrandPayload>>({
    country_code: "US",
    ein: "",
    company_name: "",
    display_name: "",
    type: "private_profit",
    vertical_id: "",
    email: "",
    phone_number: "",
    street: "",
    city: "",
    state: "",
    postal_code: "",
    website: "",
  });

  const { data: brandsData, isLoading: brandsLoading } = useQuery({
    queryKey: qk.dlcBrands.all(),
    queryFn: () => fetchBrands(),
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: qk.dlcCampaigns.all(),
    queryFn: () => fetchCampaigns(),
    enabled: tab === "campaigns" || tab === "optout",
  });

  const { data: optOutData, isLoading: optOutLoading } = useQuery({
    queryKey: ["dlc-optout"],
    queryFn: () => fetchOptOutEntries(),
    enabled: tab === "optout",
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["dlc-verticals"],
    queryFn: () => fetchVerticals(),
    enabled: modalOpen,
  });

  const brands = brandsData?.items ?? [];
  const campaigns = campaignsData?.items ?? [];
  const optOutItems = optOutData?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (p: CreateBrandPayload) => createBrand(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.dlcBrands.all() });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateBrandPayload> }) =>
      updateBrand(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.dlcBrands.all() });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBrand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.dlcBrands.all() });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setEditingBrand(null);
    setStep(1);
    setForm({
      country_code: "US",
      ein: "",
      company_name: "",
      display_name: "",
      type: "private_profit",
      vertical_id: verticals[0]?.id ?? "",
      email: "",
      phone_number: "",
      street: "",
      city: "",
      state: "",
      postal_code: "",
      website: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (brand: CampaignBrand) => {
    setEditingBrand(brand);
    setStep(1);
    setForm({
      country_code: (brand as { country_code?: string }).country_code ?? "US",
      ein: brand.ein ?? "",
      company_name: brand.company_name ?? "",
      display_name: brand.display_name ?? "",
      type: brand.type ?? "private_profit",
      vertical_id: brand.vertical?.id ?? "",
      email: (brand as { email?: string }).email ?? "",
      phone_number: (brand as { phone_number?: string }).phone_number ?? "",
      street: (brand as { street?: string }).street ?? "",
      city: (brand as { city?: string }).city ?? "",
      state: (brand as { state?: string }).state ?? "",
      postal_code: (brand as { postal_code?: string }).postal_code ?? "",
      website: (brand as { website?: string }).website ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBrand(null);
    setStep(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    const payload: CreateBrandPayload = {
      country_code: form.country_code ?? "US",
      ein: form.ein ?? "",
      company_name: form.company_name ?? "",
      display_name: form.display_name ?? "",
      type: form.type ?? "private_profit",
      vertical_id: form.vertical_id ?? "",
      email: form.email,
      phone_number: form.phone_number,
      street: form.street,
      city: form.city,
      state: form.state,
      postal_code: form.postal_code,
      website: form.website,
    };
    if (editingBrand) {
      updateMutation.mutate({ id: editingBrand.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredBrands = search
    ? brands.filter(
        (b) =>
          b.id?.toLowerCase().includes(search.toLowerCase()) ||
          b.display_name?.toLowerCase().includes(search.toLowerCase()) ||
          b.company_name?.toLowerCase().includes(search.toLowerCase())
      )
    : brands;

  const brandColumns: ColumnDef<CampaignBrand>[] = [
    { accessorKey: "id", header: "BRAND" },
    { accessorKey: "display_name", header: "BRAND" },
    { accessorKey: "company_name", header: "LEGAL" },
    {
      id: "type",
      header: "TYPE",
      cell: ({ row }) => formatBrandType(row.original.type),
    },
    {
      id: "vertical",
      header: "VERTICAL",
      cell: ({ row }) => row.original.vertical?.display_name ?? "—",
    },
    {
      id: "status",
      header: "STATUS",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          {row.original.identity_status === "verified" ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              Verified
            </>
          ) : (
            row.original.identity_status ?? "—"
          )}
        </span>
      ),
    },
    {
      id: "registered",
      header: "REGISTERED",
      cell: ({ row }) => formatRegisteredDate(row.original.created_at_time),
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row.original)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const campaignColumns: ColumnDef<CampaignCampaign>[] = [
    {
      id: "brand",
      header: "BRAND",
      cell: ({ row }) => row.original.brand?.display_name ?? row.original.brand_id ?? "—",
    },
    { accessorKey: "id", header: "CAMPAIGN ID" },
    { accessorKey: "description", header: "DESCRIPTION" },
    {
      id: "status",
      header: "STATUS",
      cell: ({ row }) => row.original.status ?? "—",
    },
  ];

  const optOutColumns: ColumnDef<OptOutEntry>[] = [
    { accessorKey: "phone_number", header: "PHONE" },
    {
      id: "campaign",
      header: "CAMPAIGN",
      cell: ({ row }) => row.original.campaign?.id ?? "—",
    },
    { accessorKey: "status", header: "STATUS" },
    {
      id: "created",
      header: "OPTED OUT",
      cell: ({ row }) => formatRegisteredDate(row.original.created_at_time),
    },
  ];

  const tabs: { id: TabId; label: string }[] = [
    { id: "brands", label: "Brands" },
    { id: "campaigns", label: "Campaigns" },
    { id: "optout", label: "Opt Out List" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            />
          </div>
          {tab === "brands" && (
            <span className="text-sm text-gray-600 shrink-0">
              Total: {search ? filteredBrands.length : brands.length}
            </span>
          )}
        </div>
        {tab === "brands" && (
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium uppercase shrink-0"
          >
            Register Your Brand
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-[#1a73e8] text-[#1a73e8]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "brands" && (brandsLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading brands..." />
        </div>
      ) : (
        <DataTable
          columns={brandColumns}
          data={filteredBrands}
          searchKey={false}
          searchPlaceholder=""
        />
      ))}

      {tab === "campaigns" && (campaignsLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading campaigns..." />
        </div>
      ) : (
        <DataTable
          columns={campaignColumns}
          data={campaigns}
          searchKey={false}
          searchPlaceholder=""
        />
      ))}

      {tab === "optout" && (optOutLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading opt-out list..." />
        </div>
      ) : (
        <DataTable
          columns={optOutColumns}
          data={optOutItems}
          searchKey={false}
          searchPlaceholder=""
        />
      ))}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="New Brand Registration"
        size="lg"
        headerContent={
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-[#1a73e8]" />
              <h2 className="text-lg font-medium text-gray-900">
                {editingBrand ? "Edit Brand" : "New Brand Registration"}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span
                className={step === 1 ? "text-[#1a73e8] font-medium" : "text-gray-500"}
              >
                1 Basic Info
              </span>
              <span className="text-gray-300">|</span>
              <span
                className={step === 2 ? "text-[#1a73e8] font-medium" : "text-gray-500"}
              >
                2 Contact Info
              </span>
            </div>
            <button
              onClick={closeModal}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-6">
                Name & Tax ID
              </h3>
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
                <span className="text-amber-600 text-lg">!</span>
                <p className="text-sm text-amber-800">
                  Inaccurate or incomplete information may result in the rejection
                  of your registration. Please verify all your details before
                  submitting.
                </p>
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, country_code: "US" }))}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    form.country_code === "US"
                      ? "bg-[#1a73e8] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  USA
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, country_code: "OTHER" }))}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    form.country_code === "OTHER"
                      ? "bg-[#1a73e8] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Other countries
                </button>
              </div>
              <TextInput
                label="Tax ID / EIN"
                value={form.ein ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, ein: v }))}
                placeholder="9-digit number"
                required
                hint="Must be a 9-digit number"
              />
              <TextInput
                label="Legal company name"
                value={form.company_name ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, company_name: v }))}
                placeholder="Exact name on tax ID"
                required
                hint="Must be the exact name associated with the tax ID registered"
              />
              <TextInput
                label="DBA / Brand"
                value={form.display_name ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, display_name: v }))}
                placeholder="Doing business as"
                required
                hint="Any other names that the company does business as"
              />
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Legal form of incorporation <span className="text-red-500">Required</span>
                </label>
                <select
                  value={form.type ?? "private_profit"}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                  required
                >
                  {LEGAL_FORMS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vertical / Industry <span className="text-red-500">Required</span>
                </label>
                <select
                  value={form.vertical_id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, vertical_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                  required
                >
                  <option value="">Select...</option>
                  {verticals.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="text-base font-semibold text-gray-900 mb-6">
                Contact Info
              </h3>
              <TextInput
                label="Email"
                value={form.email ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                type="email"
                placeholder="contact@company.com"
              />
              <TextInput
                label="Phone"
                value={form.phone_number ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, phone_number: v }))}
                type="tel"
                placeholder="+1 555 000 0000"
              />
              <TextInput
                label="Street address"
                value={form.street ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, street: v }))}
                placeholder="123 Main St"
              />
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  label="City"
                  value={form.city ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  placeholder="City"
                />
                <TextInput
                  label="State"
                  value={form.state ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, state: v }))}
                  placeholder="State"
                />
              </div>
              <TextInput
                label="Postal code"
                value={form.postal_code ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, postal_code: v }))}
                placeholder="ZIP"
              />
              <TextInput
                label="Website"
                value={form.website ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, website: v }))}
                placeholder="https://"
              />
            </>
          )}
          <div className="flex justify-end gap-2 mt-6">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50 uppercase"
            >
              {step === 1
                ? "Next"
                : createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingBrand
                    ? "Save"
                    : "Submit"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Brand"
        message={`Remove brand ${deleteTarget?.display_name}? This cannot be undone.`}
      />
    </div>
  );
}
