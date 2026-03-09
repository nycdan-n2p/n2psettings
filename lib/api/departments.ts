import { getApiClient, type V1Response } from "../api-client";

export interface Department {
  deptId: number;
  name: string;
  extension: string;
  [key: string]: unknown;
}

export async function fetchDepartments(
  accountId: number
): Promise<Department[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Department[]>>(
    `/accounts/${accountId}/departments`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

/**
 * Assign a user to a department by patching the user record.
 */
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
