import { getApiClient, type V1Response } from "../api-client";

export interface Schedule {
  id: number;
  name: string;
  type?: string;
  timezone?: string;
  ownerId?: number;
  ownerType?: string;
  rules?: unknown[];
  used?: {
    users?: { id: string; name: string }[] | null;
    departments?: { id: string; name: string }[] | null;
    welcomeMenus?: { id: string; name: string }[] | null;
    ringGroups?: { id: string; name: string }[] | null;
  };
  [key: string]: unknown;
}

// The /schedules endpoint returns { total, schedules: [...] }, NOT a bare array
interface SchedulesEnvelope {
  total?: number;
  schedules?: Schedule[];
}

export async function fetchSchedules(accountId: number): Promise<Schedule[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Schedule[] | SchedulesEnvelope>>(
    `/accounts/${accountId}/schedules`,
    { params: { skip: 0, take: 0, order: 1 } }
  );
  const data = res.data.data;

  // Bare array (unexpected but handled safely)
  if (Array.isArray(data)) return data;

  // Expected shape: { total, schedules: [...] }
  const envelope = data as SchedulesEnvelope;
  if (Array.isArray(envelope?.schedules)) return envelope.schedules;

  return [];
}
