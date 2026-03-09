import { getApiClient, type V1Response } from "../api-client";

export interface WelcomeMenu {
  id: number;
  name: string;
  extension?: string;
  languageCode?: string;
}

export async function fetchVirtualAssistants(
  accountId: number
): Promise<WelcomeMenu[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<WelcomeMenu[]>>(
    `/accounts/${accountId}/multiautoattendants`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}
