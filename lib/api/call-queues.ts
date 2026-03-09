import { getV2ApiClient, type V2PaginatedResponse } from "../api-client";

export interface CallQueue {
  id: string;
  name: string;
  extension?: string;
  agents_count?: number;
  created_at_time?: string;
}

export async function fetchCallQueues(): Promise<CallQueue[]> {
  const api = await getV2ApiClient();
  const res = await api.get<V2PaginatedResponse<CallQueue>>("/call-queues", {
    params: { limit: 100 },
  });
  return res.data.items ?? [];
}
