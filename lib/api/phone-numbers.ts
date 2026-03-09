import { getApiClient, type V1Response } from "../api-client";

export interface PhoneNumber {
  phoneNumber: string;
  extension?: string;
  userId?: number;
  [key: string]: unknown;
}

export async function fetchPhoneNumbers(
  accountId: number
): Promise<PhoneNumber[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<PhoneNumber[]>>(
    `/accounts/${accountId}/phonenumbers`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}
