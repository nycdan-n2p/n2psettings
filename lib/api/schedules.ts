import { getApiClient, type V1Response } from "../api-client";

export interface ScheduleRule {
  day?: number;        // 0=Sun, 1=Mon ... 6=Sat
  startTime?: string;  // "HH:mm"
  endTime?: string;    // "HH:mm"
}

export interface Schedule {
  id: number;
  name: string;
  type?: string;
  timezone?: string;
  ownerId?: number;
  ownerType?: string;
  rules?: ScheduleRule[];
  used?: {
    users?: { id: string; name: string }[] | null;
    departments?: { id: string; name: string }[] | null;
    welcomeMenus?: { id: string; name: string }[] | null;
    ringGroups?: { id: string; name: string }[] | null;
  };
  [key: string]: unknown;
}

export interface CreateSchedulePayload {
  name: string;
  timezone?: string;
  rules?: ScheduleRule[];
}

interface SchedulesEnvelope {
  total?: number;
  schedules?: Schedule[];
}

export async function fetchSchedules(accountId: number): Promise<Schedule[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Schedule[] | SchedulesEnvelope>>(
    `/accounts/${accountId}/schedules`,
    { params: { skip: 0, take: 500, order: 1 } }
  );
  const data = res.data.data;
  if (Array.isArray(data)) return data;
  const envelope = data as SchedulesEnvelope;
  if (Array.isArray(envelope?.schedules)) return envelope.schedules;
  return [];
}

export async function createSchedule(
  accountId: number,
  payload: CreateSchedulePayload
): Promise<Schedule> {
  const api = await getApiClient();
  const res = await api.post<V1Response<Schedule>>(
    `/accounts/${accountId}/schedules`,
    payload
  );
  return res.data.data;
}

export async function updateSchedule(
  accountId: number,
  scheduleId: number,
  payload: Partial<CreateSchedulePayload>
): Promise<Schedule> {
  const api = await getApiClient();
  const res = await api.put<V1Response<Schedule>>(
    `/accounts/${accountId}/schedules/${scheduleId}`,
    payload
  );
  return res.data.data;
}

export async function deleteSchedule(
  accountId: number,
  scheduleId: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/schedules/${scheduleId}`);
}
