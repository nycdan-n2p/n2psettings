import { getApiClient, type V1Response } from "../api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScheduleTimezone {
  abbreviation: string;   // "EST", "PST" — stored on schedule
  name: string;           // "Eastern Standard Time"
  format: string;         // "US/Eastern"
}

/** One rule interval (weekday or calendar-date based) */
export interface ScheduleRule {
  name?: string;
  days: {
    /** 1=Sun 2=Mon 3=Tue 4=Wed 5=Thu 6=Fri 7=Sat (null when calendar mode) */
    weekDays: number[] | null;
    /** ISO date strings (null when weekday mode) */
    dates: string[] | null;
    /** true = date/day range, false = individual days */
    isRange: boolean;
  };
  time: {
    start: string;   // "09:00 AM"
    end: string;     // "05:00 PM"
  };
}

export interface ScheduleUsed {
  users?: { id: string; name: string }[] | null;
  departments?: { id: string; name: string }[] | null;
  welcomeMenus?: { id: string; name: string }[] | null;
  ringGroups?: { id: string; name: string }[] | null;
  callQueues?: { id: string; name: string }[] | null;
}

export interface Schedule {
  id: number;
  name: string;
  type?: string;          // "24/7" | "Open" | "Custom"
  timezone?: string;      // timezone abbreviation, e.g. "EST"
  ownerId?: number;
  ownerType?: string;
  createdBy?: {
    userId: string;
    name: string;
    email?: string;
    avatars?: { size: string; url: string; type: string }[];
  } | null;
  rules?: ScheduleRule[];
  used?: ScheduleUsed;
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

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchTimezones(): Promise<ScheduleTimezone[]> {
  const api = await getApiClient();
  try {
    const res = await api.get<V1Response<ScheduleTimezone[]>>("/timezones");
    const data = res.data.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
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
