import { getApiClient, type V1Response } from "../api-client";

export interface Department {
  deptId: number;
  name: string;
  extension: string;
  memberCount?: number;
  [key: string]: unknown;
}

export interface CreateDepartmentPayload {
  name: string;
  extension?: string;
}

export async function fetchDepartments(accountId: number): Promise<Department[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Department[]>>(
    `/accounts/${accountId}/departments`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
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
