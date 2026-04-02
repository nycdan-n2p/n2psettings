"use client";

import { X, TrendingUp, TrendingDown, Phone, Clock, Mic, AlertTriangle } from "lucide-react";
import type { CallAnalysis } from "@/app/api/analyze-calls/route";

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtSec(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}

// ── mini bar (inline, no charting library needed) ────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

// ── summary markdown renderer (basic) ────────────────────────────────────────

/** Renders **bold** markers as React <strong> nodes — no HTML injection. */
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function SummaryText({ text }: { text: string }) {
  const lines = text.split("\n").filter(Boolean);
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h3 key={i} className="font-semibold text-gray-900">{line.slice(2)}</h3>;
        if (line.startsWith("## ")) return <h4 key={i} className="font-medium text-gray-800">{line.slice(3)}</h4>;
        if (line.startsWith("- ") || line.startsWith("• ") || line.match(/^\*\s/)) {
          const content = line.replace(/^[-•*]\s+/, "");
          return (
            <div key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-[#1a73e8] mt-0.5 shrink-0">•</span>
              <span>{renderBold(content)}</span>
            </div>
          );
        }
        return <p key={i} className="text-sm text-gray-700">{renderBold(line)}</p>;
      })}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-[#F6F6F9] rounded-[20px] p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-lg font-semibold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── main modal ───────────────────────────────────────────────────────────────
export function AnalyzeModal({
  analysis,
  dateLabel,
  onClose,
}: {
  analysis: CallAnalysis;
  dateLabel: string;
  onClose: () => void;
}) {
  const { kpis, topAgents, resultBreakdown, hourlyPattern, summary } = analysis;

  const maxHour = Math.max(...hourlyPattern.map((h) => h.calls), 1);
  const maxResult = Math.max(...resultBreakdown.map((r) => r.count), 1);
  const maxAgentTalk = Math.max(...topAgents.map((a) => a.talkTimeSec), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-[34px] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-t-[34px]">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Call Intelligence</h2>
            <p className="text-sm text-gray-500">{dateLabel} · {kpis.total} calls analyzed</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KpiCard label="Total Calls" value={kpis.total}
              sub={`${kpis.inbound} in · ${kpis.outbound} out`}
              icon={Phone} color="bg-blue-100 text-blue-600" />
            <KpiCard label="Answer Rate" value={`${kpis.answeredPct}%`}
              sub={`${kpis.missedPct}% missed`}
              icon={TrendingUp} color="bg-green-100 text-green-600" />
            <KpiCard label="Avg Duration" value={fmtSec(kpis.avgDurationSec)}
              sub={`Median: ${fmtSec(kpis.medianDurationSec)}`}
              icon={Clock} color="bg-purple-100 text-purple-600" />
            <KpiCard label="Total Talk Time" value={fmtSec(kpis.totalTalkSec)}
              sub={kpis.recordingCount > 0 ? `${kpis.recordingCount} recorded` : undefined}
              icon={Mic} color="bg-orange-100 text-orange-600" />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Voicemail", value: `${kpis.voicemailPct}%`, color: "text-yellow-600" },
              { label: "Blocked", value: `${kpis.blockedPct}%`, color: "text-red-500" },
              { label: "Peak Hour", value: `${kpis.peakHour}:00`, color: "text-[#1a73e8]" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#F6F6F9] rounded-[20px] py-3 px-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Two-column: result breakdown + hourly pattern */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Call result breakdown */}
            <div className="bg-[#F6F6F9] rounded-[20px] p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Result Breakdown</h3>
              <div className="space-y-2">
                {resultBreakdown.slice(0, 6).map(({ result, count }) => (
                  <div key={result} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-32 truncate">{result}</span>
                    <MiniBar value={count} max={maxResult} color="bg-[#1a73e8]" />
                    <span className="text-xs font-medium text-gray-700 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hourly call pattern */}
            <div className="bg-[#F6F6F9] rounded-[20px] p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Calls by Hour</h3>
              <div className="flex items-end gap-0.5 h-20">
                {hourlyPattern.map(({ hour, calls }) => (
                  <div key={hour} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={`w-full rounded-sm ${calls === Math.max(...hourlyPattern.map(h => h.calls)) ? "bg-[#1a73e8]" : "bg-blue-200"}`}
                      style={{ height: maxHour > 0 ? `${Math.round((calls / maxHour) * 100) * 0.75}%` : "2px", minHeight: calls > 0 ? "2px" : "0" }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">12am</span>
                <span className="text-xs text-gray-400">12pm</span>
                <span className="text-xs text-gray-400">11pm</span>
              </div>
            </div>
          </div>

          {/* Top agents */}
          {topAgents.length > 0 && (
            <div className="bg-[#F6F6F9] rounded-[20px] p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Agents by Talk Time</h3>
              <div className="space-y-2">
                {topAgents.slice(0, 7).map((agent) => (
                  <div key={agent.name} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-gray-700 truncate shrink-0">{agent.name}</div>
                    <MiniBar value={agent.talkTimeSec} max={maxAgentTalk} color="bg-purple-400" />
                    <div className="text-xs text-gray-500 w-14 shrink-0 text-right">{fmtSec(agent.talkTimeSec)}</div>
                    <div className="text-xs text-gray-400 w-16 shrink-0 text-right">{agent.callCount} calls</div>
                    {agent.missedPct > 20 && (
                      <span title={`${agent.missedPct}% missed`}>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Longest call */}
          {kpis.longestCall && (
            <div className="bg-[#F6F6F9] rounded-[20px] p-4 flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Longest Call</p>
                <p className="text-sm font-medium text-gray-900">
                  {fmtSec(kpis.longestCall.durationSec)} — {kpis.longestCall.from} → {kpis.longestCall.to}
                </p>
                <p className="text-xs text-gray-400">{new Date(kpis.longestCall.date).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Claude executive summary */}
          <div className="bg-[#F6F6F9] rounded-[20px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-[#1a73e8] flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Executive Summary</h3>
              <span className="text-xs text-gray-400 ml-auto">Claude AI · call-intel</span>
            </div>
            <SummaryText text={summary} />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white rounded-b-[34px] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-[#dadce0] rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
