"use client";

import { useApp } from "@/contexts/AppContext";
import Link from "next/link";

export default function CompanyPage() {
  const { bootstrap } = useApp();
  const account = bootstrap?.account;

  if (!account) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900 mb-6">Company</h1>
        <p className="text-gray-600">Loading company profile...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Company</h1>
      <p className="text-gray-600 mb-6">
        Company profile and account settings.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Account Overview</h2>
        </div>
        <dl className="divide-y divide-gray-200">
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Company</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
              {account.company || "—"}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Account ID</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
              {account.accountId}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Account Type</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
              {account.accountType || "—"}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Country</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
              {account.country || "—"}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Currency</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
              {account.currency || "—"}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Timezone</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
              {account.timeZone || "—"}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Limits</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
              <span className="text-gray-600">
                Users: {account.maxUsers ?? "—"} · Phones: {account.maxPhones ?? "—"} · Special Extensions: {account.maxSpecialExtensions ?? "—"}
              </span>
            </dd>
          </div>
          {account.accountPolicies && account.accountPolicies.length > 0 && (
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Policies</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2">
                <ul className="list-disc list-inside space-y-1">
                  {account.accountPolicies.map((p, i) => (
                    <li key={i}>
                      Max users per dept: {p.maxUsersDepartment} · Max departments: {p.maxDepartments} · Max extension length: {p.maxExtensionLength}
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
          Company Directory settings →
        </Link>
      </div>
    </div>
  );
}
