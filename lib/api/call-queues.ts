import { getApiClient, getV2ApiClient, type V1Response, type V2PaginatedResponse } from "../api-client";

export interface CallQueue {
  id: string;
  name: string;
  extension?: string;
  agents_count?: number;
  created_at_time?: string;
  strategy?: string;
  max_wait_time?: number;
}

export interface CreateCallQueuePayload {
  name: string;
  extension?: string;
  strategy?: string;
  max_wait_time?: number;
}

type RawCallQueueItem = Record<string, unknown>;

function pickName(item: RawCallQueueItem): string {
  const candidates = [
    item.name, item.Name, item.queue_name, item.queueName,
    item.QueueName, item.display_name, item.displayName, item.label,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
  return candidates[0] ?? "";
}

function pickExtension(item: RawCallQueueItem): string | undefined {
  const ext = item.extension ?? item.Extension ?? item.extension_number ?? item.extensionNumber;
  return typeof ext === "string" ? ext : typeof ext === "number" ? String(ext) : undefined;
}

export async function fetchCallQueues(): Promise<CallQueue[]> {
  const api = await getV2ApiClient();
  const res = await api.get<V2PaginatedResponse<RawCallQueueItem>>("/call-queues", {
    params: { limit: 100 },
  });
  const items = res.data.items ?? [];
  return items.map((item) => {
    const ext = pickExtension(item);
    const name = pickName(item) || (ext ? `Queue ${ext}` : "");
    return {
      id: String(item.id ?? ""),
      name,
      extension: ext,
      agents_count: typeof item.agents_count === "number" ? item.agents_count : undefined,
      created_at_time: typeof item.created_at_time === "string" ? item.created_at_time : undefined,
    };
  });
}

export async function createCallQueue(
  accountId: number,
  payload: CreateCallQueuePayload
): Promise<CallQueue> {
  const api = await getApiClient();
  const res = await api.post<V1Response<CallQueue>>(
    `/accounts/${accountId}/callqueues`,
    payload
  );
  return res.data.data;
}

export async function updateCallQueue(
  accountId: number,
  queueId: string,
  payload: Partial<CreateCallQueuePayload>
): Promise<CallQueue> {
  const api = await getApiClient();
  const res = await api.put<V1Response<CallQueue>>(
    `/accounts/${accountId}/callqueues/${queueId}`,
    payload
  );
  return res.data.data;
}

export async function deleteCallQueue(
  accountId: number,
  queueId: string
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/callqueues/${queueId}`);
}

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

export async function setQueueAgents(
  accountId: number,
  queueId: string,
  userIds: number[]
): Promise<void> {
  const api = await getApiClient();
  await api.put<V1Response<unknown>>(
    `/accounts/${accountId}/callqueues/${queueId}/agents`,
    { agents: userIds.map((id) => ({ userId: id })) }
  );
}
