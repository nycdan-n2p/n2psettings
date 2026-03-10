import { getApiClient, type V1Response } from "../api-client";

export interface Department {
  deptId: number;
  name: string;
  extension: string;
  memberCount?: number;
  /** Formatted team members list e.g. "Yitzi Wurtzel, Doreen Gerber, ..." */
  teamMembersDisplay?: string;
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
  [key: string]: unknown;
};

function mapDepartment(raw: RawDept): Department {
  const deptId = raw.deptId ?? raw.id ?? 0;
  const teamMembersDisplay =
    Array.isArray(raw.members) && raw.members.length > 0
      ? raw.members
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
    memberCount: raw.membersCount ?? raw.memberCount ?? raw.members?.length,
    teamMembersDisplay,
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
  await api.patch<V1Response<unknown>>(
    `/accounts/${accountId}/users/${userId}`,
    { deptId }
  );
}
