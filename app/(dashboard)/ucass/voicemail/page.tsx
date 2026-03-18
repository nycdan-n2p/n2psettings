"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Play } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import { VoicemailDetailModal } from "@/components/voicemail/VoicemailDetailModal";
import { fetchVoicemails, type VoicemailItem } from "@/lib/api/voicemails";

export default function VoicemailPage() {
  const { bootstrap } = useApp();
  const { formatDateTime } = useLocaleFormat();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? 0;
  const [selectedVoicemail, setSelectedVoicemail] = useState<VoicemailItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: qk.voicemails.all(accountId, userId),
    queryFn: () => fetchVoicemails(accountId, userId, "All", 50, "desc"),
    enabled: !!accountId && !!userId,
  });

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">Voicemail</h1>
      <p className="text-gray-600 mb-6">
        Voicemail inbox and messages. You have {bootstrap?.unreadVoicemailCount ?? 0} unread.
      </p>

      <div className="mb-6 flex gap-4">
        <Link
          href="/ucass/settings/voicemail"
          className="text-[#1a73e8] hover:underline font-medium text-sm"
        >
          Voicemail settings →
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Inbox ({totalCount} messages)</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 flex justify-center">
            <Loader variant="inline" label="Loading voicemails..." />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-8 text-gray-500">No voicemails.</div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {items.map((vm, i) => (
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
                      {vm.callDate ? formatDateTime(vm.callDate) : "—"}
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
      </div>
    </div>
  );
}
