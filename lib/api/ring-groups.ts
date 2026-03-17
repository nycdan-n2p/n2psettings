import { getApiClient, type V1Response } from "../api-client";

// ─── Light-weight types ────────────────────────────────────────────────────

export interface LightItem {
  id: number | string;
  name: string;
  extension?: string;
}

export interface UserLight {
  userId: number;
  firstName: string;
  lastName: string;
  extension?: string;
}

// ─── Ring Group types ──────────────────────────────────────────────────────

export interface RingGroupMember {
  data: string;             // userId or departmentId as string
  type: "user" | "department";
  rings: number;
  status: string;
  redirectToVoicemail: boolean;
  orderBy: string | number;
}

export interface RingGroupTier {
  id: number;
  orderBy: number;
  status: string;
  rings?: number;           // how many rings before escalating to next tier
  members: RingGroupMember[];
}

export interface RingGroupFinalTier {
  name: string;
  finalList: boolean;
  orderBy: number;
  status: string;
  members: RingGroupMember[];
}

export interface RingGroupTimeBlock {
  id: number;
  name: string;
  type?: string;            // "allDay" or custom
  tier: RingGroupTier[];
  finalTier: RingGroupFinalTier;
  schedules?: unknown[];
}

export interface CallerIdModifier {
  mode: "none" | "prefix" | "suffix" | "replace";
  value?: string;
}

export interface SmsDestination {
  status: string;
  type: string;             // "companyAll", "user", etc.
  userId?: number;
}

export interface CallQueueSettings {
  isActive: boolean;
  secondaryRinging: boolean;
}

export interface RingGroupFeature {
  id: string;               // e.g. "record"
  active: boolean;
}

export interface RingGroupDetail {
  id: number | string;
  name: string;
  extension?: string;
  lines?: Array<{ lineId: string; status: string }>;
  timeBlock: RingGroupTimeBlock[];
  callQueueSettings?: CallQueueSettings;
  callerIdNumber?: CallerIdModifier;
  callerIdName?: CallerIdModifier;
  smsDestination?: SmsDestination;
}

export interface RingGroup {
  id: string | number;
  name: string;
  extension?: string;
  lines?: Array<{ lineId: string; status: string }>;
  [key: string]: unknown;
}

export interface CreateRingGroupPayload {
  name: string;
  extension?: string;
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────

export async function fetchRingGroups(accountId: number): Promise<RingGroup[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RingGroup[]>>(
    `/account/${accountId}/ringGroups`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchRingGroupDetail(
  accountId: number,
  ringGroupId: string | number
): Promise<RingGroupDetail> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RingGroupDetail>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`
  );
  return res.data.data;
}

export async function fetchRingGroupFeatures(
  accountId: number,
  ringGroupId: string | number
): Promise<RingGroupFeature[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RingGroupFeature[]>>(
    `/accounts/${accountId}/ringGroups/${ringGroupId}/features`,
    { params: { features: "record" } }
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function updateRingGroupFeature(
  accountId: number,
  ringGroupId: string | number,
  featureId: string,
  active: boolean
): Promise<void> {
  const api = await getApiClient();
  await api.put(
    `/accounts/${accountId}/ringGroups/${ringGroupId}/features`,
    [{ id: featureId, active }]
  );
}

/** Fetch users for member/SMS dropdowns */
export async function fetchUsersLight(accountId: number): Promise<UserLight[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<{ total: number; items: UserLight[] }>>(
    `/accounts/${accountId}/users/light`,
    { params: { skip: 0, take: 500 } }
  );
  return res.data.data?.items ?? [];
}

/** Fetch departments for member dropdowns */
export async function fetchDepartmentsLight(accountId: number): Promise<LightItem[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<{ total: number; items: Array<{ deptId: number; name: string; extension?: string }> }>>(
    `/accounts/${accountId}/departments/light`,
    { params: { skip: 0, take: 500 } }
  );
  const items = res.data.data?.items ?? [];
  return items.map((d) => ({ id: d.deptId, name: d.name, extension: d.extension }));
}

// ─── CRUD mutations ────────────────────────────────────────────────────────

export async function createRingGroup(
  accountId: number,
  payload: CreateRingGroupPayload
): Promise<RingGroup> {
  const api = await getApiClient();
  const res = await api.post<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups`,
    payload
  );
  return res.data.data;
}

export async function updateRingGroup(
  accountId: number,
  ringGroupId: string | number,
  payload: Partial<CreateRingGroupPayload>
): Promise<RingGroup> {
  const api = await getApiClient();
  const current = await api.get<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`
  );
  const merged = { ...current.data.data, ...payload };
  const res = await api.put<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`,
    merged
  );
  return res.data.data;
}

export async function updateRingGroupDetail(
  accountId: number,
  ringGroupId: string | number,
  payload: Partial<RingGroupDetail>
): Promise<RingGroupDetail> {
  const api = await getApiClient();
  const res = await api.put<V1Response<RingGroupDetail>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`,
    payload
  );
  return res.data.data;
}

export async function deleteRingGroup(
  accountId: number,
  ringGroupId: string | number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/account/${accountId}/ringGroups/${ringGroupId}`);
}

export async function setRingGroupMembers(
  accountId: number,
  ringGroupId: string | number,
  userIds: number[]
): Promise<void> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`
  );
  const rg = res.data.data;
  const lines = userIds.map((id) => ({ lineId: String(id), status: "active" }));
  await api.put<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`,
    { ...rg, lines }
  );
}

export async function addUserToRingGroup(
  accountId: number,
  ringGroupId: string | number,
  userId: number
): Promise<void> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`
  );
  const rg = res.data.data;
  const currentLines: Array<{ lineId: string; status: string }> =
    Array.isArray(rg?.lines) ? rg.lines : [];
  const lineId = String(userId);
  if (currentLines.some((l) => l.lineId === lineId)) return;
  const updated = {
    ...rg,
    lines: [...currentLines, { lineId, status: "active" }],
  };
  await api.put<V1Response<RingGroup>>(
    `/account/${accountId}/ringGroups/${ringGroupId}`,
    updated
  );
}
