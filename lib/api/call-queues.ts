import { getApiClient, getV2ApiClient, type V1Response, type V2PaginatedResponse } from "../api-client";

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

/**
 * Add a user as an agent to a call queue.
 * Uses v1: POST /accounts/{accountId}/callqueues/{queueId}/agents
 */
export async function addUserToCallQueue(
  accountId: number,
  queueId: string,
  userId: number
): Promise<void> {
  const api = await getApiClient();
  await api.post<V1Response<unknown>>(
    `/accounts/${accountId}/callqueues/${queueId}/agents`,
    { userId }
  );
}
