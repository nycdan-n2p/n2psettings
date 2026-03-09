import { getApiClient, type V1Response } from "../api-client";

export type RecordingStatus = "S" | "D" | "N"; // Saved, Deleted, New/unseen

/**
 * Get a single call recording's metadata / signed stream URL.
 * Note: this endpoint is for call recordings, not voicemails.
 * Voicemail IDs live in a different ID space.
 */
export async function fetchCallRecording(
  recordingId: number | string
): Promise<{ url?: string; [key: string]: unknown } | null> {
  try {
    const api = await getApiClient();
    const res = await api.get<{ url?: string } | V1Response<{ url?: string }>>(
      `/call-record/${recordingId}`
    );
    return (res.data as { data?: unknown }).data
      ? ((res.data as V1Response<{ url?: string }>).data ?? null)
      : (res.data as { url?: string });
  } catch {
    return null;
  }
}

/**
 * Update the status of one or more call recordings.
 * status: "S" = saved, "D" = deleted, "N" = new/unread
 */
export async function updateRecordingStatus(
  accountId: number,
  recordingIds: (number | string)[],
  status: RecordingStatus
): Promise<void> {
  const api = await getApiClient();
  const idsParam = recordingIds.join(",");
  await api.patch(
    `/accounts/${accountId}/callrecordings`,
    undefined,
    { params: { recordingIds: idsParam, status } }
  );
}

/**
 * Delete (mark as deleted) a single recording.
 * Convenience wrapper around updateRecordingStatus.
 */
export async function deleteRecording(
  accountId: number,
  recordingId: number | string
): Promise<void> {
  await updateRecordingStatus(accountId, [recordingId], "D");
}

/**
 * Save (pin) a single recording.
 */
export async function saveRecording(
  accountId: number,
  recordingId: number | string
): Promise<void> {
  await updateRecordingStatus(accountId, [recordingId], "S");
}
