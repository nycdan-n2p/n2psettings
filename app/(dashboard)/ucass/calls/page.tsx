"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Play, Pause, Download, RefreshCw, ChevronLeft, ChevronRight, Mic, BarChart2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import { VoicemailDetailModal } from "@/components/voicemail/VoicemailDetailModal";
import { DataTable } from "@/components/tables/DataTable";
import {
  fetchCallHistory,
  fetchRecordingUrl,
  markRecordingHeard,
  exportCallHistoryCsv,
  formatDuration,
  type CDR,
  type CallRecording,
} from "@/lib/api/call-history";
import { fetchVoicemails, type VoicemailItem } from "@/lib/api/voicemails";
import { AnalyzeModal } from "@/components/calls/AnalyzeModal";
import type { CallAnalysis } from "@/app/api/analyze-calls/route";
import type { ColumnDef } from "@tanstack/react-table";

type Tab = "all" | "voicemails" | "recordings";
type Scope = "mine" | "company";

// ── Inline audio player for a single recording ─────────────────────────────
function RecordingPlayer({
  recording,
  accountId,
  cdr,
}: {
  recording: CallRecording;
  accountId: number;
  cdr: CDR;
}) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(recording.status === "S");

  const { data: url, isFetching } = useQuery({
    queryKey: ["recording-url", recording.id],
    queryFn: () => fetchRecordingUrl(recording.id),
    // Only fetch when we have the recording id — kept in cache for 10 min
    staleTime: 10 * 60 * 1000,
    enabled: !!recording.id,
  });

  const markHeard = useMutation({
    mutationFn: () => markRecordingHeard(accountId, recording.id),
    onSuccess: () => {
      setHeard(true);
      // Invalidate call history so the "N" badge disappears
      queryClient.invalidateQueries({ queryKey: qk.callHistory.all(accountId) });
    },
  });

  const togglePlay = () => {
    if (!url || !audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
      if (!heard) markHeard.mutate();
    }
  };

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    const date = new Date(cdr.callDate).toISOString().split("T")[0];
    a.download = `recording-${date}-${recording.id}.mp3`;
    a.click();
  };

  return (
    <div className="flex items-center gap-3">
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
        />
      )}
      <button
        onClick={togglePlay}
        disabled={isFetching || !url}
        className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
        title={playing ? "Pause" : "Play"}
      >
        {isFetching ? (
          <Loader variant="button" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
        )}
      </button>
      <button
        onClick={handleDownload}
        disabled={!url}
        className="w-7 h-7 rounded-full text-gray-400 flex items-center justify-center hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Download recording"
      >
        <Download className="w-4 h-4" />
      </button>
      <span className="text-xs text-gray-400">{formatDuration(recording.duration)}</span>
      {!heard && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          New
        </span>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function CallsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? 0;
  const [tab, setTab] = useState<Tab>("all");
  const [scope, setScope] = useState<Scope>("mine");
  const [cursor, setCursor] = useState<string | null>(null);
  const [recCursor, setRecCursor] = useState<string | null>(null);
  const [selectedVoicemail, setSelectedVoicemail] = useState<VoicemailItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CallAnalysis | null>(null);

  const filter = scope === "mine" ? { userId } : {};

  // ── All calls ──
  const { data: callData, isLoading: callsLoading, refetch: refetchCalls } = useQuery({
    queryKey: [...qk.callHistory.list(accountId, scope === "mine" ? userId : null, ""), cursor],
    queryFn: () => fetchCallHistory(accountId, userId, filter, 50, cursor),
    enabled: !!accountId && !!userId && tab === "all",
  });
  const cdrs: CDR[] = callData?.cdrs ?? [];
  const nextCursor = callData?.nextCursor ?? null;
  const prevCursor = callData?.prevCursor ?? null;

  // ── Voicemails ──
  const { data: voicemailData, isLoading: voicemailsLoading } = useQuery({
    queryKey: qk.voicemails.all(accountId, userId),
    queryFn: () => fetchVoicemails(accountId, userId, "All", 50, "desc"),
    enabled: !!accountId && !!userId && tab === "voicemails",
  });
  const voicemails = voicemailData?.items ?? [];

  // ── Recordings — use onlyRecordings:true filter ──
  const { data: recData, isLoading: recsLoading, refetch: refetchRecs } = useQuery({
    queryKey: [...qk.callHistory.list(accountId, userId, "recordings"), recCursor],
    queryFn: () =>
      fetchCallHistory(
        accountId,
        userId,
        {
          userId: scope === "mine" ? userId : undefined,
          onlyRecordings: true,
          resultTypes: [
            "Call Answered",
            "Call Rejected",
            "Call Not Allowed",
            "Voicemail",
            "Call Blocked",
            "Call Cancelled",
            "Dropped",
            "Unanswered Queue",
          ],
        },
        50,
        recCursor
      ),
    enabled: !!accountId && !!userId && tab === "recordings",
  });
  const recCdrs: CDR[] = recData?.cdrs ?? [];
  const recNextCursor = recData?.nextCursor ?? null;
  const recPrevCursor = recData?.prevCursor ?? null;

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await exportCallHistoryCsv(accountId, userId, filter);
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
      const csv = [headers, ...rows]
        .map((r) => r.map((v) => `"${v ?? ""}"`).join(","))
        .join("\n");
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

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      // Fetch all calls (up to 200) for the current scope before analyzing
      const allData = await fetchCallHistory(accountId, userId, filter, 200, null);
      const res = await fetch("/api/analyze-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cdrs: allData.cdrs,
          scope,
          dateLabel: "Last 30 days",
        }),
      });
      if (!res.ok) throw new Error(`Analysis failed: ${res.status}`);
      const data: CallAnalysis = await res.json();
      setAnalysisResult(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
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
      cell: ({ row }) =>
        row.original.from?.callerId ?? row.original.from?.number ?? "—",
    },
    {
      id: "to",
      accessorFn: (row) => row.to?.userDisplayName ?? row.to?.number ?? "",
      header: "To",
      cell: ({ row }) =>
        row.original.to?.userDisplayName ?? row.original.to?.number ?? "—",
    },
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) =>
        row.original.direction === 0
          ? "Inbound"
          : row.original.direction === 1
          ? "Outbound"
          : "—",
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
      key={s}
      type="button"
      onClick={() => {
        setScope(s);
        setCursor(null);
        setRecCursor(null);
      }}
      className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-colors ${
        scope === s
          ? "bg-[#1a73e8] text-white border-[#1a73e8]"
          : "bg-white text-gray-700 border-[#dadce0] hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  const CursorNav = ({
    prev,
    next,
    onPrev,
    onNext,
  }: {
    prev: string | null;
    next: string | null;
    onPrev: () => void;
    onNext: () => void;
  }) =>
    prev || next ? (
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <button
          onClick={onPrev}
          disabled={!prev}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={onNext}
          disabled={!next}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    ) : null;

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
            onClick={() => {
              setCursor(null);
              setRecCursor(null);
              if (tab === "recordings") refetchRecs();
              else refetchCalls();
            }}
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
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !accountId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#1a73e8] border border-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            {analyzing ? "Analyzing…" : "Analyze Calls"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <Link
          href="/ucass/call-history"
          prefetch={false}
          className="text-sm text-[#1a73e8] hover:underline"
        >
          View full Call History →
        </Link>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-6">
          <button type="button" onClick={() => setTab("all")} className={tabClass("all")}>
            All Calls
          </button>
          <button type="button" onClick={() => setTab("voicemails")} className={tabClass("voicemails")}>
            Voicemails
          </button>
          <button type="button" onClick={() => setTab("recordings")} className={tabClass("recordings")}>
            Recordings
          </button>
        </nav>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* ── All Calls ── */}
        {tab === "all" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                {scope === "mine" ? "My Calls" : "Company Calls"} ({cdrs.length})
              </h2>
            </div>
            {callsLoading ? (
              <div className="px-6 py-12 flex justify-center">
                <Loader variant="inline" label="Loading calls..." />
              </div>
            ) : cdrs.length === 0 ? (
              <div className="px-6 py-8 text-gray-500">No calls found.</div>
            ) : (
              <div className="p-4">
                <DataTable
                  columns={callColumns}
                  data={cdrs}
                  searchPlaceholder="Search calls..."
                  initialSorting={[{ id: "callDate", desc: true }]}
                  pageSize={20}
                />
                <CursorNav
                  prev={prevCursor}
                  next={nextCursor}
                  onPrev={() => setCursor(prevCursor)}
                  onNext={() => setCursor(nextCursor)}
                />
              </div>
            )}
          </>
        )}

        {/* ── Voicemails ── */}
        {tab === "voicemails" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                Voicemails ({voicemails.length})
              </h2>
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
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-4 ${
                      vm.isRead === false ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0">
                      <Play className="w-5 h-5 text-[#1a73e8]" fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {vm.from?.callerId ?? vm.from?.number ?? "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {vm.callDate ? new Date(vm.callDate).toLocaleString() : "—"}
                        {vm.duration != null ? ` · ${formatDuration(vm.duration)}` : ""}
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

        {/* ── Recordings ── */}
        {tab === "recordings" && (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-900">
                Recordings ({recCdrs.length})
              </h2>
            </div>
            {recsLoading ? (
              <div className="px-6 py-12 flex justify-center">
                <Loader variant="inline" label="Loading recordings..." />
              </div>
            ) : recCdrs.length === 0 ? (
              <div className="px-6 py-8 flex flex-col items-center gap-2 text-gray-400">
                <Mic className="w-8 h-8" />
                <p className="text-sm">No recordings found.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recCdrs.map((cdr) =>
                  (cdr.recordings ?? []).map((rec) => (
                    <div
                      key={`${cdr.callId}-${rec.id}`}
                      className={`px-6 py-4 flex items-center gap-4 ${
                        rec.status === "N" ? "bg-blue-50/40" : ""
                      }`}
                    >
                      {/* Player */}
                      <RecordingPlayer
                        recording={rec}
                        accountId={accountId}
                        cdr={cdr}
                      />
                      {/* Call info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {cdr.from?.callerId ?? cdr.from?.number ?? "Unknown"}{" "}
                          <span className="font-normal text-gray-400">→</span>{" "}
                          {cdr.to?.userDisplayName ?? cdr.to?.number ?? "—"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(cdr.callDate).toLocaleString()} ·{" "}
                          {cdr.direction === 0 ? "Inbound" : "Outbound"} ·{" "}
                          {cdr.callResult}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div className="px-4 pb-4">
                  <CursorNav
                    prev={recPrevCursor}
                    next={recNextCursor}
                    onPrev={() => setRecCursor(recPrevCursor)}
                    onNext={() => setRecCursor(recNextCursor)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Analyze modal */}
      {analysisResult && (
        <AnalyzeModal
          analysis={analysisResult}
          dateLabel={`Last 30 days · ${scope === "mine" ? "My Calls" : "Company Calls"}`}
          onClose={() => setAnalysisResult(null)}
        />
      )}
    </div>
  );
}
