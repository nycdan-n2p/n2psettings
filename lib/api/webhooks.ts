import { getApiClient, type V1Response } from "../api-client";

export interface Webhook {
  id?: number;
  name?: string;
  url?: string;
  description?: string;
  /** ["*"] means all events; otherwise an array of specific event-type strings */
  eventTypes?: string[];
  /** "all" = entire company; "specific" = filtered to specificUserIds */
  userScope?: "all" | "specific";
  specificUserIds?: number[];
  secretKey?: string;
  active?: boolean;
  [key: string]: unknown;
}

export interface CreateWebhookPayload {
  name: string;
  url: string;
  description?: string;
  eventTypes: string[];
  userScope: "all" | "specific";
  specificUserIds?: number[];
}

function base(accountId: number, userId: number) {
  return `/accounts/${accountId}/users/${userId}/integrations/webhook`;
}

export async function fetchWebhooks(
  accountId: number,
  userId: number
): Promise<Webhook[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Webhook[]>>(base(accountId, userId));
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchWebhookEventTypes(
  accountId: number,
  userId: number
): Promise<string[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<string[]>>(
    `${base(accountId, userId)}/eventTypes`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function createWebhook(
  accountId: number,
  userId: number,
  payload: CreateWebhookPayload
): Promise<Webhook> {
  const api = await getApiClient();
  const res = await api.post<V1Response<Webhook>>(
    base(accountId, userId),
    payload
  );
  return res.data.data ?? {};
}

export async function deleteWebhook(
  accountId: number,
  userId: number,
  webhookId: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`${base(accountId, userId)}/${webhookId}`);
}

export async function updateWebhook(
  accountId: number,
  userId: number,
  webhookId: number,
  payload: Partial<CreateWebhookPayload>
): Promise<Webhook> {
  const api = await getApiClient();
  const res = await api.put<V1Response<Webhook>>(
    `${base(accountId, userId)}/${webhookId}`,
    payload
  );
  return res.data.data ?? {};
}
