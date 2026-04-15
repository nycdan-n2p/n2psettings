import { getApiClient, type V1Response } from "../api-client";

export interface CDRParty {
  userId?: number | null;
  userName?: string | null;
  userDisplayName?: string | null;
  callerId?: string | null;
  number?: string | null;
  avatars?: Array<{ size: string; url: string; type?: string }> | null;
  menuDisplayName?: string | null;
  menuId?: number | null;
  ringGroupDisplayName?: string | null;
  ringGroupId?: number | null;
  departmentDisplayName?: string | null;
  departmentId?: number | null;
  callQueueDisplayName?: string | null;
  callQueueId?: number | null;
}

export interface CallRecording {
  id: number;
  userId: number;
  /** "N" = new/unheard, "S" = seen/heard */
  status: "N" | "S" | string;
  duration: number;
}

export interface CDR {
  callId: string;
  callResult: string;
  callType: number;
  duration: number;
  callDate: string;
  direction: number;
  charges?: number;
  dnis?: string;
  from?: CDRParty;
  to?: CDRParty;
  voiceMailId?: string | null;
  voiceMailStatus?: string | null;
  recordings?: CallRecording[];
  burst?: boolean;
}

export interface CallHistoryResponse {
  cdrs: CDR[];
  nextCursor?: string | null;
  prevCursor?: string | null;
  blockAnonymous?: boolean;
}

export interface CallHistoryFilter {
  userId?: number | null;
  direction?: number | null;
  resultTypes?: string[];
  userIds?: number[] | null;
  departments?: number[];
  callQueueIds?: number[];
  onlyVoiceMails?: boolean;
  onlyRecordings?: boolean;
  callFeatures?: string[];
  phoneNumber?: string;
}

/**
 * Fetch call history using the correct callhistorysummaryv2 body format.
 * The API expects a filter object and cursor-based pagination (NOT startDate/endDate/skip).
 *
 * @param accountId     - The account ID
 * @param currentUserId - The logged-in user's ID (always sent as currentUserId)
 * @param filter        - Optional filter overrides (e.g. mine vs company scope)
 * @param take          - Page size (default 50)
 * @param cursor        - Cursor token for next/prev page (null = first page)
 */
export async function fetchCallHistory(
  accountId: number,
  currentUserId: number | null,
  filter?: Partial<CallHistoryFilter>,
  take = 50,
  cursor: string | null = null
): Promise<CallHistoryResponse> {
  const api = await getApiClient();

  const body = {
    currentUserId: currentUserId ?? 0,
    filter: {
      userId: filter?.userId ?? null,
      from: null,
      to: null,
      direction: filter?.direction ?? null,
      resultTypes: filter?.resultTypes ?? [],
      userIds: filter?.userIds ?? null,
      departments: filter?.departments ?? [],
      callQueueIds: filter?.callQueueIds ?? [],
      onlyVoiceMails: filter?.onlyVoiceMails ?? false,
      onlyRecordings: filter?.onlyRecordings ?? false,
      callFeatures: filter?.callFeatures ?? [],
      phoneNumber: filter?.phoneNumber ?? "",
    },
    take,
    cursor,
  };

  try {
    const res = await api.post<V1Response<CallHistoryResponse>>(
      `/account/${accountId}/callhistorysummaryv2`,
      body
    );
    return res.data.data ?? { cdrs: [] };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 500 || status === 502 || status === 503) {
      return { cdrs: [] };
    }
    throw err;
  }
}

export async function exportCallHistoryCsv(
  accountId: number,
  currentUserId: number | null,
  filter?: Partial<CallHistoryFilter>
): Promise<Blob> {
  const api = await getApiClient();

  const body = {
    currentUserId: currentUserId ?? 0,
    filter: {
      userId: filter?.userId ?? null,
      from: null,
      to: null,
      direction: null,
      resultTypes: filter?.resultTypes ?? [],
      userIds: filter?.userIds ?? null,
      departments: filter?.departments ?? [],
      callQueueIds: filter?.callQueueIds ?? [],
      onlyVoiceMails: false,
      onlyRecordings: false,
      callFeatures: [],
      phoneNumber: "",
    },
    take: 500,
    cursor: null,
    format: "csv",
  };

  const res = await api.post(
    `/account/${accountId}/callhistorysummaryv2`,
    body,
    { responseType: "blob" }
  );
  return res.data as Blob;
}

/**
 * Get a short-lived signed S3 URL for playing a recording.
 * GET /call-record/{recordingId}  →  { url: string }
 */
export async function fetchRecordingUrl(recordingId: number): Promise<string> {
  const api = await getApiClient();
  const res = await api.get<{ url: string }>(`/call-record/${recordingId}`);
  return res.data.url;
}

/**
 * Mark one or more recordings as heard.
 * PATCH /accounts/{accountId}/callrecordings?recordingIds={id}&status=S
 */
export async function markRecordingHeard(
  accountId: number,
  recordingId: number
): Promise<void> {
  const api = await getApiClient();
  await api.patch(
    `/accounts/${accountId}/callrecordings?recordingIds=${recordingId}&status=S`,
    {}
  );
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Lightweight call stats from recent call history (fallback when analytics API unavailable) */
export interface CallStatsFromHistory {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
}

export async function fetchCallStatsFromHistory(
  accountId: number,
  currentUserId: number | null
): Promise<CallStatsFromHistory> {
  const res = await fetchCallHistory(accountId, currentUserId, {}, 500, null);
  const cdrs = res.cdrs ?? [];
  let answered = 0;
  let missed = 0;
  for (const cdr of cdrs) {
    const result = (cdr.callResult ?? "").toLowerCase();
    if (result.includes("answered") && !result.includes("not") && !result.includes("un")) answered++;
    else if (result.includes("not answered") || result === "missed") missed++;
  }
  return {
    totalCalls: cdrs.length,
    answeredCalls: answered,
    missedCalls: missed,
  };
}
