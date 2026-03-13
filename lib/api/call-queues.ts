import type { AxiosInstance } from "axios";
import { getApiClient, getV2ApiClient, getN2pApiClient, type V1Response, type V2PaginatedResponse } from "../api-client";
import { fetchUsersLight } from "./ring-groups";

// ── List item (from v2 paginated list) ───────────────────────────────────────
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

// ── Detail types (from GET /v2/call-queues/{id}) ─────────────────────────────
export interface QueueAgent {
  id?: number | string;
  user_id?: number;
  display_name?: string;
  extension?: string;
  status?: string;
}

export interface QueueAudioSetting {
  type: "no_prompt" | "default" | "custom";
  id?: string | null;
}

export interface QueueActionDestination {
  type: "welcome_menu" | "call_queue" | "voicemail" | "external" | "user";
  welcome_menu?: { id: string | number };
  call_queue?: { id: string | number };
  user?: { id: string | number };
  external?: { number: string };
}

export interface QueueAction {
  type: "forward" | "hangup" | "voicemail";
  destination?: QueueActionDestination;
}

export interface QueueKeyAction {
  key: string;  // "0"-"9", "*", "#"
  destination?: QueueActionDestination;
}

export interface QueueAnnouncementSettings {
  primary_audio?: QueueAudioSetting;
  primary_audio_delay_seconds?: number;
  secondary_audio?: QueueAudioSetting;
}

export interface CallQueueDetail {
  id: string;
  display_name: string;
  extension?: string;
  agents_count?: number;
  agents?: QueueAgent[];
  supervisors?: QueueAgent[];
  max_capacity?: number;
  max_wait_time_seconds?: number;
  ring_strategy?: { type: string };
  key_actions?: QueueKeyAction[];
  no_agents_action?: QueueAction;
  max_limit_reached_action?: QueueAction;
  on_hold_audio?: QueueAudioSetting;
  welcome_greeting_audio?: QueueAudioSetting;
  announcement_settings?: QueueAnnouncementSettings;
  /** true when loaded from v1 fallback (v2 detail returned 404) */
  _isV1Fallback?: boolean;
}

export interface UpdateCallQueuePayload {
  display_name?: string;
  max_capacity?: number;
  max_wait_time_seconds?: number;
  ring_strategy?: { type: string };
  key_actions?: QueueKeyAction[];
  no_agents_action?: QueueAction;
  max_limit_reached_action?: QueueAction;
  on_hold_audio?: QueueAudioSetting;
  welcome_greeting_audio?: QueueAudioSetting;
  announcement_settings?: QueueAnnouncementSettings;
}

// ── List helpers ─────────────────────────────────────────────────────────────
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

// ── API functions ─────────────────────────────────────────────────────────────
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

function isAxios404(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 404
  );
}

async function fetchCallQueueDetailV1Fallback(
  accountId: number,
  queueId: string
): Promise<CallQueueDetail> {
  const api = await getApiClient();
  type V1Queue = Record<string, unknown>;
  const res = await api.get<V1Response<V1Queue>>(`/accounts/${accountId}/callqueues/${queueId}`);
  const d = res.data.data ?? {};
  const ext = d.extension ?? d.Extension ?? d.extension_number;
  return {
    id: String(d.id ?? queueId),
    display_name:
      (d.display_name as string) ?? (d.name as string) ?? (d.queue_name as string) ?? "",
    extension: typeof ext === "string" ? ext : typeof ext === "number" ? String(ext) : undefined,
    agents_count: typeof d.agents_count === "number" ? d.agents_count : undefined,
    ring_strategy: d.strategy ? { type: d.strategy as string } : undefined,
    max_wait_time_seconds:
      typeof d.max_wait_time === "number" ? d.max_wait_time : undefined,
    _isV1Fallback: true,
  };
}

/** Build minimal detail from list item when detail API returns 404 */
function detailFromListQueue(q: CallQueue): CallQueueDetail {
  return {
    id: q.id,
    display_name: q.name,
    extension: q.extension,
    agents_count: q.agents_count,
    _isV1Fallback: true,
  };
}

/** Normalize raw API agent (handles camelCase, nested user object) */
function normalizeQueueAgent(raw: Record<string, unknown>): QueueAgent {
  const user = raw.user as Record<string, unknown> | undefined;
  const displayName =
    (raw.display_name as string) ??
    (raw.displayName as string) ??
    (user?.display_name as string) ??
    (user?.displayName as string);
  const firstName = (raw.first_name as string) ?? (raw.firstName as string) ?? (user?.first_name as string) ?? (user?.firstName as string);
  const lastName = (raw.last_name as string) ?? (raw.lastName as string) ?? (user?.last_name as string) ?? (user?.lastName as string);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim() || displayName;
  const rawUserId = raw.user_id ?? raw.userId ?? user?.id ?? user?.user_id;
  const userId = typeof rawUserId === "number" ? rawUserId : typeof rawUserId === "string" && /^\d+$/.test(rawUserId) ? parseInt(rawUserId, 10) : undefined;
  const id = raw.id ?? user?.id;
  const ext = raw.extension ?? raw.Extension ?? user?.extension ?? user?.Extension;
  return {
    id: typeof id === "number" ? id : typeof id === "string" ? id : undefined,
    user_id: typeof userId === "number" ? userId : undefined,
    display_name: (combinedName || displayName || undefined)?.trim() || undefined,
    extension: typeof ext === "string" ? ext : typeof ext === "number" ? String(ext) : undefined,
    status: (raw.status as string) ?? (user?.status as string),
  };
}

/** Enrich agents missing display_name by fetching users from account */
async function enrichAgentsWithUserNames(
  agents: QueueAgent[],
  accountId: number
): Promise<QueueAgent[]> {
  const needEnrich = agents.some((a) => !a.display_name?.trim() && (a.user_id != null || a.id != null));
  if (!needEnrich) return agents;
  const users = await fetchUsersLight(accountId);
  return agents.map((a) => {
    if (a.display_name?.trim()) return a;
    const uid = a.user_id ?? (typeof a.id === "number" ? a.id : undefined);
    const u = users.find((u) => String(u.userId) === String(uid));
    const name = u ? `${u.firstName} ${u.lastName}`.trim() : undefined;
    return { ...a, display_name: name || a.display_name };
  });
}

export async function fetchCallQueueDetail(
  queueId: string,
  accountId?: number
): Promise<CallQueueDetail> {
  const api = await getV2ApiClient();
  try {
    const res = await api.get<Record<string, unknown>>(`/call-queues/${queueId}`);
    const data = res.data;
    const rawAgents = (data.agents ?? []) as Record<string, unknown>[];
    const rawSupervisors = (data.supervisors ?? []) as Record<string, unknown>[];
    const agents = rawAgents.map((a) => normalizeQueueAgent(a));
    const supervisors = rawSupervisors.map((a) => normalizeQueueAgent(a));
    let enrichedAgents = agents;
    let enrichedSupervisors = supervisors;
    if (accountId) {
      enrichedAgents = await enrichAgentsWithUserNames(agents, accountId);
      enrichedSupervisors = await enrichAgentsWithUserNames(supervisors, accountId);
    }
    return {
      ...data,
      agents: enrichedAgents,
      supervisors: enrichedSupervisors,
    } as CallQueueDetail;
  } catch (err: unknown) {
    if (isAxios404(err)) {
      if (accountId) {
        try {
          return await fetchCallQueueDetailV1Fallback(accountId, queueId);
        } catch {
          // v1 also 404 — fall through to list fallback
        }
      }
      // Fall back to list: find queue by id or extension
      const queues = await fetchCallQueues();
      const found =
        queues.find((q) => q.id === queueId || q.extension === queueId) ??
        queues.find((q) => String(q.id) === queueId || String(q.extension) === queueId);
      if (found) return detailFromListQueue(found);
    }
    throw err;
  }
}

export async function updateCallQueueV2(
  queueId: string,
  payload: UpdateCallQueuePayload
): Promise<CallQueueDetail> {
  const api = await getV2ApiClient();
  const res = await api.patch<CallQueueDetail>(`/call-queues/${queueId}`, payload);
  return res.data;
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

// ─── Call Queue Reports (api.n2p.io/v2) ─────────────────────────────────────

export type ReportIntervalSize = "quarter_of_hour" | "hour" | "day";

export interface AgentActivityReportParams {
  accountId: number;
  queueId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;
  intervalSize?: ReportIntervalSize;
  timezone?: string;
  agentIds?: number[];
}

export interface QueueActivityReportParams {
  accountId: number;
  queueId: string;
  startDate: string;
  endDate: string;
  intervalSize?: ReportIntervalSize;
  ianaTimezoneId?: string;
}

/** Try multiple API hosts for call queue reports (v1, v2, n2p) */
async function tryReportApi<T>(
  accountId: number,
  queueId: string,
  pathSuffix: string,
  body: Record<string, unknown>,
  pathWithoutAccount: string
): Promise<T> {
  const attempts: { api: () => Promise<AxiosInstance>; path: string }[] = [
    { api: getApiClient, path: `/accounts/${accountId}/callqueues/${queueId}/${pathSuffix}` },
    { api: getApiClient, path: `/accounts/${accountId}/call-queues/${queueId}/${pathSuffix}` },
    { api: getV2ApiClient, path: pathWithoutAccount },
    { api: getN2pApiClient, path: pathWithoutAccount },
  ];

  let lastErr: unknown = null;
  for (const { api, path } of attempts) {
    try {
      const client = await api();
      const res = await client.post<T>(path, body);
      return res.data;
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 404 && status !== 400) throw err;
    }
  }

  const data = (lastErr as { response?: { data?: unknown } })?.response?.data;
  const msg = data != null && typeof data === "object" && "message" in data
    ? String((data as { message?: unknown }).message)
    : "Reports are temporarily unavailable for this queue.";
  throw new Error(msg);
}

export async function fetchAgentActivityReport(params: AgentActivityReportParams): Promise<unknown> {
  const body: Record<string, unknown> = {
    start_date: params.startDate,
    end_date: params.endDate,
    interval_size: params.intervalSize ?? "hour",
    timezone: params.timezone ?? "US/Eastern",
  };
  if (params.agentIds?.length) body.agent_ids = params.agentIds;
  return tryReportApi(
    params.accountId,
    params.queueId,
    "agents-report",
    body,
    `/call-queues/${params.queueId}/agents-report`
  );
}

export async function fetchQueueActivityReport(params: QueueActivityReportParams): Promise<unknown> {
  const body = {
    start_date: params.startDate,
    end_date: params.endDate,
    interval_size: params.intervalSize ?? "hour",
    iana_timezone_id: params.ianaTimezoneId ?? "US/Eastern",
  };
  return tryReportApi(
    params.accountId,
    params.queueId,
    "queue-report",
    body,
    `/call-queues/${params.queueId}/queue-report`
  );
}
