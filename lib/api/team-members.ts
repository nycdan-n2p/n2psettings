import { getApiClient, type V1Response } from "../api-client";

export interface TeamMember {
  userId: number;
  firstName: string;
  lastName: string;
  extension: string;
  email: string;
  status: string;
  role: string;
  totalVMs?: number;
  deptId?: number;
  departmentName?: string;
  /** Comma-separated department names from members[] */
  departments?: string;
  ringGroupStatus?: string;
  directoryEnabled?: boolean;
  musicOnHold?: string;
}

/** Full user detail from GET /accounts/{id}/users/{userId} — used for edit modal */
export interface UserDetail extends TeamMember {
  callerId?: string;
  lineNumber?: string[];
  timeZone?: string;
  voicemailEnabled?: boolean;
  voicemailPin?: string;
  voicemailNotification?: {
    emailNotify?: boolean;
    emailIncludeVM?: boolean;
    emailTranscribe?: boolean;
    emailIncludeCallerDetails?: boolean;
  };
  sipDeviceRings?: number;
  compDir?: { enabled?: boolean; audioType?: number };
  isRingGroupCallsEnabled?: boolean;
  hasCustomMusicOnHold?: boolean;
  members?: Array<{ id: number; name: string }>;
  avatars?: Array<{ size: string; url: string }>;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  extension: string;
  roleId?: number;
  deptId?: number;
  phoneNumber?: string;
  password?: string;
}

/** Extended payload for PUT /accounts/{id}/users/{userId} */
export interface UpdateUserPayload extends Partial<CreateUserPayload> {
  voicemailEnabled?: boolean;
  voicemailNotification?: {
    emailNotify?: boolean;
    emailIncludeVM?: boolean;
    emailTranscribe?: boolean;
    emailIncludeCallerDetails?: boolean;
  };
  compDir?: { enabled?: boolean; audioType?: number };
  isRingGroupCallsEnabled?: boolean;
  hasCustomMusicOnHold?: boolean;
  sipDeviceRings?: number;
  callerId?: string;
  lineNumber?: string[];
  members?: Array<{ id: number }>;
}

type RawUser = {
  userId?: number;
  firstName?: string;
  lastName?: string;
  extension?: string;
  email?: string;
  status?: string;
  role?: string;
  members?: Array<{ id?: number; name?: string }>;
  compDir?: { enabled?: boolean };
  isRingGroupCallsEnabled?: boolean;
  hasCustomMusicOnHold?: boolean;
  [key: string]: unknown;
};

function mapUser(raw: RawUser): TeamMember {
  const depts =
    Array.isArray(raw.members) && raw.members.length > 0
      ? raw.members.map((m) => m.name ?? "").filter(Boolean).join(", ")
      : undefined;
  return {
    userId: raw.userId ?? 0,
    firstName: raw.firstName ?? "",
    lastName: raw.lastName ?? "",
    extension: String(raw.extension ?? ""),
    email: raw.email ?? "",
    status: raw.status ?? "",
    role: raw.role ?? "",
    departments: depts,
    departmentName: depts,
    ringGroupStatus: raw.isRingGroupCallsEnabled ? "Signed in to all ring groups" : undefined,
    directoryEnabled: raw.compDir?.enabled ?? undefined,
    musicOnHold: raw.hasCustomMusicOnHold ? "Custom" : "Default",
  };
}

export async function fetchUser(
  accountId: number,
  userId: number
): Promise<UserDetail | null> {
  const api = await getApiClient();
  try {
    const res = await api.get<V1Response<RawUser & Record<string, unknown>>>(
      `/accounts/${accountId}/users/${userId}`
    );
    const raw = res.data.data;
    if (!raw) return null;
    const base = mapUser(raw as RawUser);
    const d = raw as Record<string, unknown>;
    return {
      ...base,
      callerId: d.callerId as string | undefined,
      lineNumber: Array.isArray(d.lineNumber) ? (d.lineNumber as string[]) : undefined,
      timeZone: d.timeZone as string | undefined,
      voicemailEnabled: d.voicemailEnabled as boolean | undefined,
      voicemailPin: d.voicemailPin as string | undefined,
      voicemailNotification: d.voicemailNotification as UserDetail["voicemailNotification"],
      sipDeviceRings: typeof d.sipDeviceRings === "number" ? d.sipDeviceRings : undefined,
      compDir: d.compDir as UserDetail["compDir"],
      isRingGroupCallsEnabled: d.isRingGroupCallsEnabled as boolean | undefined,
      hasCustomMusicOnHold: d.hasCustomMusicOnHold as boolean | undefined,
      members: Array.isArray(d.members) ? (d.members as UserDetail["members"]) : undefined,
      avatars: Array.isArray(d.avatars) ? (d.avatars as UserDetail["avatars"]) : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchTeamMembers(accountId: number): Promise<TeamMember[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RawUser[]>>(
    `/accounts/${accountId}/users`,
    { params: { includeLineNumbersFlag: "Y", includeDepartmentUser: true } }
  );
  const data = res.data.data;
  return Array.isArray(data) ? data.map(mapUser) : [];
}

export async function createUser(
  accountId: number,
  payload: CreateUserPayload
): Promise<TeamMember> {
  const api = await getApiClient();
  const res = await api.post<V1Response<TeamMember>>(
    `/accounts/${accountId}/users`,
    payload
  );
  return res.data.data;
}

export async function updateUser(
  accountId: number,
  userId: number,
  payload: UpdateUserPayload
): Promise<TeamMember> {
  const api = await getApiClient();
  const res = await api.put<V1Response<TeamMember>>(
    `/accounts/${accountId}/users/${userId}`,
    payload
  );
  return res.data.data;
}

export async function deleteUser(
  accountId: number,
  userId: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/users/${userId}`);
}

export async function exportUsersCsv(accountId: number): Promise<Blob> {
  const api = await getApiClient();
  const res = await api.get(`/accounts/${accountId}/users`, {
    params: { format: "csv" },
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function searchUsers(
  accountId: number,
  query: string
): Promise<TeamMember[]> {
  const all = await fetchTeamMembers(accountId);
  const q = query.toLowerCase();
  return all.filter(
    (u) =>
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.extension?.includes(q)
  );
}
