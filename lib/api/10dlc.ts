import { getV2ApiClient } from "../api-client";

export interface CampaignBrand {
  id: string;
  display_name: string;
  company_name: string;
  type: string;
  vertical?: { id: string; display_name: string };
  identity_status?: string;
  created_at_time?: string;
  ein?: string;
  [key: string]: unknown;
}

export interface CampaignCampaign {
  id?: string;
  name?: string;
  brand_id?: string;
  brand?: { id: string; display_name: string };
  status?: string;
  created_at_time?: string;
  [key: string]: unknown;
}

export interface CampaignVertical {
  id: string;
  display_name: string;
}

export interface OptOutEntry {
  id?: string;
  phone_number?: string;
  campaign?: { id: string };
  status?: string;
  created_at_time?: string;
  [key: string]: unknown;
}

interface CampaignRegistryResponse<T> {
  items: T[];
  page_index?: number;
  page_size?: number;
  total_items?: number;
}

const TYPE_DISPLAY: Record<string, string> = {
  private_profit: "Privately Owned",
  sole_proprietor: "Sole Proprietor",
  public_profit: "Publicly Traded Company",
  non_profit: "Non-Profit Organization",
  government: "Government",
};

export function formatBrandType(type: string): string {
  return TYPE_DISPLAY[type] ?? type;
}

export async function fetchBrands(
  pageIndex = 0,
  pageSize = 100
): Promise<{ items: CampaignBrand[]; totalItems: number }> {
  const api = await getV2ApiClient();
  const res = await api.get<CampaignRegistryResponse<CampaignBrand>>(
    "/campaign-registry-brands",
    { params: { page_index: pageIndex, page_size: pageSize } }
  );
  const data = res.data;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    totalItems: data.total_items ?? data.items?.length ?? 0,
  };
}

export async function fetchCampaigns(
  pageIndex = 0,
  pageSize = 100
): Promise<{ items: CampaignCampaign[]; totalItems: number }> {
  const api = await getV2ApiClient();
  const res = await api.get<CampaignRegistryResponse<CampaignCampaign>>(
    "/campaign-registry-campaigns",
    { params: { page_index: pageIndex, page_size: pageSize } }
  );
  const data = res.data;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    totalItems: data.total_items ?? data.items?.length ?? 0,
  };
}

export async function fetchVerticals(): Promise<CampaignVertical[]> {
  const api = await getV2ApiClient();
  const res = await api.get<CampaignRegistryResponse<CampaignVertical> | CampaignVertical[]>(
    "/campaign-registry-verticals"
  );
  const data = res.data;
  if (Array.isArray(data)) return data;
  return Array.isArray((data as CampaignRegistryResponse<CampaignVertical>).items)
    ? (data as CampaignRegistryResponse<CampaignVertical>).items
    : [];
}

export async function fetchOptOutEntries(
  pageIndex = 0,
  pageSize = 100
): Promise<{ items: OptOutEntry[]; totalItems: number }> {
  const api = await getV2ApiClient();
  const res = await api.get<CampaignRegistryResponse<OptOutEntry>>(
    "/campaign-registry-campaigns/-/opt-out-entries",
    {
      params: {
        page_index: pageIndex,
        page_size: pageSize,
        opt_out_status: "active",
      },
    }
  );
  const data = res.data;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    totalItems: data.total_items ?? data.items?.length ?? 0,
  };
}

export interface CreateBrandPayload {
  country_code?: string;
  ein: string;
  company_name: string;
  display_name: string;
  type: string;
  vertical_id: string;
  email?: string;
  phone_number?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  website?: string;
}

export async function createBrand(
  payload: CreateBrandPayload
): Promise<CampaignBrand> {
  const api = await getV2ApiClient();
  const res = await api.post<CampaignBrand>("/campaign-registry-brands", payload);
  return res.data;
}

export async function updateBrand(
  id: string,
  payload: Partial<CreateBrandPayload>
): Promise<CampaignBrand> {
  const api = await getV2ApiClient();
  const res = await api.patch<CampaignBrand>(
    `/campaign-registry-brands/${id}`,
    payload
  );
  return res.data;
}

export async function deleteBrand(id: string): Promise<void> {
  const api = await getV2ApiClient();
  await api.delete(`/campaign-registry-brands/${id}`);
}
