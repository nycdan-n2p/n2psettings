import { getApiClient, type V1Response } from "../api-client";

// ─── Light-list types ──────────────────────────────────────────────────────

export interface MenuLightItem {
  id: number;
  name: string;
  extension?: string;
  languageCode?: string;
}

export interface UserLightItem {
  userId: number;
  firstName: string;
  lastName: string;
  extension?: string;
}

export interface DeptLightItem {
  deptId: number;
  name: string;
  extension?: string;
}

export interface SpecialExtLightItem {
  id: number;
  name: string;
  extension?: string;
  businessClass?: string;
}

export interface CallQueueLightItem {
  id: string;
  display_name?: string;
  name?: string;
  extension?: string;
}

export interface RingGroupLightItem {
  id: number | string;
  name: string;
  extension?: string;
}

// ─── Menu Option / Destination ─────────────────────────────────────────────

export type DestinationType =
  | "user"
  | "department"
  | "menu"
  | "ringgroup"
  | "queue"
  | "special"
  | "voicemail"
  | "directory";

export interface MenuOptionDestination {
  type: DestinationType;
  id?: string | number;       // null/undefined for voicemail/directory
  name?: string;              // display name (populated on fetch)
  extension?: string;
}

export interface MenuOption {
  key: string;                // "0"-"9", "*", "#", or "noSelection"
  destination?: MenuOptionDestination;
  description?: string;
  enabled?: boolean;
  orderBy?: number;
}

// ─── Full Welcome Menu detail ──────────────────────────────────────────────

export interface WelcomeMenuSettings {
  allowExtensionDialing?: boolean;
  playWaitMessage?: boolean;
  allowBargingThrough?: boolean;
}

export interface WelcomeMenuDetail {
  id: number;
  name: string;
  extension?: string;
  languageCode?: string;
  smsDestinationType?: string;    // "companyAll", "user", etc.
  smsDestinationId?: number;
  settings?: WelcomeMenuSettings;
  menuOptions?: MenuOption[];
  noSelectionDestination?: MenuOptionDestination;
  greetingFileId?: string;
}

// ─── Legacy types (kept for list page) ────────────────────────────────────

export interface WelcomeMenuOption {
  key: string;
  action: string;
  targetId?: string | number;
  targetName?: string;
}

export interface WelcomeMenu {
  id: number;
  name: string;
  extension?: string;
  languageCode?: string;
  options?: WelcomeMenuOption[];
}

export interface CreateWelcomeMenuPayload {
  name: string;
  extension?: string;
  languageCode?: string;
  options?: WelcomeMenuOption[];
}

// ─── Dropdown helpers ──────────────────────────────────────────────────────

export async function fetchMenusLight(accountId: number): Promise<MenuLightItem[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<{ total: number; items: MenuLightItem[] }>>(
    `/accounts/${accountId}/multiautoattendants/light`,
    { params: { skip: 0, take: 0 } }
  );
  return res.data.data?.items ?? [];
}

export async function fetchUsersLightForMenu(accountId: number): Promise<UserLightItem[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<{ total: number; items: UserLightItem[] }>>(
    `/accounts/${accountId}/users/light`,
    { params: { skip: 0, take: 0 } }
  );
  return res.data.data?.items ?? [];
}

export async function fetchDeptsLightForMenu(accountId: number): Promise<DeptLightItem[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<{ total: number; items: DeptLightItem[] }>>(
    `/accounts/${accountId}/departments/light`,
    { params: { skip: 0, take: 0 } }
  );
  return res.data.data?.items ?? [];
}

export async function fetchSpecialExtensionsLight(accountId: number): Promise<SpecialExtLightItem[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<{ total: number; items: SpecialExtLightItem[] }>>(
    `/accounts/${accountId}/specialextensions/light`,
    { params: { skip: 0, take: 0 } }
  );
  return res.data.data?.items ?? [];
}

export async function fetchRingGroupsForMenu(accountId: number): Promise<RingGroupLightItem[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<RingGroupLightItem[]>>(
    `/account/${accountId}/ringGroups`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

// ─── CRUD for list page ────────────────────────────────────────────────────

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

export async function fetchWelcomeMenuDetail(
  accountId: number,
  menuId: number | string
): Promise<WelcomeMenuDetail> {
  const api = await getApiClient();
  const res = await api.get<V1Response<WelcomeMenuDetail>>(
    `/accounts/${accountId}/multiautoattendants/${menuId}`
  );
  return res.data.data;
}

export async function createVirtualAssistant(
  accountId: number,
  payload: CreateWelcomeMenuPayload
): Promise<WelcomeMenu> {
  const api = await getApiClient();
  const res = await api.post<V1Response<WelcomeMenu>>(
    `/accounts/${accountId}/multiautoattendants`,
    payload
  );
  return res.data.data;
}

export async function updateVirtualAssistant(
  accountId: number,
  menuId: number,
  payload: Partial<CreateWelcomeMenuPayload>
): Promise<WelcomeMenu> {
  const api = await getApiClient();
  const res = await api.put<V1Response<WelcomeMenu>>(
    `/accounts/${accountId}/multiautoattendants/${menuId}`,
    payload
  );
  return res.data.data;
}

export async function updateWelcomeMenuDetail(
  accountId: number,
  menuId: number | string,
  payload: Partial<WelcomeMenuDetail>
): Promise<WelcomeMenuDetail> {
  const api = await getApiClient();
  const res = await api.put<V1Response<WelcomeMenuDetail>>(
    `/accounts/${accountId}/multiautoattendants/${menuId}`,
    payload
  );
  return res.data.data;
}

export async function deleteVirtualAssistant(
  accountId: number,
  menuId: number
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/multiautoattendants/${menuId}`);
}

export async function setMenuOptions(
  accountId: number,
  menuId: number,
  options: WelcomeMenuOption[]
): Promise<void> {
  const api = await getApiClient();
  await api.put<V1Response<unknown>>(
    `/accounts/${accountId}/multiautoattendants/${menuId}/options`,
    { options }
  );
}

export async function uploadMenuGreeting(
  accountId: number,
  menuId: number | string,
  file: File
): Promise<void> {
  const api = await getApiClient();
  const formData = new FormData();
  formData.append("file", file);
  await api.post(
    `/accounts/${accountId}/multiAttendants/${menuId}/menu/menuGreetingFiles`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
}
