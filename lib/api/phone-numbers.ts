import { getApiClient, type V1Response } from "../api-client";

export interface PhoneNumber {
  phoneNumber: string;
  extension?: string;
  userId?: number;
  /** When routed to department */
  routeToId?: number | null;
  routeType?: string | null;
  routesTo?: string | null;
  deptId?: number | null;
  [key: string]: unknown;
}

type RawPhoneNumber = Record<string, unknown> & { number?: string; phoneNumber?: string };

function normalizePhoneNumber(raw: RawPhoneNumber): PhoneNumber {
  const num = raw.phoneNumber ?? raw.number ?? "";
  return { ...raw, phoneNumber: num } as PhoneNumber;
}

export async function fetchPhoneNumbers(
  accountId: number
): Promise<PhoneNumber[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RawPhoneNumber[]>>(
    `/accounts/${accountId}/phonenumbers`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data.map(normalizePhoneNumber) : [];
}
