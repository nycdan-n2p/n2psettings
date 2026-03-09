import { getApiClient, type V1Response } from "../api-client";

export interface Device {
  macId: string;
  provisioningUrl?: string;
  deviceType?: {
    id: number;
    name: string;
    manufacturer?: string;
    imageUrl?: string;
  };
  [key: string]: unknown;
}

export async function fetchDevices(accountId: number): Promise<Device[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Device[]>>(
    `/accounts/${accountId}/devices`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}
