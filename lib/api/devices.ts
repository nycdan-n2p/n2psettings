import { getApiClient, type V1Response } from "../api-client";

export interface Device {
  macId: string;
  displayName?: string;
  userId?: number;
  provisioningUrl?: string;
  deviceType?: {
    id: number;
    name: string;
    manufacturer?: string;
    imageUrl?: string;
  };
  [key: string]: unknown;
}

export interface CreateDevicePayload {
  macId: string;
  deviceTypeId?: number;
  displayName?: string;
  userId?: number;
}

export async function fetchDevices(accountId: number): Promise<Device[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Device[]>>(
    `/accounts/${accountId}/devices`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function createDevice(
  accountId: number,
  payload: CreateDevicePayload
): Promise<Device> {
  const api = await getApiClient();
  const res = await api.post<V1Response<Device>>(
    `/accounts/${accountId}/devices`,
    payload
  );
  return res.data.data;
}

export async function updateDevice(
  accountId: number,
  macId: string,
  payload: Partial<CreateDevicePayload>
): Promise<Device> {
  const api = await getApiClient();
  const res = await api.put<V1Response<Device>>(
    `/accounts/${accountId}/devices/${macId}`,
    payload
  );
  return res.data.data;
}

export async function deleteDevice(
  accountId: number,
  macId: string
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/devices/${macId}`);
}
