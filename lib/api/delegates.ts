import { getApiClient, type V1Response } from "../api-client";

export interface Delegate {
  id: number;
  type: string;
  name: string;
  email: string;
  status: string;
  delegateToClientId?: number;
}

export async function fetchDelegates(accountId: number): Promise<Delegate[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Delegate[]>>(
    `/accounts/${accountId}/delegates`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function addDelegate(
  accountId: number,
  payload: { name: string; email: string; type?: string }
): Promise<Delegate> {
  const api = await getApiClient();
  const res = await api.post<V1Response<Delegate>>(
    `/accounts/${accountId}/delegates`,
    payload
  );
  return res.data.data;
}

export async function updateDelegate(
  accountId: number,
  id: number,
  payload: Partial<Delegate>
): Promise<Delegate> {
  const api = await getApiClient();
  const res = await api.patch<V1Response<Delegate>>(
    `/accounts/${accountId}/delegates/${id}`,
    payload
  );
  return res.data.data;
}

export async function deleteDelegate(
  accountId: number,
  id: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/delegates/${id}`);
}
