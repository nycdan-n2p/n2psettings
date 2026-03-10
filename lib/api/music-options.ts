import { getApiClient, type V1Response } from "../api-client";

export interface MusicOption {
  id: number;
  name: string;
  fileName?: string;
  isDefault?: boolean;
}

const PATHS = ["musicoptions", "music-options"] as const;

/** Fetch music options. Tries multiple path variants; returns [] on 404 (API may not exist for all accounts). */
export async function fetchMusicOptions(accountId: number): Promise<MusicOption[]> {
  const api = await getApiClient();
  for (const path of PATHS) {
    try {
      const res = await api.get<V1Response<MusicOption[]>>(
        `/accounts/${accountId}/${path}`
      );
      const data = res.data?.data ?? res.data;
      return Array.isArray(data) ? data : [];
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) continue;
      throw err;
    }
  }
  return [];
}

export async function uploadMusicOption(
  accountId: number,
  file: File,
  name: string
): Promise<MusicOption> {
  try {
    const api = await getApiClient();
    const form = new FormData();
    form.append("file", file);
    form.append("name", name);
    const res = await api.post<V1Response<MusicOption>>(
      `/accounts/${accountId}/musicoptions`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return res.data.data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      throw new Error("Music Options API not available for this account (404).");
    }
    throw err;
  }
}

export async function deleteMusicOption(
  accountId: number,
  id: number
): Promise<void> {
  try {
    const api = await getApiClient();
    await api.delete(`/accounts/${accountId}/musicoptions/${id}`);
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      throw new Error("Music Options API not available for this account (404).");
    }
    throw err;
  }
}
