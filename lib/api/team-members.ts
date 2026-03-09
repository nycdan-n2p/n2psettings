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
}

export async function fetchTeamMembers(accountId: number): Promise<TeamMember[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<TeamMember[]>>(
    `/accounts/${accountId}/users`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

/**
 * Search users by a partial name or email (client-side filter over the full list).
 */
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
