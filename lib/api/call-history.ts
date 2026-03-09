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
  userId: number,
  startDate: string,
  endDate: string,
  skip = 0,
  take = 20
): Promise<CDR[]> {
  const api = await getApiClient();
  const res = await api.post<V1Response<CallHistoryResponse>>(
    `/account/${accountId}/callhistorysummaryv2`,
    { startDate, endDate, skip, take, userId }
  );
  const data = res.data.data;
  return data?.cdrs ?? [];
}
