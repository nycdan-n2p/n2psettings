import { getV2ApiClient, type V2PaginatedResponse } from "../api-client";

export interface CampaignBrand {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface CampaignCampaign {
  id?: string;
  name?: string;
  brand_id?: string;
  [key: string]: unknown;
}

export async function fetchBrands(
  pageIndex = 0,
  pageSize = 100
): Promise<CampaignBrand[]> {
  const api = await getV2ApiClient();
  const res = await api.get<V2PaginatedResponse<CampaignBrand>>(
    "/campaign-registry-brands",
    { params: { page_index: pageIndex, page_size: pageSize } }
  );
  return res.data.items ?? [];
}

export async function fetchCampaigns(
  pageIndex = 0,
  pageSize = 100
): Promise<CampaignCampaign[]> {
  const api = await getV2ApiClient();
  const res = await api.get<V2PaginatedResponse<CampaignCampaign>>(
    "/campaign-registry-campaigns",
    { params: { page_index: pageIndex, page_size: pageSize } }
  );
  return res.data.items ?? [];
}
