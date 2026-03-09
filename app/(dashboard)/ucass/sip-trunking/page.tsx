"use client";

import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import {
  fetchSIPTrunks,
  fetchSIPLimits,
  fetchSIPServiceAddresses,
  fetchSIPPhoneNumbers,
} from "@/lib/api/sip-trunking";

export default function SIPTrunkingPage() {
  const { bootstrap } = useApp();
  const clientId = bootstrap?.account?.clientId ?? 36422;

  const { data: trunks = [], isLoading: trunksLoading } = useQuery({
    queryKey: ["sip-trunks", clientId],
    queryFn: () => fetchSIPTrunks(clientId),
    enabled: !!clientId,
  });

  const { data: limits, isLoading: limitsLoading } = useQuery({
    queryKey: ["sip-limits", clientId],
    queryFn: () => fetchSIPLimits(clientId),
    enabled: !!clientId,
  });

  const { data: serviceAddresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["sip-service-addresses", clientId],
    queryFn: () => fetchSIPServiceAddresses(clientId),
    enabled: !!clientId,
  });

  const { data: phoneNumbers = [], isLoading: numbersLoading } = useQuery({
    queryKey: ["sip-phone-numbers", clientId],
    queryFn: () => fetchSIPPhoneNumbers(clientId),
    enabled: !!clientId,
  });

  const isLoading =
    trunksLoading || limitsLoading || addressesLoading || numbersLoading;

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        SIP Trunking
      </h1>
      <p className="text-gray-600 mb-6">
        Manage SIP trunks, service addresses, and phone numbers (v2 API).
      </p>

      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Limits */}
          {limits && Object.keys(limits).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-900">Limits</h2>
              </div>
              <div className="px-6 py-4">
                <pre className="text-sm text-gray-700 overflow-x-auto">
                  {JSON.stringify(limits, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Trunks */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                Trunks ({trunks.length})
              </h2>
            </div>
            {trunks.length === 0 ? (
              <div className="px-6 py-8 text-gray-500">No trunks.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {trunks.map((t) => (
                      <tr key={t.id ?? t.name ?? JSON.stringify(t)}>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {t.name ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {t.status ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          {t.id ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Service Addresses */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                Service Addresses ({serviceAddresses.length})
              </h2>
            </div>
            {serviceAddresses.length === 0 ? (
              <div className="px-6 py-8 text-gray-500">No service addresses.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {serviceAddresses.map((sa) => (
                      <tr key={sa.id ?? sa.address ?? JSON.stringify(sa)}>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {sa.address ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          {sa.id ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Phone Numbers */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                Phone Numbers ({phoneNumbers.length})
              </h2>
            </div>
            {phoneNumbers.length === 0 ? (
              <div className="px-6 py-8 text-gray-500">No phone numbers.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Number
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {phoneNumbers.map((pn, i) => (
                      <tr key={pn.number ?? i}>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {pn.number ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-gray-500">Client ID: {clientId}</p>
    </div>
  );
}
