import { getApiClient, type V1Response } from "../api-client";

export interface VirtualFax {
  phoneNumber: string;
  encrypt?: boolean;
  incoming?: string[];
  outgoing?: string[];
}

export async function fetchVirtualFaxes(
  accountId: number
): Promise<VirtualFax[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<VirtualFax[]>>(
    `/accounts/${accountId}/virtualfaxes`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function addVirtualFax(
  accountId: number,
  payload: VirtualFax
): Promise<VirtualFax> {
  const api = await getApiClient();
  const res = await api.post<V1Response<VirtualFax>>(
    `/accounts/${accountId}/virtualfaxes`,
    payload
  );
  return res.data.data;
}

export async function updateVirtualFax(
  accountId: number,
  phoneNumber: string,
  payload: Partial<VirtualFax>
): Promise<VirtualFax> {
  const api = await getApiClient();
  const res = await api.patch<V1Response<VirtualFax>>(
    `/accounts/${accountId}/virtualfaxes/${encodeURIComponent(phoneNumber)}`,
    payload
  );
  return res.data.data;
}

export async function deleteVirtualFax(
  accountId: number,
  phoneNumber: string
): Promise<void> {
  const api = await getApiClient();
  await api.delete(
    `/accounts/${accountId}/virtualfaxes/${encodeURIComponent(phoneNumber)}`
  );
}
