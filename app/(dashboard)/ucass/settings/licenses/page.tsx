"use client";
import { useTranslations } from "next-intl";
import { useApp } from "@/contexts/AppContext";

export default function LicensesPage() {
  const t = useTranslations("licensesPage");
  const { bootstrap } = useApp();
  const licenses = bootstrap?.licenses ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>
      {licenses.length === 0 ? (
        <p className="text-sm text-gray-500">{t("noLicenses")}</p>
      ) : (
        <div className="bg-white rounded-lg border border-[#dadce0] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#f8f9fa]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t("colLicense")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t("colCode")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t("colQuantity")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic, i) => (
                <tr key={i} className="border-t border-[#dadce0]">
                  <td className="px-4 py-3 text-gray-900">{lic.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{lic.licenseCode ?? lic.code ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{lic.unlimited ? t("unlimited") : (lic.quantity ?? "—")}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{t("activeStatus")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-4">{t("contactNote")}</p>
    </div>
  );
}
