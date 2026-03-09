import { getApiClient, type V1Response } from "../api-client";

export interface RingGroup {
  id: string | number;
  name: string;
  extension?: string;
  lines?: Array<{ lineId: string; status: string }>;
  [key: string]: unknown;
}

export async function fetchRingGroups(
  accountId: number
): Promise<RingGroup[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RingGroup[]>>(
    `/account/${accountId}/ringGroups`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

/**
 * Add a user to a ring group by updating its lines array.
 * Fetches the current ring group, appends the userId as a lineId, then PUTs.
 */
export async function addUserToRingGroup(
  accountId: number,
  ringGroupId: string | number,
  userId: number
): Promise<void> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`
  );
  const rg = res.data.data;
  const currentLines: Array<{ lineId: string; status: string }> =
    Array.isArray(rg?.lines) ? rg.lines : [];
  const lineId = String(userId);
  if (currentLines.some((l) => l.lineId === lineId)) return; // already a member
  const updated = {
    ...rg,
    lines: [...currentLines, { lineId, status: "active" }],
  };
  await api.put<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`,
    updated
  );
}
