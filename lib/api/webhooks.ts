import { getApiClient, type V1Response } from "../api-client";

export interface Webhook {
  id?: number;
  url?: string;
  eventTypes?: string[];
  [key: string]: unknown;
}

export async function fetchWebhooks(
  accountId: number,
  userId: number
): Promise<Webhook[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Webhook[]>>(
    `/accounts/${accountId}/users/${userId}/integrations/webhook`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchWebhookEventTypes(
  accountId: number,
  userId: number
): Promise<string[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<string[]>>(
    `/accounts/${accountId}/users/${userId}/integrations/webhook/eventTypes`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}
