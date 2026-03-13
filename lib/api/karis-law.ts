import { getApiClient, type V1Response } from "../api-client";

export interface KariLawEntry {
  id: number;
  number: string;
  ownerName?: string;
  ownerId?: number;
  createdAt?: string;
  /** User who added the number (legacy "ADDED BY") */
  addedBy?: string;
}

export async function fetchKarisLaw(accountId: number): Promise<KariLawEntry[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<KariLawEntry[]>>(
    `/accounts/${accountId}/karisLawSettings`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function addKarisLawNumber(
  accountId: number,
  payload: { number: string; ownerName?: string }
): Promise<KariLawEntry> {
  const api = await getApiClient();
  const res = await api.post<V1Response<KariLawEntry>>(
    `/accounts/${accountId}/karisLawSettings`,
    payload
  );
  return res.data.data;
}

export async function updateKarisLawNumber(
  accountId: number,
  id: number,
  payload: Partial<KariLawEntry>
): Promise<KariLawEntry> {
  const api = await getApiClient();
  const res = await api.patch<V1Response<KariLawEntry>>(
    `/accounts/${accountId}/karisLawSettings/${id}`,
    payload
  );
  return res.data.data;
}

export async function deleteKarisLawNumber(
  accountId: number,
  id: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/karisLawSettings/${id}`);
}
