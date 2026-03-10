"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Play, Download, RefreshCw } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import { VoicemailDetailModal } from "@/components/voicemail/VoicemailDetailModal";
import { DataTable } from "@/components/tables/DataTable";
import { fetchCallHistory, exportCallHistoryCsv, formatDuration, type CDR } from "@/lib/api/call-history";
import { fetchVoicemails, type VoicemailItem } from "@/lib/api/voicemails";
import type { ColumnDef } from "@tanstack/react-table";

type Tab = "all" | "voicemails" | "recordings";
type Scope = "mine" | "company";

export default function CallsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? 0;
  const [tab, setTab] = useState<Tab>("all");
  const [scope, setScope] = useState<Scope>("mine");
  const [selectedVoicemail, setSelectedVoicemail] = useState<VoicemailItem | null>(null);
  const [exporting, setExporting] = useState(false);

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 30);
  const endDateStr = now.toISOString();
  const startDateStr = startDate.toISOString();

  const effectiveUserId = scope === "mine" ? userId : null;

  const { data: cdrs = [], isLoading: callsLoading, refetch: refetchCalls } = useQuery({
    queryKey: ["call-history", accountId, effectiveUserId, startDateStr],
    queryFn: () => fetchCallHistory(accountId, effectiveUserId, startDateStr, endDateStr, 0, 100),
    enabled: !!accountId && tab === "all",
  });

  const { data: voicemailData, isLoading: voicemailsLoading } = useQuery({
    queryKey: ["voicemails", accountId, userId],
    queryFn: () => fetchVoicemails(accountId, userId, "All", 50, "desc"),
    enabled: !!accountId && !!userId && tab === "voicemails",
  });

  const voicemails = voicemailData?.items ?? [];

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await exportCallHistoryCsv(accountId, effectiveUserId, startDateStr, endDateStr);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call-history-${scope}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const headers = ["Date", "From", "To", "Result", "Duration"];
      const rows = cdrs.map((c) => [
        new Date(c.callDate).toLocaleString(),
        c.from?.callerId ?? c.from?.number ?? "",
        c.to?.userDisplayName ?? c.to?.number ?? "",
        c.callResult,
        formatDuration(c.duration),
      ]);
      const csv = [headers, ...rows].map((r) => r.map((v) => `"${v ?? ""}"`).join(",")).join("\n");
      const csvBlob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call-history-${scope}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const callColumns: ColumnDef<CDR>[] = [
    {
      accessorKey: "callDate",
      header: "Date",
      cell: ({ row }) => {
        const d = new Date(row.original.callDate);
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      },
    },
    {
      id: "from",
      accessorFn: (row) => row.from?.callerId ?? row.from?.number ?? "",
      header: "From",
      cell: ({ row }) => row.original.from?.callerId ?? row.original.from?.number ?? "—",
    },
    {
      id: "to",
      accessorFn: (row) => row.to?.userDisplayName ?? row.to?.number ?? "",
      header: "To",
      cell: ({ row }) => row.original.to?.userDisplayName ?? row.original.to?.number ?? "—",
    },
    { accessorKey: "callResult", header: "Result" },
    {
      accessorKey: "duration",
      header: "Duration",
      cell: ({ row }) => formatDuration(row.original.duration),
    },
  ];

  const tabClass = (t: Tab) =>
    `pb-3 px-1 text-sm font-medium border-b-2 -mb-px transition-colors ${
      tab === t
        ? "border-[#1a73e8] text-[#1a73e8]"
        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
    }`;

  const scopeBtn = (s: Scope, label: string) => (
    <button
      type="button"
      onClick={() => setScope(s)}
      className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${
        scope === s
          ? "bg-[#1a73e8] text-white border-[#1a73e8]"
          : "bg-white text-gray-700 border-[#dadce0] hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Call History</h1>
          <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {scopeBtn("mine", "Mine")}
            {scopeBtn("company", "Company")}
          </div>
          <button
            onClick={() => refetchCalls()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <Link href="/ucass/call-history" prefetch={false} className="text-sm text-[#1a73e8] hover:underline">
          View full Call History →
        </Link>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-6">
          <button type="button" onClick={() => setTab("all")} className={tabClass("all")}>All Calls</button>
          <button type="button" onClick={() => setTab("voicemails")} className={tabClass("voicemails")}>Voicemails</button>
          <button type="button" onClick={() => setTab("recordings")} className={tabClass("recordings")}>Recordings</button>
        </nav>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {tab === "all" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                {scope === "mine" ? "My Calls" : "Company Calls"} ({cdrs.length})
              </h2>
            </div>
            {callsLoading ? (
              <div className="px-6 py-12 flex justify-center"><Loader variant="inline" label="Loading calls..." /></div>
            ) : cdrs.length === 0 ? (
              <div className="px-6 py-8 text-gray-500">No calls found.</div>
            ) : (
              <div className="p-4">
                <DataTable columns={callColumns} data={cdrs} searchPlaceholder="Search calls..." initialSorting={[{ id: "callDate", desc: true }]} pageSize={20} />
              </div>
            )}
          </>
        )}

        {tab === "voicemails" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Voicemails ({voicemails.length})</h2>
            </div>
            {voicemailsLoading ? (
              <div className="px-6 py-12 flex justify-center"><Loader variant="inline" label="Loading voicemails..." /></div>
            ) : voicemails.length === 0 ? (
              <div className="px-6 py-8 text-gray-500">No voicemails.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {voicemails.map((vm, i) => (
                  <button key={vm.voicemailId ?? i} type="button" onClick={() => setSelectedVoicemail(vm)}
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4 ${vm.isRead === false ? "bg-blue-50/50" : ""}`}>
                    <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0">
                      <Play className="w-5 h-5 text-[#1a73e8]" fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{vm.from?.callerId ?? vm.from?.number ?? "Unknown"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{vm.callDate ? new Date(vm.callDate).toLocaleString() : "—"}{vm.duration != null ? ` · ${formatDuration(vm.duration)}` : ""}</p>
                    </div>
                    {vm.isRead === false && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 shrink-0">Unread</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedVoicemail && <VoicemailDetailModal voicemail={selectedVoicemail} accountId={accountId} userId={userId} onClose={() => setSelectedVoicemail(null)} />}
          </>
        )}

        {tab === "recordings" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">Recordings</h2>
            </div>
            <div className="px-6 py-8 text-gray-500">Call recordings will appear here.</div>
          </>
        )}
      </div>
    </div>
  );
}
