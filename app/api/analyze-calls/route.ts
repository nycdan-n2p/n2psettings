import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { CDR } from "@/lib/api/call-history";

// ── types returned to the client ────────────────────────────────────────────
export interface CallKPIs {
  total: number;
  inbound: number;
  outbound: number;
  answered: number;
  answeredPct: number;
  missedPct: number;
  voicemailPct: number;
  blockedPct: number;
  avgDurationSec: number;
  medianDurationSec: number;
  totalTalkSec: number;
  longestCall: { durationSec: number; from: string; to: string; date: string } | null;
  peakHour: number;
  recordingCount: number;
}

export interface AgentRow {
  name: string;
  talkTimeSec: number;
  callCount: number;
  missedCount: number;
  missedPct: number;
}

export interface HourBucket {
  hour: number;
  calls: number;
}

export interface ResultBucket {
  result: string;
  count: number;
}

export interface DayBucket {
  date: string;
  calls: number;
}

export interface CallAnalysis {
  kpis: CallKPIs;
  topAgents: AgentRow[];
  resultBreakdown: ResultBucket[];
  hourlyPattern: HourBucket[];
  dailyVolume: DayBucket[];
  summary: string; // Claude markdown
}

// ── pure KPI computation (runs server-side, no deps) ────────────────────────
function median(sorted: number[]): number {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeAnalysis(cdrs: CDR[]): Omit<CallAnalysis, "summary"> {
  const total = cdrs.length;
  if (total === 0) {
    return {
      kpis: {
        total: 0, inbound: 0, outbound: 0, answered: 0,
        answeredPct: 0, missedPct: 0, voicemailPct: 0, blockedPct: 0,
        avgDurationSec: 0, medianDurationSec: 0, totalTalkSec: 0,
        longestCall: null, peakHour: 0, recordingCount: 0,
      },
      topAgents: [],
      resultBreakdown: [],
      hourlyPattern: [],
      dailyVolume: [],
    };
  }

  const pct = (n: number) => Math.round((100 * n) / total * 10) / 10;
  const resultLower = (cdr: CDR) => (cdr.callResult ?? "").toLowerCase();

  let inbound = 0, outbound = 0, answered = 0, missed = 0, voicemail = 0, blocked = 0;
  let totalTalkSec = 0, longestSec = 0, longestCdr: CDR | null = null;
  let recordingCount = 0;

  // per-agent aggregation
  const agentMap = new Map<string, { talk: number; calls: number; missed: number }>();
  // hourly + daily
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<string, number> = {};
  // result breakdown
  const resultCounts: Record<string, number> = {};
  // duration list for median
  const durations: number[] = [];

  for (const cdr of cdrs) {
    const res = resultLower(cdr);
    if (cdr.direction === 0) inbound++; else outbound++;
    if (res.includes("answered") && !res.includes("not") && !res.includes("un")) answered++;
    if (res.includes("not answered") || res === "missed") missed++;
    if (res.includes("voicemail")) voicemail++;
    if (res.includes("blocked")) blocked++;
    if ((cdr.recordings?.length ?? 0) > 0) recordingCount++;

    const dur = cdr.duration ?? 0;
    totalTalkSec += dur;
    durations.push(dur);
    if (dur > longestSec) { longestSec = dur; longestCdr = cdr; }

    // agent = "to" display name (the user who handled it)
    const agent = cdr.to?.userDisplayName ?? cdr.to?.number ?? "Unknown";
    const ae = agentMap.get(agent) ?? { talk: 0, calls: 0, missed: 0 };
    ae.calls++;
    ae.talk += dur;
    if (res.includes("not answered") || res === "missed") ae.missed++;
    agentMap.set(agent, ae);

    // hourly
    const hour = new Date(cdr.callDate).getHours();
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;

    // daily (YYYY-MM-DD)
    const day = cdr.callDate.substring(0, 10);
    dayCounts[day] = (dayCounts[day] ?? 0) + 1;

    // result breakdown
    const bucket = cdr.callResult ?? "Unknown";
    resultCounts[bucket] = (resultCounts[bucket] ?? 0) + 1;
  }

  durations.sort((a, b) => a - b);
  const avgDurationSec = Math.round(totalTalkSec / total);
  const medianDurationSec = Math.round(median(durations));
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  const topAgents: AgentRow[] = Array.from(agentMap.entries())
    .map(([name, d]) => ({
      name,
      talkTimeSec: d.talk,
      callCount: d.calls,
      missedCount: d.missed,
      missedPct: Math.round((100 * d.missed) / d.calls * 10) / 10,
    }))
    .sort((a, b) => b.talkTimeSec - a.talkTimeSec)
    .slice(0, 10);

  const resultBreakdown: ResultBucket[] = Object.entries(resultCounts)
    .map(([result, count]) => ({ result, count }))
    .sort((a, b) => b.count - a.count);

  const hourlyPattern: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    calls: hourCounts[h] ?? 0,
  }));

  const dailyVolume: DayBucket[] = Object.entries(dayCounts)
    .map(([date, calls]) => ({ date, calls }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    kpis: {
      total, inbound, outbound, answered,
      answeredPct: pct(answered),
      missedPct: pct(missed),
      voicemailPct: pct(voicemail),
      blockedPct: pct(blocked),
      avgDurationSec,
      medianDurationSec,
      totalTalkSec,
      longestCall: longestCdr
        ? {
            durationSec: longestSec,
            from: longestCdr.from?.callerId ?? longestCdr.from?.number ?? "Unknown",
            to: longestCdr.to?.userDisplayName ?? longestCdr.to?.number ?? "Unknown",
            date: longestCdr.callDate,
          }
        : null,
      peakHour: Number(peakHour),
      recordingCount,
    },
    topAgents,
    resultBreakdown,
    hourlyPattern,
    dailyVolume,
  };
}

function fmtSec(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}

function buildKpiMarkdown(kpis: CallKPIs, agents: AgentRow[]): string {
  const topFive = agents.slice(0, 5);
  const agentRows = topFive
    .map((a) => `  • ${a.name}: ${fmtSec(a.talkTimeSec)} talk (${a.callCount} calls, ${a.missedPct}% missed)`)
    .join("\n");

  return `
CALL METRICS SUMMARY
====================
Total Calls: ${kpis.total}
Inbound: ${kpis.inbound} (${Math.round((kpis.inbound / kpis.total) * 100)}%)
Outbound: ${kpis.outbound} (${Math.round((kpis.outbound / kpis.total) * 100)}%)
Answered: ${kpis.answeredPct}%
Missed (Not Answered): ${kpis.missedPct}%
Voicemail: ${kpis.voicemailPct}%
Blocked: ${kpis.blockedPct}%
Avg Duration: ${fmtSec(kpis.avgDurationSec)}
Median Duration: ${fmtSec(kpis.medianDurationSec)}
Total Talk Time: ${fmtSec(kpis.totalTalkSec)}
Peak Hour: ${kpis.peakHour}:00–${kpis.peakHour + 1}:00
Recordings: ${kpis.recordingCount}
${kpis.longestCall ? `Longest Call: ${fmtSec(kpis.longestCall.durationSec)} (${kpis.longestCall.from} → ${kpis.longestCall.to})` : ""}

TOP AGENTS BY TALK TIME
=======================
${agentRows || "  No agent data"}
`.trim();
}

// ── route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { cdrs: CDR[]; scope?: string; dateLabel?: string };
    const { cdrs = [], scope = "mine", dateLabel = "Last 30 days" } = body;

    if (!Array.isArray(cdrs)) {
      return NextResponse.json({ error: "cdrs must be an array" }, { status: 400 });
    }

    // Compute KPIs synchronously
    const computed = computeAnalysis(cdrs);

    // Build KPI markdown for Claude
    const kpiMd = buildKpiMarkdown(computed.kpis, computed.topAgents);

    // Call Claude
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ...computed, summary: "⚠️ ANTHROPIC_API_KEY not set — summary not generated." },
        { status: 200 }
      );
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `You are Call-Intel, a data analyst for UCaaS (cloud phone system) administrators.

Analyze the following call center metrics for the period "${dateLabel}" (scope: ${scope}) and write a **six-bullet executive summary** with specific, actionable recommendations for the admin. Be direct and data-driven. Use markdown bullets.

${kpiMd}`,
        },
      ],
    });

    const summary =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ ...computed, summary });
  } catch (err) {
    console.error("[analyze-calls]", err);
    const msg = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
