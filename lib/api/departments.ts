import { getApiClient, type V1Response } from "../api-client";

export interface DepartmentMember {
  userId: number;
  firstName?: string;
  lastName?: string;
  extension?: string;
}

export interface Department {
  deptId: number;
  name: string;
  extension: string;
  memberCount?: number;
  /** Formatted team members list e.g. "Yitzi Wurtzel, Doreen Gerber, ..." */
  teamMembersDisplay?: string;
  /** Raw members for edit modal */
  members?: DepartmentMember[];
  /** Phone number IDs/numbers routed to this department */
  lineNumber?: string[];
  [key: string]: unknown;
}

export interface CreateDepartmentPayload {
  name: string;
  extension?: string;
}

type RawDept = {
  id?: number;
  deptId?: number;
  name?: string;
  extension?: string;
  membersCount?: number;
  memberCount?: number;
  members?: Array<{ userId?: number; firstName?: string; lastName?: string; extension?: string }>;
  lineNumber?: string[];
  [key: string]: unknown;
};

function mapDepartment(raw: RawDept): Department {
  const deptId = raw.deptId ?? raw.id ?? 0;
  const members: DepartmentMember[] =
    Array.isArray(raw.members) && raw.members.length > 0
      ? raw.members
          .filter((m) => m.userId != null)
          .map((m) => ({
            userId: m.userId!,
            firstName: m.firstName,
            lastName: m.lastName,
            extension: m.extension,
          }))
      : [];
  const teamMembersDisplay =
    members.length > 0
      ? members
          .map((m) => {
            const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
            return m.extension ? `${name} ${m.extension}` : name;
          })
          .filter(Boolean)
          .join(", ")
      : undefined;
  return {
    deptId,
    name: raw.name ?? "",
    extension: String(raw.extension ?? ""),
    memberCount: raw.membersCount ?? raw.memberCount ?? members.length,
    teamMembersDisplay,
    members: members.length > 0 ? members : undefined,
    lineNumber: Array.isArray(raw.lineNumber) ? raw.lineNumber : undefined,
  };
}

export async function fetchDepartments(accountId: number): Promise<Department[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RawDept[]>>(
    `/accounts/${accountId}/departments`,
    { params: { includeLineNumbersFlag: "Y" } }
  );
  const data = res.data.data;
  return Array.isArray(data) ? data.map(mapDepartment) : [];
}

export async function fetchDepartment(accountId: number, deptId: number): Promise<Department | null> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RawDept>>(
    `/accounts/${accountId}/departments/${deptId}`,
    { params: { includeLineNumbersFlag: "Y" } }
  );
  const raw = res.data?.data;
  return raw ? mapDepartment(raw) : null;
}

export async function createDepartment(
  accountId: number,
  payload: CreateDepartmentPayload
): Promise<Department> {
  const api = await getApiClient();
  const res = await api.post<V1Response<Department>>(
    `/accounts/${accountId}/departments`,
    payload
  );
  return res.data.data;
}

export async function updateDepartment(
  accountId: number,
  deptId: number,
  payload: Partial<CreateDepartmentPayload>
): Promise<Department> {
  const api = await getApiClient();
  const res = await api.put<V1Response<Department>>(
    `/accounts/${accountId}/departments/${deptId}`,
    payload
  );
  return res.data.data;
}

export async function deleteDepartment(
  accountId: number,
  deptId: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/departments/${deptId}`);
}

export async function assignUserToDepartment(
  accountId: number,
  userId: number,
  deptId: number
): Promise<void> {
  const api = await getApiClient();
  // Fetch current memberships so we can append rather than replace
  let existing: { id: number }[] = [];
  try {
    const res = await api.get<V1Response<{ members?: Array<{ id?: number }> }>>(
      `/accounts/${accountId}/users/${userId}`
    );
    existing = (res.data.data?.members ?? [])
      .map((m) => ({ id: m.id as number }))
      .filter((m) => m.id != null);
  } catch { /* if fetch fails, fall back to just the new dept */ }

  // Skip if already a member
  if (existing.some((m) => m.id === deptId)) return;

  await api.put<V1Response<unknown>>(
    `/accounts/${accountId}/users/${userId}`,
    { members: [...existing, { id: deptId }] }
  );
}

/** Remove a user from a specific department without affecting their other memberships. */
export async function unassignUserFromDepartment(
  accountId: number,
  userId: number,
  deptId: number
): Promise<void> {
  const api = await getApiClient();
  // Fetch current memberships so we only remove the target dept
  let existing: { id: number }[] = [];
  try {
    const res = await api.get<V1Response<{ members?: Array<{ id?: number }> }>>(
      `/accounts/${accountId}/users/${userId}`
    );
    existing = (res.data.data?.members ?? [])
      .map((m) => ({ id: m.id as number }))
      .filter((m) => m.id != null);
  } catch { /* if fetch fails, send an empty list as a safe fallback */ }

  await api.put<V1Response<unknown>>(
    `/accounts/${accountId}/users/${userId}`,
    { members: existing.filter((m) => m.id !== deptId) }
  );
}

// ─── Department features (e.g. call recording) ────────────────────────────────

export interface DepartmentFeature {
  id: string;
  active: boolean;
}

export async function fetchDepartmentFeatures(
  accountId: number,
  deptId: number
): Promise<DepartmentFeature[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<DepartmentFeature[]>>(
    `/accounts/${accountId}/departments/${deptId}/features`,
    { params: { features: "record" } }
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function updateDepartmentFeature(
  accountId: number,
  deptId: number,
  featureId: string,
  active: boolean
): Promise<void> {
  const api = await getApiClient();
  await api.put(
    `/accounts/${accountId}/departments/${deptId}/features`,
    [{ id: featureId, active }]
  );
}

// ─── Department call forward rules (Call Options) ──────────────────────────────

export interface CallForwardRuleItem {
  sequence: string;
  type: "user" | "department";
  value: string;
  rings: number;
  status: string;
}

export interface DepartmentCallForwardRules {
  ruletype: string;
  voicemailPin?: string;
  forwardTo: CallForwardRuleItem[];
  callerIdFlag: boolean;
  callScreeningFlag: boolean;
  posAck?: boolean;
}

export async function fetchDepartmentCallForwardRules(
  accountId: number,
  deptId: number
): Promise<DepartmentCallForwardRules> {
  const api = await getApiClient();
  const res = await api.get<V1Response<DepartmentCallForwardRules>>(
    `/accounts/${accountId}/departments/${deptId}/callForwardRules`
  );
  return res.data.data ?? { ruletype: "seq", forwardTo: [], callerIdFlag: false, callScreeningFlag: false };
}

export async function updateDepartmentCallForwardRules(
  accountId: number,
  deptId: number,
  payload: Partial<DepartmentCallForwardRules>
): Promise<DepartmentCallForwardRules> {
  const api = await getApiClient();
  const res = await api.put<V1Response<DepartmentCallForwardRules>>(
    `/accounts/${accountId}/departments/${deptId}/callForwardRules`,
    payload
  );
  return res.data.data;
}
