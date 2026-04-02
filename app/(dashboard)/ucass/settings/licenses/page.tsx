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
        <div className="bg-white rounded-3xl overflow-hidden">
          <table className="n2p-table w-full text-sm">
            <thead>
              <tr>
                <th>{t("colLicense")}</th>
                <th>{t("colCode")}</th>
                <th>{t("colQuantity")}</th>
                <th>{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic, i) => (
                <tr key={i}>
                  <td>{lic.name ?? "—"}</td>
                  <td className="font-mono text-xs">{lic.licenseCode ?? lic.code ?? "—"}</td>
                  <td>{lic.unlimited ? t("unlimited") : (lic.quantity ?? "—")}</td>
                  <td>
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
