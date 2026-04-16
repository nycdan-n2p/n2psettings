"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Play, Pause, Download, RefreshCw, ChevronLeft, ChevronRight,
  Mic, BarChart2, PhoneIncoming, PhoneOutgoing, Phone, Voicemail,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
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
import { fetchVoicemails, fetchVoicemailAudioUrl, type VoicemailItem } from "@/lib/api/voicemails";
import { AnalyzeModal } from "@/components/calls/AnalyzeModal";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import type { CallAnalysis } from "@/app/api/analyze-calls/route";
import type { ColumnDef } from "@tanstack/react-table";

type Tab = "all" | "voicemails" | "recordings";
type Scope = "mine" | "company";

// ── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Stable color from string (for caller avatars)
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function callResultColor(result: string): string {
  const r = result.toLowerCase();
  if (r.includes("answered") && !r.includes("not") && !r.includes("un")) {
    return "bg-green-50 text-green-700 ring-green-200";
  }
  if (r.includes("not answered") || r.includes("missed") || r.includes("voicemail")) {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (r.includes("drop") || r.includes("reject") || r.includes("block") || r.includes("cancel")) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  return "bg-gray-50 text-gray-600 ring-gray-200";
}

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── VoicemailRow — Google-style, inline audio player ────────────────────────
function VoicemailRow({
  vm,
  accountId,
  userId,
  onExpand,
}: {
  vm: VoicemailItem;
  accountId: number;
  userId: number;
  onExpand: (vm: VoicemailItem) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(vm.duration ?? 0);
  const [unread, setUnread] = useState(vm.isRead === false);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.src = url;
    const onTime = () => { if (!seeking) setCurrentTime(audio.currentTime); };
    const onMeta = () => setAudioDuration(isFinite(audio.duration) ? audio.duration : vm.duration ?? 0);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [url, seeking, vm.duration]);

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    if (!url) {
      setLoadingUrl(true);
      const fetchedUrl = await fetchVoicemailAudioUrl(vm.voicemailId!, accountId, userId);
      setLoadingUrl(false);
      if (!fetchedUrl) return;
      setUrl(fetchedUrl);
      setUnread(false);
      // audio.src will be set by the effect above, then we play
      setTimeout(() => {
        audio.play().then(() => setPlaying(true)).catch(() => {});
      }, 50);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
      setUnread(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const val = Number(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const { formatRelativeDate } = useLocaleFormat();
  const callerName = vm.from?.callerId ?? vm.from?.name ?? vm.from?.number ?? "Unknown";
  const dateStr = vm.callDate ? formatRelativeDate(vm.callDate) : "—";

  const initials = getInitials(callerName);
  const colorClass = avatarColor(callerName);
  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div
      onClick={() => onExpand(vm)}
      className={`group relative flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-gray-50/80 ${
        unread ? "bg-blue-50/30" : ""
      }`}
    >
      {unread && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-[#1a73e8] rounded-r-full" />
      )}

      <audio ref={audioRef} preload="none" className="hidden" />

      {/* Caller avatar */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${colorClass}`}
      >
        {initials || <Voicemail className="w-4 h-4" />}
      </div>

      {/* Caller info */}
      <div className="w-44 shrink-0 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{callerName}</p>
        {vm.from?.number && vm.from.number !== callerName && (
          <p className="text-xs text-gray-400 truncate">{vm.from.number}</p>
        )}
      </div>

      {/* Audio player */}
      <div className="flex-1 flex items-center gap-2.5 min-w-0">
        <button
          onClick={handlePlay}
          disabled={loadingUrl}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
            loadingUrl
              ? "bg-gray-100 cursor-wait"
              : playing
              ? "bg-[#1a73e8] text-white shadow-md shadow-blue-200"
              : "bg-[#1a73e8] text-white hover:bg-[#1557b0] hover:shadow-md hover:shadow-blue-200"
          }`}
          title={playing ? "Pause" : "Play voicemail"}
        >
          {loadingUrl ? (
            <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : playing ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
          )}
        </button>

        <div className="flex-1 flex flex-col gap-0.5 min-w-0" onClick={(e) => e.stopPropagation()}>
          <div className="relative h-1.5">
            <div className="absolute inset-0 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a73e8] rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={audioDuration || 1}
              step={0.5}
              value={currentTime}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onChange={handleSeek}
              disabled={!url}
              className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default h-1.5"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-gray-400 tabular-nums">{fmtTime(currentTime)}</span>
            <span className="text-[10px] text-gray-400 tabular-nums">{fmtTime(audioDuration)}</span>
          </div>
        </div>
      </div>

      {/* Date */}
      <div className="w-40 shrink-0 text-right">
        <span className="text-xs text-gray-500">{dateStr}</span>
      </div>

      {/* Unread badge */}
      <div className="w-20 shrink-0 flex justify-end">
        {unread ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200">
            Unread
          </span>
        ) : (
          <span className="text-xs text-gray-300">Heard</span>
        )}
      </div>
    </div>
  );
}

// ── RecordingRow — Google-style card row ─────────────────────────────────────
function RecordingRow({
  recording,
  cdr,
  accountId,
}: {
  recording: CallRecording;
  cdr: CDR;
  accountId: number;
}) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(recording.status === "S");
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(recording.duration ?? 0);
  const [seeking, setSeeking] = useState(false);

  const { data: url, isFetching } = useQuery({
    queryKey: ["recording-url", recording.id],
    queryFn: () => fetchRecordingUrl(recording.id),
    staleTime: 10 * 60 * 1000,
    enabled: !!recording.id,
  });

  const markHeard = useMutation({
    mutationFn: () => markRecordingHeard(accountId, recording.id),
    onSuccess: () => {
      setHeard(true);
      queryClient.invalidateQueries({ queryKey: qk.callHistory.all(accountId) });
    },
  });

  // Bind audio events when URL loads
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.src = url;
    const onTime = () => { if (!seeking) setCurrentTime(audio.currentTime); };
    const onMeta = () => setAudioDuration(isFinite(audio.duration) ? audio.duration : recording.duration);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [url, seeking, recording.duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      if (!heard) markHeard.mutate();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const val = Number(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    const date = new Date(cdr.callDate).toISOString().split("T")[0];
    a.download = `recording-${date}-${recording.id}.mp3`;
    a.click();
  };

  const { formatRelativeDate } = useLocaleFormat();
  const callerName =
    cdr.from?.userDisplayName ?? cdr.from?.callerId ?? cdr.from?.number ?? "Unknown";
  const callerNumber = cdr.from?.number ?? cdr.from?.callerId ?? "";
  const destName =
    cdr.to?.userDisplayName ?? cdr.to?.callerId ?? cdr.to?.number ?? "—";
  const isInbound = cdr.direction === 0;
  const dateStr = formatRelativeDate(cdr.callDate);

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
  const initials = getInitials(callerName);
  const colorClass = avatarColor(callerName);

  return (
    <div
      className={`group relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/80 ${
        !heard ? "bg-blue-50/30" : ""
      }`}
    >
      {/* Unread indicator */}
      {!heard && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-[#1a73e8] rounded-r-full" />
      )}

      <audio ref={audioRef} preload="none" className="hidden" />

      {/* Caller avatar */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${colorClass}`}
      >
        {initials || <Phone className="w-4 h-4" />}
      </div>

      {/* Caller info */}
      <div className="w-44 shrink-0 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{callerName}</p>
        {callerNumber && callerNumber !== callerName && (
          <p className="text-xs text-gray-400 truncate">{callerNumber}</p>
        )}
      </div>

      {/* Direction arrow + destination */}
      <div className="w-40 shrink-0 flex items-center gap-1.5 min-w-0">
        {isInbound ? (
          <PhoneIncoming className="w-3.5 h-3.5 text-green-500 shrink-0" />
        ) : (
          <PhoneOutgoing className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        )}
        <span className="text-xs text-gray-500 truncate">{destName}</span>
      </div>

      {/* Audio player */}
      <div className="flex-1 flex items-center gap-2.5 min-w-0">
        {/* Play/pause button */}
        <button
          onClick={togglePlay}
          disabled={isFetching || !url}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
            isFetching
              ? "bg-gray-100 cursor-not-allowed"
              : playing
              ? "bg-[#1a73e8] text-white shadow-md shadow-blue-200"
              : "bg-[#1a73e8] text-white hover:bg-[#1557b0] hover:shadow-md hover:shadow-blue-200"
          }`}
          title={playing ? "Pause" : "Play"}
        >
          {isFetching ? (
            <Loader variant="button" />
          ) : playing ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
          )}
        </button>

        {/* Progress scrubber */}
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          <div className="relative h-1.5 group/scrub">
            <div className="absolute inset-0 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a73e8] rounded-full transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={audioDuration || 1}
              step={0.5}
              value={currentTime}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onChange={handleSeek}
              disabled={!url}
              className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default h-1.5"
              aria-label="Seek"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-gray-400 tabular-nums">
              {fmtTime(currentTime)}
            </span>
            <span className="text-[10px] text-gray-400 tabular-nums">
              {fmtTime(audioDuration)}
            </span>
          </div>
        </div>
      </div>

      {/* Date */}
      <div className="w-36 shrink-0 text-right">
        <span className="text-xs text-gray-500">{dateStr}</span>
      </div>

      {/* Result chip */}
      <div className="w-28 shrink-0 flex justify-end">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${callResultColor(
            cdr.callResult ?? ""
          )}`}
        >
          {cdr.callResult ?? "—"}
        </span>
      </div>

      {/* Download */}
      <button
        onClick={handleDownload}
        disabled={!url}
        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-0 transition-all opacity-0 group-hover:opacity-100"
        title="Download"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Recordings Tab ────────────────────────────────────────────────────────────
function RecordingsTab({
  accountId,
  userId,
  scope,
}: {
  accountId: number;
  userId: number;
  scope: Scope;
}) {
  const [cursor, setCursor] = useState<string | null>(null);

  const { data: recData, isLoading, refetch } = useQuery({
    queryKey: [...qk.callHistory.list(accountId, userId, "recordings"), cursor, scope],
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
        cursor
      ),
    enabled: !!accountId && !!userId,
  });

  const recCdrs: CDR[] = recData?.cdrs ?? [];
  const nextCursor = recData?.nextCursor ?? null;
  const prevCursor = recData?.prevCursor ?? null;

  // Count total recordings across CDRs
  const totalRecs = recCdrs.reduce((n, c) => n + (c.recordings?.length ?? 0), 0);

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader variant="inline" label="Loading recordings…" />
      </div>
    );
  }

  if (recCdrs.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
        <div className="w-14 h-14 rounded-full flex items-center justify-center">
          <Mic className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">No recordings found</p>
        <p className="text-xs text-gray-400">Recordings will appear here after calls are completed</p>
        <button
          onClick={() => refetch()}
          className="mt-1 text-xs text-[#1a73e8] hover:underline flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Column headers */}
      <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-100 bg-gray-50/60">
        <div className="w-10 shrink-0" /> {/* avatar */}
        <div className="w-44 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">
          Caller
        </div>
        <div className="w-40 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">
          To
        </div>
        <div className="flex-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
          Recording · {totalRecs} total
        </div>
        <div className="w-36 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">
          Date
        </div>
        <div className="w-28 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">
          Result
        </div>
        <div className="w-8 shrink-0" /> {/* download */}
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {recCdrs.map((cdr) =>
          (cdr.recordings ?? []).map((rec) => (
            <RecordingRow
              key={`${cdr.callId}-${rec.id}`}
              recording={rec}
              cdr={cdr}
              accountId={accountId}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {(prevCursor || nextCursor) && (
        <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100">
          <button
            onClick={() => setCursor(prevCursor)}
            disabled={!prevCursor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-[12px] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button
            onClick={() => setCursor(nextCursor)}
            disabled={!nextCursor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-[12px] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CallsPage() {
  const { bootstrap } = useApp();
  const { formatDateTime, formatRelativeDate } = useLocaleFormat();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId = bootstrap?.user?.userId ?? 0;
  const [tab, setTab] = useState<Tab>("all");
  const [scope, setScope] = useState<Scope>("mine");
  const [cursor, setCursor] = useState<string | null>(null);
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
        formatDateTime(c.callDate),
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
      cell: ({ row }) => formatRelativeDate(row.original.callDate),
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
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) =>
        row.original.direction === 0 ? "Inbound" : row.original.direction === 1 ? "Outbound" : "—",
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

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Call History</h1>
          <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedTabs
            value={scope}
            onChange={(next) => { setScope(next); setCursor(null); }}
            options={[
              { value: "mine", label: "Mine" },
              { value: "company", label: "Company" },
            ]}
          />
          <button
            onClick={() => { setCursor(null); refetchCalls(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-[12px] hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-[12px] hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !accountId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#1a73e8] border border-[#1a73e8] rounded-[12px] hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            {analyzing ? "Analyzing…" : "Analyze Calls"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <Link href="/ucass/call-history" prefetch={false} className="text-sm text-[#1a73e8] hover:underline">
          View full Call History →
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-0">
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

      <div className="bg-white rounded-b-xl overflow-hidden">

        {/* ── All Calls ── */}
        {tab === "all" && (
          <>
            <div className="py-4">
              <h2 className="text-base font-medium text-gray-900">
                {scope === "mine" ? "My Calls" : "Company Calls"}{" "}
                <span className="text-gray-400 font-normal">({cdrs.length})</span>
              </h2>
            </div>
            {callsLoading ? (
              <div className="py-12 flex justify-center">
                <Loader variant="inline" label="Loading calls…" />
              </div>
            ) : cdrs.length === 0 ? (
              <div className="py-8 text-gray-500 text-sm">No calls found.</div>
            ) : (
              <div className="p-0">
                <DataTable
                  columns={callColumns}
                  data={cdrs}
                  searchPlaceholder="Search calls…"
                  initialSorting={[{ id: "callDate", desc: true }]}
                  pageSize={20}
                  flush
                />
                {(prevCursor || nextCursor) && (
                  <div className="flex justify-between items-center pt-4">
                    <button onClick={() => setCursor(prevCursor)} disabled={!prevCursor}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-[12px] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <button onClick={() => setCursor(nextCursor)} disabled={!nextCursor}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-[#dadce0] rounded-[12px] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Voicemails ── */}
        {tab === "voicemails" && (
          <>
            {/* Column headers */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 bg-gray-50/60">
              <div className="w-10 shrink-0" />
              <div className="w-44 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">Caller</div>
              <div className="flex-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Voicemails · {voicemails.length} total
              </div>
              <div className="w-40 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Date</div>
              <div className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Status</div>
            </div>

            {voicemailsLoading ? (
              <div className="px-4 py-16 flex justify-center">
                <Loader variant="inline" label="Loading voicemails…" />
              </div>
            ) : voicemails.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
                <div className="w-14 h-14 rounded-full flex items-center justify-center">
                  <Voicemail className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">No voicemails</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {voicemails.map((vm, i) => (
                  <VoicemailRow
                    key={vm.voicemailId ?? i}
                    vm={vm}
                    accountId={accountId}
                    userId={userId}
                    onExpand={setSelectedVoicemail}
                  />
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
          <RecordingsTab accountId={accountId} userId={userId} scope={scope} />
        )}
      </div>

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
