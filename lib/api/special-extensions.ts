import { getApiClient, type V1Response } from "../api-client";

export interface SpecialExtension {
  id?: number;
  extension?: string;
  name?: string;
  [key: string]: unknown;
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
