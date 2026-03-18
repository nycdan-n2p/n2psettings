"use client";
import { useTranslations } from "next-intl";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import {
  fetchSIPTrunkAccounts,
  fetchSIPTrunks,
  fetchSIPLimits,
  fetchSIPServiceAddresses,
  fetchSIPPhoneNumbers,
} from "@/lib/api/sip-trunking";

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-base font-medium text-gray-900">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-sm text-gray-500">({count})</span>
          )}
        </h2>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-6 py-8 text-sm text-gray-500 text-center">{message}</div>
  );
}

function LimitsCard({ limits }: { limits: Record<string, unknown> }) {
  const t = useTranslations("sipTrunkingPage");
  const pairs = Object.entries(limits).filter(([, v]) => typeof v !== "object");
  if (pairs.length === 0) return null;
  return (
    <SectionCard title={t("channelLimits")}>
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {pairs.map(([key, val]) => (
          <div key={key} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              {key.replace(/_/g, " ")}
            </p>
            <p className="text-xl font-semibold text-gray-900">{String(val)}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SIPTrunkingPage() {
  const t = useTranslations("sipTrunkingPage");
  // Step 1: discover SIP trunk accounts (no account ID needed)
  const { data: sipAccounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: qk.sipAccounts.all(),
    queryFn: fetchSIPTrunkAccounts,
  });

  // Use the first SIP trunk account
  const sipAccount = sipAccounts[0];
  const clientId = sipAccount?.id ? String(sipAccount.id) : null;

  // Step 2: load sub-resources once we have a valid SIP trunk account ID
  const { data: trunks = [], isLoading: trunksLoading } = useQuery({
    queryKey: qk.sipTrunks.all(clientId ?? ""),
    queryFn: () => fetchSIPTrunks(clientId!),
    enabled: !!clientId,
  });

  const { data: limits, isLoading: limitsLoading } = useQuery({
    queryKey: qk.sipLimits.all(clientId ?? ""),
    queryFn: () => fetchSIPLimits(clientId!),
    enabled: !!clientId,
  });

  const { data: serviceAddresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: qk.sipAddresses.all(clientId ?? ""),
    queryFn: () => fetchSIPServiceAddresses(clientId!),
    enabled: !!clientId,
  });

  const { data: phoneNumbers = [], isLoading: numbersLoading } = useQuery({
    queryKey: qk.sipNumbers.all(clientId ?? ""),
    queryFn: () => fetchSIPPhoneNumbers(clientId!),
    enabled: !!clientId,
  });

  const isLoading =
    accountsLoading || trunksLoading || limitsLoading || addressesLoading || numbersLoading;

  // ── No SIP trunking on this account ────────────────────────────────────────
  if (!accountsLoading && sipAccounts.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-medium text-gray-900 mb-2">SIP Trunking</h1>
        <p className="text-gray-600 mb-8">{t("subtitle")}</p>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-gray-500 text-sm">
            No SIP trunk account found. Contact your administrator to enable SIP trunking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">SIP Trunking</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage SIP trunks, service addresses, and phone numbers.
          </p>
        </div>
        {sipAccount && (
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">SIP Account</p>
            <p className="text-sm font-medium text-gray-700">
              {sipAccount.name ? `${sipAccount.name} (${clientId})` : clientId}
            </p>
          </div>
        )}
      </div>

      {/* Multiple accounts selector */}
      {sipAccounts.length > 1 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Multiple SIP trunk accounts found. Showing account: {clientId}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Channel Limits */}
          {limits && Object.keys(limits).length > 0 && (
            <LimitsCard limits={limits as Record<string, unknown>} />
          )}

          {/* Trunks */}
          <SectionCard title={t("trunks")} count={trunks.length}>
            {trunks.length === 0 ? (
              <EmptyRow message={t("noTrunks")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {trunks.map((t, i) => (
                      <tr key={t.id ?? i} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-900">{t.name ?? "—"}</td>
                        <td className="px-6 py-3">
                          {t.status ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              t.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                            }`}>
                              {t.status}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-3 text-gray-500">{t.id ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Service Addresses */}
          <SectionCard title={t("serviceAddresses")} count={serviceAddresses.length}>
            {serviceAddresses.length === 0 ? (
              <EmptyRow message={t("noAddresses")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {serviceAddresses.map((sa, i) => (
                      <tr key={sa.id ?? i} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-900">{sa.address ?? "—"}</td>
                        <td className="px-6 py-3 text-gray-500">{sa.id ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Phone Numbers */}
          <SectionCard title={t("phoneNumbers")} count={phoneNumbers.length}>
            {phoneNumbers.length === 0 ? (
              <EmptyRow message={t("noPhoneNumbers")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {phoneNumbers.map((pn, i) => (
                      <tr key={pn.number ?? i} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-mono text-gray-900">{pn.number ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
