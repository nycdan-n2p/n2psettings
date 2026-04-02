"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { fetchBulkLoad } from "@/lib/api/bulk-load";
import { SettingsGroup } from "@/components/settings/SettingsGroup";

export default function BulkOperationsPage() {
  const t = useTranslations("bulkOperationsPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: bulkData, isLoading } = useQuery({
    queryKey: qk.bulkOps.all(accountId),
    queryFn: () => fetchBulkLoad(accountId),
    enabled: !!accountId,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      // TODO: Wire to bulk upload API when POST endpoint is documented
      await new Promise((r) => setTimeout(r, 1000));
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const items = bulkData?.items;
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Bulk Operations
      </h1>
      <p className="text-gray-600 mb-6">
        Bulk import and load operations.
      </p>

      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Bulk load data */}
          {bulkData && (hasItems || Object.keys(bulkData).length > 1) && (
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-900">
                  Bulk Load Status
                </h2>
              </div>
              <div className="px-6 py-4">
                {hasItems ? (
                  <div className="overflow-x-auto">
                    <table className="n2p-table min-w-full">
                      <thead>
                        <tr>
                          <th>
                            Name
                          </th>
                          <th>
                            Status
                          </th>
                          <th>
                            ID
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id ?? item.name ?? JSON.stringify(item)}>
                            <td>
                              {item.name ?? "—"}
                            </td>
                            <td>
                              {item.status ?? "—"}
                            </td>
                            <td>
                              {item.id ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="text-sm text-gray-700 overflow-x-auto">
                    {JSON.stringify(bulkData, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          <SettingsGroup
            title={t("importTitle")}
            description={t("importDesc")}
          >
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload file
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#1a73e8] file:text-white file:cursor-pointer hover:file:bg-[#1557b0]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50"
                >
                  {uploading ? t("uploading") : t("upload")}
                </button>
              </div>
            </form>
          </SettingsGroup>

          <SettingsGroup
            title={t("templateTitle")}
            description={t("templateDesc")}
          >
            <a
              href="#"
              className="text-[#1a73e8] hover:underline font-medium text-sm"
            >
              Download CSV template
            </a>
          </SettingsGroup>
        </>
      )}
    </div>
  );
}
