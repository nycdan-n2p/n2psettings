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
