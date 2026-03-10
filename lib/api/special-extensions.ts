import { getApiClient, type V1Response } from "../api-client";

export interface SpecialExtension {
  id?: number;
  extension?: string;
  name?: string;
  type?: string;
  phoneNumber?: string;
  [key: string]: unknown;
}

export interface CreateSpecialExtensionPayload {
  name: string;
  type: string;
  extension?: string;
  phoneNumber?: string;
}

export async function fetchSpecialExtensions(
  accountId: number
): Promise<SpecialExtension[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<SpecialExtension[]>>(
    `/accounts/${accountId}/specialextensions`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function createSpecialExtension(
  accountId: number,
  payload: CreateSpecialExtensionPayload
): Promise<SpecialExtension> {
  const api = await getApiClient();
  const res = await api.post<V1Response<SpecialExtension>>(
    `/accounts/${accountId}/specialextensions`,
    payload
  );
  return res.data.data;
}

export async function updateSpecialExtension(
  accountId: number,
  extId: number,
  payload: Partial<CreateSpecialExtensionPayload>
): Promise<SpecialExtension> {
  const api = await getApiClient();
  const res = await api.put<V1Response<SpecialExtension>>(
    `/accounts/${accountId}/specialextensions/${extId}`,
    payload
  );
  return res.data.data;
}

export async function deleteSpecialExtension(
  accountId: number,
  extId: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/specialextensions/${extId}`);
}
