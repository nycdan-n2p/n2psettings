import { getApiClient, type V1Response } from "../api-client";

export interface CDR {
  callId: string;
  callResult: string;
  callType: number;
  duration: number;
  callDate: string;
  direction: number;
  from?: { callerId?: string; number?: string };
  to?: { userId?: number; userDisplayName?: string; number?: string };
}

export interface CallHistoryResponse {
  cdrs: CDR[];
}

export async function fetchCallHistory(
  accountId: number,
  userId: number | null,
  startDate: string,
  endDate: string,
  skip = 0,
  take = 20
): Promise<CDR[]> {
  const api = await getApiClient();
  const body: Record<string, unknown> = { startDate, endDate, skip, take };
  if (userId) body.userId = userId;
  const res = await api.post<V1Response<CallHistoryResponse>>(
    `/account/${accountId}/callhistorysummaryv2`,
    body
  );
  const data = res.data.data;
  return data?.cdrs ?? [];
}

export async function exportCallHistoryCsv(
  accountId: number,
  userId: number | null,
  startDate: string,
  endDate: string
): Promise<Blob> {
  const api = await getApiClient();
  const body: Record<string, unknown> = { startDate, endDate, format: "csv" };
  if (userId) body.userId = userId;
  const res = await api.post(
    `/account/${accountId}/callhistorysummaryv2`,
    body,
    { responseType: "blob" }
  );
  return res.data as Blob;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
