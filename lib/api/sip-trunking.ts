import { getV2ApiClient, type V2PaginatedResponse } from "../api-client";

export interface SIPTrunk {
  id?: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

export interface SIPLimit {
  [key: string]: unknown;
}

export interface SIPServiceAddress {
  id?: string;
  address?: string;
  [key: string]: unknown;
}

export interface SIPPhoneNumber {
  number?: string;
  [key: string]: unknown;
}

export async function fetchSIPTrunks(
  clientId: number,
  pageIndex = 0,
  pageSize = 100
): Promise<SIPTrunk[]> {
  const api = await getV2ApiClient();
  try {
    const res = await api.get<{ items?: SIPTrunk[] } | SIPTrunk[]>(
      `sip-trunk-accounts/${clientId}/trunks`,
      { params: { page_index: pageIndex, page_size: pageSize } }
    );
    const d = res.data;
    if (Array.isArray(d)) return d;
    return (d as { items?: SIPTrunk[] })?.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchSIPLimits(clientId: number): Promise<SIPLimit | null> {
  const api = await getV2ApiClient();
  try {
    const res = await api.get(`sip-trunk-accounts/${clientId}/limits`);
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchSIPServiceAddresses(
  clientId: number,
  pageIndex = 0,
  pageSize = 10,
  searchQuery = ""
): Promise<SIPServiceAddress[]> {
  const api = await getV2ApiClient();
  try {
    const res = await api.get<V2PaginatedResponse<SIPServiceAddress>>(
      `sip-trunk-accounts/${clientId}/service-addresses`,
      { params: { page_index: pageIndex, page_size: pageSize, search_query: searchQuery } }
    );
    return res.data?.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchSIPPhoneNumbers(
  clientId: number,
  pageIndex = 0,
  pageSize = 100
): Promise<SIPPhoneNumber[]> {
  const api = await getV2ApiClient();
  try {
    const res = await api.get<V2PaginatedResponse<SIPPhoneNumber>>(
      `sip-trunk-accounts/${clientId}/phone-numbers`,
      { params: { page_index: pageIndex, page_size: pageSize } }
    );
    return res.data?.items ?? [];
  } catch {
    return [];
  }
}
