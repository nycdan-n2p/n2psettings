import { getApiClient, type V1Response } from "../api-client";

export interface VoicemailItem {
  voicemailId?: number;
  ownerId?: number;
  from?: { name?: string; callerId?: string; number?: string };
  to?: { name?: string; firstName?: string; lastName?: string };
  callDate?: string;
  voicemailTime?: string;
  duration?: number;
  isRead?: boolean;
  type?: string;
  [key: string]: unknown;
}

export async function fetchVoicemails(
  accountId: number,
  userId: number,
  type: "Unread" | "All" = "All",
  count = 50,
  sorting: "asc" | "desc" = "desc"
): Promise<{ items: VoicemailItem[]; totalCount: number }> {
  const api = await getApiClient();
  const res = await api.get<V1Response<VoicemailItem[] | { items?: VoicemailItem[]; totalCount?: number }>>(
    `/accounts/${accountId}/users/${userId}/voicemails`,
    { params: { type, count, sorting } }
  );
  const data = res.data.data;

  // API returns either: { data: [...] } (array) or { data: { items, totalCount } }
  let items: VoicemailItem[] = [];
  let totalCount = 0;

  if (Array.isArray(data)) {
    items = data;
    totalCount = data.length;
  } else if (data && typeof data === "object" && "items" in data) {
    items = Array.isArray((data as { items?: VoicemailItem[] }).items)
      ? (data as { items: VoicemailItem[] }).items
      : [];
    totalCount =
      (data as { totalCount?: number }).totalCount ?? items.length;
  }

  // Normalize voicemailTime -> callDate for display
  items = items.map((vm) => ({
    ...vm,
    callDate: vm.callDate ?? vm.voicemailTime,
    from: {
      ...vm.from,
      callerId: vm.from?.callerId ?? vm.from?.name,
    },
  }));

  return { items, totalCount };
}

/** Get signed URL for voicemail audio playback.
 * Note: /call-record/{id} returns 404 for voicemails — voicemail IDs ≠ call-record IDs.
 * Tries voicemail-specific paths first; falls back to call-record for compatibility.
 */
export async function fetchVoicemailAudioUrl(
  voicemailId: number,
  accountId?: number,
  userId?: number
): Promise<string | null> {
  const api = await getApiClient();

  // 1. Try voicemail-specific path (accounts/users/voicemails/{id}/record)
  if (accountId != null && userId != null) {
    try {
      const res = await api.get<{ url?: string; data?: { url?: string } }>(
        `/accounts/${accountId}/users/${userId}/voicemails/${voicemailId}/record`
      );
      const url = res.data?.url ?? res.data?.data?.url;
      if (url) return url;
    } catch {
      // 404 or other error — try next
    }
  }

  // 2. Try call-record only when no account/user context — for call recordings (different ID space)
  if (accountId == null || userId == null) {
    try {
      const res = await api.get<{ url?: string }>(`/call-record/${voicemailId}`);
      const url = res.data?.url ?? (res.data as { url?: string })?.url;
      return url ?? null;
    } catch {
      // ignore
    }
  }
  return null;
}

/** Fetch voicemail detail (may include transcript and audio URL). Endpoint may not exist. */
export async function fetchVoicemailDetail(
  accountId: number,
  userId: number,
  voicemailId: number
): Promise<{ transcript?: string; audioUrl?: string } | null> {
  try {
    const api = await getApiClient();
    const res = await api.get(
      `/accounts/${accountId}/users/${userId}/voicemails/${voicemailId}`
    );
    const raw = res.data as { data?: unknown } | { transcript?: string; audioUrl?: string };
    const d = (raw as { data?: unknown }).data ?? raw;
    return d && typeof d === "object" ? (d as { transcript?: string; audioUrl?: string }) : null;
  } catch {
    return null;
  }
}
