import { getApiClient } from "../api-client";

export interface AnalyticsSummary {
  totalCalls?: number;
  answeredCalls?: number;
  missedCalls?: number;
  avgDuration?: number;
  [key: string]: unknown;
}

export interface AnalyticsUserRow {
  userId?: number;
  name?: string;
  totalCalls?: number;
  answeredCalls?: number;
  missedCalls?: number;
  avgDuration?: number;
  [key: string]: unknown;
}

export interface AnalyticsDeptRow {
  deptId?: number;
  name?: string;
  totalCalls?: number;
  answeredCalls?: number;
  missedCalls?: number;
  [key: string]: unknown;
}

export interface AnalyticsDateRange {
  startDate: string; // ISO string
  endDate: string;   // ISO string
  interval?: number; // 0 = hourly, 1 = daily
}

/** Account-level totals for the date range */
export async function fetchAccountAnalytics(
  accountId: number,
  range: AnalyticsDateRange
): Promise<AnalyticsSummary> {
  const api = await getApiClient();
  const res = await api.get<{ data?: AnalyticsSummary } | AnalyticsSummary>(
    `/analytics/accounts/${accountId}`,
    {
      params: {
        startDate: range.startDate,
        endDate: range.endDate,
        interval: range.interval ?? 0,
      },
    }
  );
  const d = res.data as { data?: AnalyticsSummary };
  return (d?.data ?? res.data ?? {}) as AnalyticsSummary;
}

/** Per-user analytics for the date range */
export async function fetchUserAnalytics(
  accountId: number,
  range: AnalyticsDateRange,
  skip = 0,
  take = 20
): Promise<AnalyticsUserRow[]> {
  const api = await getApiClient();
  const res = await api.get<{ data?: AnalyticsUserRow[] } | AnalyticsUserRow[]>(
    `/analytics/accounts/${accountId}/users`,
    {
      params: {
        startDate: range.startDate,
        endDate: range.endDate,
        skip,
        take,
      },
    }
  );
  const d = res.data as { data?: AnalyticsUserRow[] };
  const items = d?.data ?? (Array.isArray(res.data) ? res.data : []);
  return Array.isArray(items) ? items : [];
}

/** Summary totals for users */
export async function fetchUserAnalyticsSummary(
  accountId: number,
  range: AnalyticsDateRange
): Promise<AnalyticsSummary> {
  const api = await getApiClient();
  const res = await api.get(
    `/analytics/accounts/${accountId}/users/summary`,
    { params: { startDate: range.startDate, endDate: range.endDate } }
  );
  const d = res.data as { data?: AnalyticsSummary };
  return (d?.data ?? {}) as AnalyticsSummary;
}

/** Per-department analytics */
export async function fetchDepartmentAnalytics(
  accountId: number,
  range: AnalyticsDateRange,
  skip = 0,
  take = 20
): Promise<AnalyticsDeptRow[]> {
  const api = await getApiClient();
  const res = await api.get(
    `/analytics/accounts/${accountId}/departments`,
    {
      params: {
        startDate: range.startDate,
        endDate: range.endDate,
        skip,
        take,
      },
    }
  );
  const d = res.data as { data?: AnalyticsDeptRow[] };
  const items = d?.data ?? (Array.isArray(res.data) ? res.data : []);
  return Array.isArray(items) ? items : [];
}

/** Summary totals for departments */
export async function fetchDepartmentAnalyticsSummary(
  accountId: number,
  range: AnalyticsDateRange
): Promise<AnalyticsSummary> {
  const api = await getApiClient();
  const res = await api.get(
    `/analytics/accounts/${accountId}/departments/summary`,
    { params: { startDate: range.startDate, endDate: range.endDate } }
  );
  const d = res.data as { data?: AnalyticsSummary };
  return (d?.data ?? {}) as AnalyticsSummary;
}

/** Helper: build a date range for the last N days */
export function lastNDays(n: number): AnalyticsDateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - n);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
