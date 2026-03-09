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
