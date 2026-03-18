"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { fetchOnboards, type PortingOnboard } from "@/lib/api/porting";
import type { ColumnDef } from "@tanstack/react-table";
import { PortingWizard } from "@/components/porting/PortingWizard";
import { Loader } from "@/components/ui/Loader";

function getNumbersFromOnboard(o: PortingOnboard): string[] {
  const pn = o.phoneNumbersModel?.phoneNumbers;
  if (!Array.isArray(pn)) return [];
  return pn.map((n) => (typeof n === "string" ? n : n?.phoneNumber ?? "")).filter(Boolean);
}

export default function NumberPortingPage() {
  const t = useTranslations("numberPortingPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: onboardings = [], isLoading } = useQuery({
    queryKey: qk.porting.all(accountId),
    queryFn: () => fetchOnboards(accountId),
    enabled: !!accountId,
  });

  const columns: ColumnDef<PortingOnboard>[] = [
    { accessorKey: "id", header: "ID" },
    {
      id: "numbers",
      header: t("colNumbers"),
      cell: ({ row }) => {
        const nums = getNumbersFromOnboard(row.original);
        return nums.length > 0 ? nums.join(", ") : "—";
      },
    },
    { accessorKey: "status", header: t("colStatus") },
    {
      id: "targetDate",
      header: "Target Port Date",
      cell: ({ row }) => {
        const d = row.original.targetPortDate;
        return d ? new Date(d).toLocaleDateString() : "—";
      },
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Number Porting
      </h1>
      <p className="text-gray-600 mb-6">
        Port phone numbers from your current provider to net2phone. Use the wizard to list numbers, associate them with users, provide provider details, upload your invoice, and sign the Letter of Authorization.
      </p>
      <div className="mb-4">
        <button
          onClick={() => setWizardOpen(true)}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          New porting request
        </button>
      </div>
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader variant="inline" label={t("loading")} />
        </div>
      ) : onboardings.length > 0 ? (
        <DataTable
          columns={columns}
          data={onboardings}
          searchPlaceholder={t("search")}
        />
      ) : (
        <div className="border border-[#dadce0] rounded-lg bg-white p-6">
          <p className="text-sm text-gray-600">
            No porting requests yet. Click &quot;New porting request&quot; to start.
          </p>
        </div>
      )}

      <PortingWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={() => setWizardOpen(false)}
      />
    </div>
  );
}
