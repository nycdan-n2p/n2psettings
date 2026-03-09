import { getApiClient, type V1Response } from "../api-client";

export interface BulkLoadItem {
  id?: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

export async function fetchBulkLoad(
  accountId: number
): Promise<{ items?: BulkLoadItem[]; [key: string]: unknown }> {
  const api = await getApiClient();
  const res = await api.get<V1Response<unknown>>(
    `/accounts/${accountId}/bulkLoad`
  );
  const data = res.data.data;
  if (data && typeof data === "object") {
    return data as { items?: BulkLoadItem[]; [key: string]: unknown };
  }
  return {};
}
