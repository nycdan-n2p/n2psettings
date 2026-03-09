import { getApiClient, type V1Response } from "./api-client";
import { loadEnv } from "./env";

export interface Account {
  accountId: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  company: string;
  timeZone: string;
  clientId: number;
  maxUsers: number;
  maxPhones: number;
  maxSpecialExtensions: number;
  country: string;
  currency: string;
  accountType: string;
  canCreatePhysicalDevices: boolean;
  accountPolicies?: Array<{
    maxUsersDepartment: number;
    maxDepartments: number;
    maxExtensionLength: number;
  }>;
}

export interface User {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  extension: string;
  role: string;
  status: string;
  callerId?: string;
  lineNumber?: string[];
  timeZone?: string;
  voicemailEnabled?: boolean;
  avatars?: Array<{ size: string; url: string }>;
  members?: Array<{ id: number; name: string }>;
}

export interface FeatureFlags {
  [key: string]: boolean;
}

// Raw shape returned by /api/features — Items array, NOT a key/value map
interface RawFeaturesResponse {
  Items?: Array<{ Id: number; Name: string; Flag: boolean; Description?: string }>;
}

export interface License {
  licenseCode?: string;
  code?: string;
  name?: string;
  quantity?: number;
  unlimited?: boolean;
  enabled?: boolean;
}

export interface Plan {
  planId?: number;
  planName?: string;
  planFee?: number;
  name?: string;
  accountPlanStatus?: string;
  nextBillingDate?: string;
  [key: string]: unknown;
}

export interface BootstrapData {
  account: Account;
  user: User;
  features: FeatureFlags;
  licenses: License[];
  plans: Plan[];
  timezones: { id: string; name: string }[];
  unreadVoicemailCount?: number;
}

/**
 * Normalize the raw /api/features response into a flat { [Name]: Flag } map.
 * The API returns { Items: [{ Name: "CallQueue", Flag: true }, ...] }
 * NOT the { [key]: boolean } shape the old code assumed.
 */
function normalizeFeatureFlags(raw: unknown): FeatureFlags {
  if (!raw || typeof raw !== "object") return {};

  // Standard shape: { Items: [...] }
  const asObj = raw as RawFeaturesResponse;
  if (Array.isArray(asObj.Items)) {
    return Object.fromEntries(asObj.Items.map((f) => [f.Name, f.Flag]));
  }

  // Fallback: already a flat key/value map (shouldn't happen but safe)
  if (Object.values(raw as Record<string, unknown>).every((v) => typeof v === "boolean")) {
    return raw as FeatureFlags;
  }

  return {};
}

export async function fetchBootstrap(
  accountId: number,
  userId: number
): Promise<BootstrapData> {
  await loadEnv();
  const api = await getApiClient();

  const [accountRes, userRes, featuresRes, licensesRes, plansRes, timezonesRes] =
    await Promise.all([
      api.get<V1Response<Account>>(`/accounts/${accountId}`),
      api.get<V1Response<User>>(`/accounts/${accountId}/users/${userId}`),
      // /api/features returns { Items: [{Name, Flag}] } — typed as unknown, normalized below
      api.get<V1Response<unknown>>("/features"),
      api.get<V1Response<License[]>>(
        `/accounts/${accountId}/licenses?includePrivate=true`
      ),
      api.get<V1Response<Plan[]>>(`/accounts/${accountId}/plans`),
      api.get<V1Response<{ id: string; name: string }[]>>("/timezones"),
    ]);

  let unreadVoicemailCount = 0;
  try {
    const vmRes = await api.get<
      V1Response<unknown[] | { totalCount?: number; items?: unknown[] }>
    >(
      `/accounts/${accountId}/users/${userId}/voicemails?type=Unread&count=20&sorting=desc`
    );
    const d = vmRes.data.data;
    if (Array.isArray(d)) {
      unreadVoicemailCount = d.length;
    } else if (d && typeof d === "object" && "items" in d) {
      const obj = d as { totalCount?: number; items?: unknown[] };
      unreadVoicemailCount = obj.totalCount ?? (Array.isArray(obj.items) ? obj.items.length : 0);
    }
  } catch {
    // non-fatal — badge simply shows 0
  }

  const account = accountRes.data.data;
  const user = userRes.data.data;

  // Fix: normalize the Items array into a flat { Name: Flag } lookup map
  const features = normalizeFeatureFlags(featuresRes.data.data);

  // Licenses may have either licenseCode or code field depending on API version
  const rawLicenses = Array.isArray(licensesRes.data.data) ? licensesRes.data.data : [];
  const licenses: License[] = rawLicenses.map((l) => ({
    ...l,
    // normalise: surface licenseCode as code if code is missing
    code: (l as { code?: string; licenseCode?: string }).code
      ?? (l as { licenseCode?: string }).licenseCode,
  }));

  const plans = Array.isArray(plansRes.data.data) ? plansRes.data.data : [];
  const timezones = Array.isArray(timezonesRes.data.data)
    ? timezonesRes.data.data
    : [];

  return {
    account,
    user,
    features,
    licenses,
    plans,
    timezones,
    unreadVoicemailCount,
  };
}
