"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Play } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import { VoicemailDetailModal } from "@/components/voicemail/VoicemailDetailModal";
import { fetchCallHistory } from "@/lib/api/call-history";
import { fetchVoicemails, type VoicemailItem } from "@/lib/api/voicemails";

type Tab = "all" | "voicemails" | "recordings";

export default function CallsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? 0;
  const [tab, setTab] = useState<Tab>("all");
  const [selectedVoicemail, setSelectedVoicemail] = useState<VoicemailItem | null>(null);

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = now.toISOString();

  const { data: cdrs = [], isLoading: callsLoading } = useQuery({
    queryKey: ["call-summary", accountId, userId],
    queryFn: () =>
      fetchCallHistory(
        accountId,
        userId,
        startDate.toISOString(),
        endDate,
        0,
        50
      ),
    enabled: !!accountId && !!userId && tab === "all",
  });

  const { data: voicemailData, isLoading: voicemailsLoading } = useQuery({
    queryKey: ["voicemails", accountId, userId],
    queryFn: () => fetchVoicemails(accountId, userId, "All", 50, "desc"),
    enabled: !!accountId && !!userId && tab === "voicemails",
  });

  const voicemails = voicemailData?.items ?? [];

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Calls</h1>
      <p className="text-gray-600 mb-6">
        Call management and history. View recent calls, voicemails, and recordings.
      </p>

      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/ucass/call-history"
          className="inline-flex text-[#1a73e8] hover:underline font-medium text-sm"
        >
          View full Call History →
        </Link>
      </div>

      {/* Tabs: All Calls | Voicemails | Recordings */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-6" aria-label="Call tabs">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "all"
                ? "border-[#1a73e8] text-[#1a73e8]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            All Calls
          </button>
          <button
            type="button"
            onClick={() => setTab("voicemails")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "voicemails"
                ? "border-[#1a73e8] text-[#1a73e8]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Voicemails
          </button>
          <button
            type="button"
            onClick={() => setTab("recordings")}
            className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "recordings"
                ? "border-[#1a73e8] text-[#1a73e8]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Recordings
          </button>
        </nav>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {tab === "all" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Recent Calls (last 7 days)</h2>
            </div>
            {callsLoading ? (
              <div className="px-6 py-12 flex justify-center">
                <Loader variant="inline" label="Loading calls..." />
              </div>
            ) : cdrs.length === 0 ? (
              <div className="px-6 py-8 text-gray-500">No recent calls.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cdrs.map((c) => (
                      <tr key={c.callId}>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {new Date(c.callDate).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {c.from?.callerId ?? c.from?.number ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {c.to?.userDisplayName ?? c.to?.number ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900">{c.callResult}</td>
                        <td className="px-6 py-3 text-sm text-gray-900">{c.duration}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "voicemails" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                Voicemails ({voicemails.length})
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Click a voicemail to play and view transcript.
              </p>
            </div>
            {voicemailsLoading ? (
              <div className="px-6 py-12 flex justify-center">
                <Loader variant="inline" label="Loading voicemails..." />
              </div>
            ) : voicemails.length === 0 ? (
              <div className="px-6 py-8 text-gray-500">No voicemails.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {voicemails.map((vm, i) => (
                  <button
                    key={vm.voicemailId ?? i}
                    type="button"
                    onClick={() => setSelectedVoicemail(vm)}
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4 ${vm.isRead === false ? "bg-blue-50/50" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0">
                      <Play className="w-5 h-5 text-[#1a73e8]" fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {vm.from?.callerId ?? vm.from?.number ?? "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {vm.callDate
                          ? new Date(vm.callDate).toLocaleString()
                          : "—"}
                        {vm.duration != null ? ` · ${vm.duration}s` : ""}
                      </p>
                    </div>
                    {vm.isRead === false && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 shrink-0">
                        Unread
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedVoicemail && (
              <VoicemailDetailModal
                voicemail={selectedVoicemail}
                accountId={accountId}
                userId={userId}
                onClose={() => setSelectedVoicemail(null)}
              />
            )}
          </>
        )}

        {tab === "recordings" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Recordings</h2>
            </div>
            <div className="px-6 py-8 text-gray-500">
              Call recordings will appear here. Use Call History for detailed records.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
