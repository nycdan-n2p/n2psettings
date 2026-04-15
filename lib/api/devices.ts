import { getApiClient, getN2pApiClient, type V1Response } from "../api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeviceType {
  id: number;
  name: string;
  manufacturer?: string;
  imageUrl?: string;
}

export interface AssignedUser {
  userId?: number;
  firstName?: string;
  lastName?: string;
  extension?: string;
  displayName?: string;
}

export interface Device {
  macId: string;
  displayName?: string;
  userId?: number;
  provisioningUrl?: string;
  lastSyncDate?: string;
  orderId?: string | number;
  status?: string;                    // "active", "inactive", etc.
  sipStatus?: "registered" | "unregistered" | "unknown";
  assignedUser?: AssignedUser;
  deviceType?: DeviceType;
  [key: string]: unknown;
}

export interface CreateDevicePayload {
  macId: string;
  deviceTypeId?: number;
  displayName?: string;
  userId?: number;
}

// ── Extension map from /devices/extensions endpoint ──────────────────────────
export interface DeviceExtension {
  macId: string;
  userId?: number;
  firstName?: string;
  lastName?: string;
  extension?: string;
  displayName?: string;
}

// ── Device template ───────────────────────────────────────────────────────────
export interface DeviceTemplate {
  id: number | string;
  name: string;
  /** e.g. "Polycom VVX 400" — the device model name */
  deviceName?: string;
  /** Derived from extIdList.length */
  deviceCount?: number;
  isDefault?: boolean;
  /** true for company-level custom templates */
  isCompany?: boolean;
  canBeRebooted?: boolean;
  extIdList?: number[];
  lockReason?: string | null;
  [key: string]: unknown;
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function fetchDevices(accountId: number): Promise<Device[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<Device[]>>(
    `/accounts/${accountId}/devices`
  );
  const data = res.data.data;
  if (!Array.isArray(data)) return [];

  // Normalise fields from raw response
  return data.map((d) => {
    const raw = d as Record<string, unknown>;
    const user = (raw.user ?? raw.assignedUser ?? {}) as Record<string, unknown>;
    return {
      ...d,
      macId: String(d.macId ?? raw.mac ?? raw.macAddress ?? ""),
      lastSyncDate: (raw.lastSyncDate ?? raw.lastSync ?? raw.updatedAt ?? null) as string | undefined,
      orderId: (raw.orderId ?? raw.orderid ?? null) as string | undefined,
      status: (raw.status ?? raw.deviceStatus ?? "unknown") as string,
      sipStatus: "unknown" as const,
      assignedUser: user && Object.keys(user).length > 0 ? {
        userId:      user.userId as number | undefined,
        firstName:   user.firstName as string | undefined,
        lastName:    user.lastName as string | undefined,
        extension:   user.extension as string | undefined,
        displayName: user.displayName as string | undefined,
      } : undefined,
    } satisfies Device;
  });
}

/** Fetch extension→user mapping for device assignment display */
export async function fetchDeviceExtensions(accountId: number): Promise<DeviceExtension[]> {
  const api = await getApiClient();
  try {
    const res = await api.get<V1Response<DeviceExtension[]>>(
      `/accounts/${accountId}/devices/extensions`
    );
    const data = res.data.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Fetch SIP registration status from api.n2p.io/v2 */
export async function fetchSipRegistrations(
  limit = 200
): Promise<Array<{ mac_address: string; registration_status: string; extension?: string }>> {
  const api = await getN2pApiClient();
  try {
    const res = await api.get<{
      items: Array<{ mac_address: string; registration_status: string; extension?: string }>;
    }>("/sip-registrations", { params: { limit } });
    return res.data.items ?? [];
  } catch {
    return [];
  }
}

/** Fetch device templates. API returns { data: { system: [], company: [], private: [] } } */
export async function fetchDeviceTemplates(accountId: number): Promise<DeviceTemplate[]> {
  const api = await getApiClient();
  const res = await api.get<{ data: { system?: RawTemplate[]; company?: RawTemplate[]; private?: RawTemplate[] } }>(
    `/accounts/${accountId}/devices/templates`
  );
  const raw = res.data.data ?? {};

  function normalise(items: RawTemplate[], isCompany: boolean): DeviceTemplate[] {
    return (items ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      deviceName: t.deviceName,
      deviceCount: Array.isArray(t.extIdList) ? t.extIdList.length : 0,
      isDefault: !!t.isDefault,
      isCompany,
      canBeRebooted: !!t.canBeRebooted,
      extIdList: t.extIdList,
      lockReason: t.lockReason ?? null,
    }));
  }

  return [
    ...normalise(raw.system ?? [], true),
    ...normalise(raw.company ?? [], true),
    ...normalise(raw.private ?? [], false),
  ];
}

interface RawTemplate {
  id: number;
  name: string;
  deviceName?: string;
  isDefault?: boolean;
  extIdList?: number[];
  canBeRebooted?: boolean;
  lockReason?: string | null;
}

// ── Device orders ─────────────────────────────────────────────────────────────
export interface DeviceOrderTracking {
  id: number;
  orderEntityId: number;
  shipper: string;
  trackingNumber: string;
  trackingLink: string;
  shippingDate: string;
}

export interface DeviceOrder {
  id: number;
  orderId: string;
  acceptanceDate: string;
  submissionDate: string;
  status: string;  // "Delivered" | "Shipped" | "Pending" | "Underway" etc.
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    recipient: string;
  };
  shipping: {
    shipper: string;
    method: string;
  };
  trackingList: DeviceOrderTracking[];
}

const ORDER_STATUSES = ["pending", "underway", "shipped", "delivered"];

export async function fetchDeviceOrders(accountId: number): Promise<DeviceOrder[]> {
  const api = await getApiClient();
  const params = ORDER_STATUSES.reduce<Record<string, string[]>>(
    (acc, s) => { acc["statusList"] = [...(acc["statusList"] ?? []), s]; return acc; },
    {}
  );
  const res = await api.get<V1Response<DeviceOrder[]>>(
    `/accounts/${accountId}/orders`,
    { params, paramsSerializer: (p) => Object.entries(p).flatMap(([k, vs]) => (vs as string[]).map((v) => `${k}=${encodeURIComponent(v)}`)).join("&") }
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

export async function rebootDevice(accountId: number, macId: string): Promise<void> {
  const api = await getApiClient();
  await api.post(`/accounts/${accountId}/devices/${macId}/reboot`, {});
}

export async function createDevice(
  accountId: number,
  payload: CreateDevicePayload
): Promise<Device> {
  const api = await getApiClient();
  const res = await api.post<V1Response<Device>>(
    `/accounts/${accountId}/devices`,
    payload
  );
  return res.data.data;
}

export async function updateDevice(
  accountId: number,
  macId: string,
  payload: Partial<CreateDevicePayload>
): Promise<Device> {
  const api = await getApiClient();
  const res = await api.put<V1Response<Device>>(
    `/accounts/${accountId}/devices/${macId}`,
    payload
  );
  return res.data.data;
}

export async function deleteDevice(
  accountId: number,
  macId: string
): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/devices/${macId}`);
}
