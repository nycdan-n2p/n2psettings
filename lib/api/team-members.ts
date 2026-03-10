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
  ringGroupStatus?: string;
  directoryEnabled?: boolean;
  musicOnHold?: string;
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

export async function fetchTeamMembers(accountId: number): Promise<TeamMember[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<TeamMember[]>>(
    `/accounts/${accountId}/users`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
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
  payload: Partial<CreateUserPayload>
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
