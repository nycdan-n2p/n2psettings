import { getApiClient, type V1Response } from "../api-client";

// ── Core types ────────────────────────────────────────────────────────────────

export type RouteType = "user" | "department" | "Department" | "ringGroup" | "welcomeMenu" | "specialExtension" | "callQueue" | null;

export type CallerIdMode = "none" | "prefix" | "suffix" | "replace";

export interface CallerIdSetting {
  mode: CallerIdMode;
  value: string;
}

export interface PhoneNumberAvatars {
  size: string;
  url: string;
  type: string;
}

export interface PhoneNumberUserInfo {
  userId: string;
  name: string;
  email?: string;
  avatars?: PhoneNumberAvatars[];
}

export interface PhoneNumber {
  /** E.164 without + — e.g. "18483287202" */
  number: string;
  phoneNumber?: string;
  status: "A" | "I" | string;
  extension?: string;
  routeToId?: number | null;
  routesTo?: string | null;
  routeType?: RouteType;
  /** Legacy field kept for backwards-compat with departments page */
  deptId?: number | null;
  userId?: number | null;
  forbiddenAsCallerId?: boolean;
  pendingNumber?: string | null;
  outboundCallerIdName?: string | null;
  userInfo?: PhoneNumberUserInfo | null;
  portingInfo?: unknown;
  callerIdNumber?: CallerIdSetting;
  callerIdName?: CallerIdSetting;
  carrier?: string;
  [key: string]: unknown;
}

export interface PhoneNumberStats {
  accountId: string;
  maxPhoneNumbers: number;
  phoneNumbersInUse: number;
  unUsedPhones: number;
  maxUserPhoneNumbers: number;
  maxDepartmentPhoneNumbers: number;
  maxRingPhoneNumbers: number;
}

export interface CallerIdOptions {
  callerIdNumber: CallerIdSetting;
  callerIdName: CallerIdSetting;
}

// ── Destination item types (for the assignment picker) ────────────────────────

export type DestType = "user" | "department" | "ringGroup" | "welcomeMenu" | "specialExtension" | "callQueue";

export interface AssignDest {
  id: number | string;
  name: string;
  extension?: string;
  type: DestType;
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export async function fetchPhoneNumbers(accountId: number): Promise<PhoneNumber[]> {
  const api = await getApiClient();
  const res = await api.get<{ data: PhoneNumber[]; hasError?: boolean }>(
    `/accounts/${accountId}/phonenumbers?bFilterUsersWithSingleLine=false&bFilterOutVirtualFax=false&bIncludePendingPortNumbers=true`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data.map((n) => ({ ...n, phoneNumber: n.number })) : [];
}

export async function fetchPhoneNumberStats(accountId: number): Promise<PhoneNumberStats | null> {
  const api = await getApiClient();
  const res = await api.get<V1Response<PhoneNumberStats>>(`/accounts/${accountId}/phonenumbers/stats`);
  return res.data.data ?? null;
}

export async function fetchCallerIdOptions(accountId: number, number: string): Promise<CallerIdOptions> {
  const api = await getApiClient();
  const res = await api.get<V1Response<CallerIdOptions>>(
    `/accounts/${accountId}/phonenumbers/${number}/callerIdReplacementOptions`
  );
  return res.data.data ?? { callerIdNumber: { mode: "none", value: "" }, callerIdName: { mode: "none", value: "" } };
}

export async function updatePhoneNumber(
  accountId: number,
  number: string,
  payload: Partial<PhoneNumber>
): Promise<void> {
  const api = await getApiClient();
  await api.patch(`/accounts/${accountId}/phonenumbers/${number}?ignoreUS911=false`, payload);
}

export async function fetchAssignmentTargets(accountId: number): Promise<{
  users: AssignDest[];
  departments: AssignDest[];
  ringGroups: AssignDest[];
  welcomeMenus: AssignDest[];
  specialExtensions: AssignDest[];
  callQueues: AssignDest[];
}> {
  const api = await getApiClient();

  const [usersRes, deptsRes, ringsRes, menusRes, specsRes, queuesRes] = await Promise.allSettled([
    api.get<V1Response<Array<{ userId: number; firstName: string; lastName: string; extension?: string }>>>(
      `/accounts/${accountId}/users?includeLineNumbersFlag=Y&includeDepartmentUser=true`
    ),
    api.get<V1Response<{ items: Array<{ deptId: number; name: string; extension?: string }> }>>(
      `/accounts/${accountId}/departments/light?skip=0&take=0`
    ),
    api.get<V1Response<Array<{ id: number; name: string; extension?: string }>>>(
      `/account/${accountId}/ringGroups`
    ),
    api.get<V1Response<{ items: Array<{ id: number; name: string; extension?: string }> }>>(
      `/accounts/${accountId}/multiautoattendants/light?skip=0&take=0`
    ),
    api.get<V1Response<{ items: Array<{ id: number; name: string; extension?: string }> }>>(
      `/accounts/${accountId}/specialextensions/light?skip=0&take=0`
    ),
    api.get<{ items?: Array<{ id: string | number; name?: string; extension?: string }>; data?: unknown }>(
      `/v2/call-queues?limit=100`
    ),
  ]);

  const users: AssignDest[] =
    usersRes.status === "fulfilled"
      ? (usersRes.value.data.data ?? []).map((u) => ({
          id: u.userId,
          name: `${u.firstName} ${u.lastName}`.trim(),
          extension: u.extension,
          type: "user" as const,
        }))
      : [];

  const departments: AssignDest[] =
    deptsRes.status === "fulfilled"
      ? (deptsRes.value.data.data?.items ?? []).map((d) => ({
          id: d.deptId,
          name: d.name,
          extension: d.extension,
          type: "department" as const,
        }))
      : [];

  const ringGroups: AssignDest[] =
    ringsRes.status === "fulfilled"
      ? (ringsRes.value.data.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          extension: r.extension,
          type: "ringGroup" as const,
        }))
      : [];

  const welcomeMenus: AssignDest[] =
    menusRes.status === "fulfilled"
      ? (menusRes.value.data.data?.items ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          extension: m.extension,
          type: "welcomeMenu" as const,
        }))
      : [];

  const specialExtensions: AssignDest[] =
    specsRes.status === "fulfilled"
      ? (specsRes.value.data.data?.items ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          extension: s.extension,
          type: "specialExtension" as const,
        }))
      : [];

  const callQueues: AssignDest[] =
    queuesRes.status === "fulfilled"
      ? ((queuesRes.value.data as unknown as { items?: Array<{ id: string | number; name?: string; extension?: string }> })?.items ?? []).map((q) => ({
          id: q.id,
          name: q.name ?? String(q.id),
          extension: q.extension,
          type: "callQueue" as const,
        }))
      : [];

  return { users, departments, ringGroups, welcomeMenus, specialExtensions, callQueues };
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Format an E.164 number string like "18005551234" → "(800) 555-1234" */
export function formatPhoneNumber(num: string): string {
  const digits = num.replace(/\D/g, "");
  const local = digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return num;
}
