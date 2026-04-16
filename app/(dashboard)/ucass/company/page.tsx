"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/contexts/AppContext";
import Link from "next/link";

export default function CompanyPage() {
  const { bootstrap } = useApp();
  const account = bootstrap?.account;
  const t = useTranslations("company");

  if (!account) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900 mb-6">{t("title")}</h1>
        <p className="text-gray-600">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">{t("title")}</h1>
      <p className="text-gray-600 mb-6">{t("subtitle")}</p>

      <div className="bg-[#F9F9FB] rounded-3xl overflow-hidden">
        <div className="px-6 py-4 bg-[#F9F9FB]">
          <h2 className="text-lg font-medium text-gray-900">{t("accountOverview")}</h2>
        </div>
        <dl>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">{t("fieldCompany")}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{account.company || "—"}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">{t("fieldAccountId")}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{account.accountId}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">{t("fieldAccountType")}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{account.accountType || "—"}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">{t("fieldCountry")}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{account.country || "—"}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">{t("fieldCurrency")}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{account.currency || "—"}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">{t("fieldTimezone")}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">{account.timeZone || "—"}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">{t("fieldLimits")}</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
              <span className="text-gray-600">
                {t("limitsUsers")}: {account.maxUsers ?? "—"} · {t("limitsPhones")}: {account.maxPhones ?? "—"} · {t("limitsSpecialExt")}: {account.maxSpecialExtensions ?? "—"}
              </span>
            </dd>
          </div>
          {account.accountPolicies && account.accountPolicies.length > 0 && (
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">{t("fieldPolicies")}</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                <ul className="list-disc list-inside space-y-1">
                  {account.accountPolicies.map((p, i) => (
                    <li key={i}>
                      {t("policyMaxUsers")}: {p.maxUsersDepartment} · {t("policyMaxDepts")}: {p.maxDepartments} · {t("policyMaxExtLen")}: {p.maxExtensionLength}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6">
        <Link
          href="/ucass/settings/company-directory"
          className="text-[#1a73e8] hover:underline font-medium text-sm"
        >
          {t("directoryLink")}
        </Link>
      </div>
    </div>
  );
}
