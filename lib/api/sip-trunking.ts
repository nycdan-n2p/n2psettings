// SIP trunking endpoints live at api.n2p.io/v2 — use getN2pApiClient, NOT getV2ApiClient.
// proxy-v2 → app.net2phone.com/api/v2 (call queues etc.)
// proxy-n2p → api.n2p.io/v2          (sip-trunk-accounts/*)
import { getN2pApiClient, type V2PaginatedResponse } from "../api-client";

/** A SIP trunk account (top-level entity, distinct from the UCaaS account clientId) */
export interface SIPTrunkAccount {
  id: string | number;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

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

/**
 * Fetch the list of SIP trunk accounts for the authenticated user.
 * Call this FIRST to discover the real SIP trunk account ID.
 * DO NOT use the UCaaS account's `clientId` — that is a different namespace
 * and will return 403 from api.n2p.io.
 */
export async function fetchSIPTrunkAccounts(): Promise<SIPTrunkAccount[]> {
  const api = await getN2pApiClient();
  try {
    const res = await api.get<{ items?: SIPTrunkAccount[] } | SIPTrunkAccount[]>(
      "sip-trunk-accounts"
    );
    const d = res.data;
    if (Array.isArray(d)) return d;
    return (d as { items?: SIPTrunkAccount[] })?.items ?? [];
  } catch {
    return [];
  }
}

export async function fetchSIPTrunks(
  clientId: string | number,
  pageIndex = 0,
  pageSize = 100
): Promise<SIPTrunk[]> {
  const api = await getN2pApiClient();
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

export async function fetchSIPLimits(clientId: string | number): Promise<SIPLimit | null> {
  const api = await getN2pApiClient();
  try {
    const res = await api.get(`sip-trunk-accounts/${clientId}/limits`);
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchSIPServiceAddresses(
  clientId: string | number,
  pageIndex = 0,
  pageSize = 10,
  searchQuery = ""
): Promise<SIPServiceAddress[]> {
  const api = await getN2pApiClient();
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
  clientId: string | number,
  pageIndex = 0,
  pageSize = 100
): Promise<SIPPhoneNumber[]> {
  const api = await getN2pApiClient();
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
