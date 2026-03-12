import { fetchCallHistory } from "./call-history";
import type { CDR } from "./call-history";

export type DirectionFilter = "all" | "inbound" | "outbound";

export interface AnalyticsFromHistory {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  voicemailCalls: number;
  avgDurationSec: number;
  answerRatePct: number;
  missedRatePct: number;
  peakHour: number;
  recordingCount: number;
  dailyVolume: { date: string; calls: number; answered: number; missed: number }[];
  userRows: { name: string; totalCalls: number; answeredCalls: number; missedCalls: number; avgDurationSec: number }[];
  deptRows: { name: string; totalCalls: number; answeredCalls: number; missedCalls: number }[];
  /** Busy times: [dayOfWeek 0-6][hour 0-23] = call count */
  busyTimesGrid: number[][];
}

function getDateRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function isInRange(callDate: string, start: Date, end: Date): boolean {
  const d = new Date(callDate).getTime();
  return d >= start.getTime() && d <= end.getTime();
}

function resultLower(cdr: CDR): string {
  return (cdr.callResult ?? "").toLowerCase();
}

function isAnswered(res: string): boolean {
  return res.includes("answered") && !res.includes("not") && !res.includes("un");
}

function isMissed(res: string): boolean {
  return res.includes("not answered") || res === "missed";
}

function isVoicemail(res: string): boolean {
  return res.includes("voicemail");
}

/** Fetch and aggregate analytics from call history. Company-wide scope. */
export async function fetchAnalyticsFromCallHistory(
  accountId: number,
  currentUserId: number | null,
  direction: DirectionFilter,
  days: number
): Promise<AnalyticsFromHistory> {
  const { start, end } = getDateRange(days);
  const directionNum =
    direction === "inbound" ? 0 : direction === "outbound" ? 1 : null;

  const res = await fetchCallHistory(
    accountId,
    currentUserId,
    { direction: directionNum },
    1000,
    null
  );

  const cdrs = (res.cdrs ?? []).filter((c) => isInRange(c.callDate, start, end));

  const dayMap = new Map<
    string,
    { calls: number; answered: number; missed: number }
  >();
  const userMap = new Map<
    string,
    { total: number; answered: number; missed: number; duration: number }
  >();
  const deptMap = new Map<
    string,
    { total: number; answered: number; missed: number }
  >();
  const hourCounts: Record<number, number> = {};
  const busyTimesMap: Record<string, number> = {};

  let totalDuration = 0;
  let recordingCount = 0;

  for (const cdr of cdrs) {
    const res = resultLower(cdr);
    const answered = isAnswered(res);
    const missed = isMissed(res);

    const day = cdr.callDate.substring(0, 10);
    const d = dayMap.get(day) ?? { calls: 0, answered: 0, missed: 0 };
    d.calls++;
    if (answered) d.answered++;
    if (missed) d.missed++;
    dayMap.set(day, d);

    const agent = cdr.to?.userDisplayName ?? cdr.to?.number ?? "Unknown";
    const u = userMap.get(agent) ?? { total: 0, answered: 0, missed: 0, duration: 0 };
    u.total++;
    if (answered) u.answered++;
    if (missed) u.missed++;
    u.duration += cdr.duration ?? 0;
    userMap.set(agent, u);

    const dept =
      cdr.to?.departmentDisplayName ??
      cdr.from?.departmentDisplayName ??
      "—";
    const dep = deptMap.get(dept) ?? { total: 0, answered: 0, missed: 0 };
    dep.total++;
    if (answered) dep.answered++;
    if (missed) dep.missed++;
    deptMap.set(dept, dep);

    const callDate = new Date(cdr.callDate);
    const hour = callDate.getHours();
    const dayOfWeek = callDate.getDay();
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
    const key = `${dayOfWeek}-${hour}`;
    busyTimesMap[key] = (busyTimesMap[key] ?? 0) + 1;

    totalDuration += cdr.duration ?? 0;
    if ((cdr.recordings?.length ?? 0) > 0) recordingCount++;
  }

  const totalCalls = cdrs.length;
  const answeredCalls = cdrs.filter((c) => isAnswered(resultLower(c))).length;
  const missedCalls = cdrs.filter((c) => isMissed(resultLower(c))).length;
  const voicemailCalls = cdrs.filter((c) => isVoicemail(resultLower(c))).length;

  const dailyVolume = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const userRows = Array.from(userMap.entries())
    .map(([name, u]) => ({
      name,
      totalCalls: u.total,
      answeredCalls: u.answered,
      missedCalls: u.missed,
      avgDurationSec: u.total ? Math.round(u.duration / u.total) : 0,
    }))
    .sort((a, b) => b.totalCalls - a.totalCalls);

  const deptRows = Array.from(deptMap.entries())
    .map(([name, d]) => ({
      name,
      totalCalls: d.total,
      answeredCalls: d.answered,
      missedCalls: d.missed,
    }))
    .filter((r) => r.name !== "—")
    .sort((a, b) => b.totalCalls - a.totalCalls);

  const peakHour =
    Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  const busyTimesGrid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );
  for (const [key, count] of Object.entries(busyTimesMap)) {
    const [d, h] = key.split("-").map(Number);
    busyTimesGrid[d][h] = count;
  }

  return {
    totalCalls,
    answeredCalls,
    missedCalls,
    voicemailCalls,
    avgDurationSec: totalCalls ? Math.round(totalDuration / totalCalls) : 0,
    answerRatePct: totalCalls ? Math.round((1000 * answeredCalls) / totalCalls) / 10 : 0,
    missedRatePct: totalCalls ? Math.round((1000 * missedCalls) / totalCalls) / 10 : 0,
    peakHour: Number(peakHour),
    recordingCount,
    dailyVolume,
    userRows,
    deptRows,
    busyTimesGrid,
  };
}
