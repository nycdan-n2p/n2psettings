import { getApiClient, type V1Response } from "../api-client";

export interface BlockedNumber {
  id?: number;
  number?: string;
  [key: string]: unknown;
}

export async function fetchInboundBlockList(): Promise<BlockedNumber[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<BlockedNumber[]>>("/call-blocking/inbound");
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchOutboundBlockList(): Promise<BlockedNumber[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<BlockedNumber[]>>("/call-blocking/outbound");
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function addBlockedNumber(
  type: "inbound" | "outbound",
  payload: { number: string }
): Promise<BlockedNumber> {
  const api = await getApiClient();
  const res = await api.post<V1Response<BlockedNumber>>(
    `/call-blocking/${type}`,
    payload
  );
  return res.data.data;
}

export async function deleteBlockedNumber(
  type: "inbound" | "outbound",
  number: string
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/call-blocking/${type}`, {
    params: { number },
  });
}
