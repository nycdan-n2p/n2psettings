import { getApiClient, type V1Response } from "../api-client";

export interface TieLine {
  tieLineId: number;
  enabled: boolean;
  inboundToken?: string;
  outboundDestination?: string;
  outboundPrefix?: string;
  transportProtocol?: string;
  keepUserDestinationNumber?: boolean;
  addPrefixToSourceNumber?: boolean;
}

export async function fetchTieLines(
  accountId: number
): Promise<TieLine[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<TieLine[]>>(
    `/accounts/${accountId}/tie-line`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function updateTieLine(
  accountId: number,
  tieLineId: number,
  payload: Partial<TieLine>
): Promise<TieLine> {
  const api = await getApiClient();
  const res = await api.patch<V1Response<TieLine>>(
    `/accounts/${accountId}/tie-line/${tieLineId}`,
    payload
  );
  return res.data.data;
}

export async function addTieLine(
  accountId: number,
  payload: Partial<TieLine>
): Promise<TieLine> {
  const api = await getApiClient();
  const res = await api.post<V1Response<TieLine>>(
    `/accounts/${accountId}/tie-line`,
    payload
  );
  return res.data.data;
}

export async function deleteTieLine(
  accountId: number,
  tieLineId: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/tie-line/${tieLineId}`);
}
