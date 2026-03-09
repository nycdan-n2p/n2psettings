import { getApiClient, type V1Response } from "../api-client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CatalogPhoneNumber {
  phoneNumber: string;       // e.g. "+16094299074"
  routeToId?: number | null;
  routeType?: string | null; // "user" | "department" | "welcomeMenu" | null
  applicationId?: string | null;
  forbiddenAsCallerId?: boolean;
  porting?: boolean;
}

export interface AccountPhoneNumber {
  phoneNumber: string;
  extension?: string;
  userId?: number | null;
  userName?: string | null;
  deptId?: number | null;
  deptName?: string | null;
  routeType?: string | null;
  [key: string]: unknown;
}

export interface NewUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  extension: string;
  role: "admin" | "user";
  timeZone: string;
  voicemailEnabled?: boolean;
  businessClass?: string;
}

export interface CreatedUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  extension: string;
  role: string;
  [key: string]: unknown;
}

export interface NewDepartmentPayload {
  name: string;
  extension: string;
  businessClass?: string;
}

export interface CreatedDepartment {
  deptId: number;
  name: string;
  extension: string;
  [key: string]: unknown;
}

// ─── Phone Numbers ────────────────────────────────────────────────────────────

/**
 * Get all phone numbers in the account pool (catalog).
 * These include both assigned and unassigned numbers.
 */
export async function fetchCatalogNumbers(clientId: number): Promise<CatalogPhoneNumber[]> {
  const api = await getApiClient();
  try {
    const res = await api.get<V1Response<CatalogPhoneNumber[]> | CatalogPhoneNumber[]>(
      `/catalogs/${clientId}/phone-numbers`
    );
    const d = res.data;
    // Handle both V1 envelope and bare array
    if (Array.isArray(d)) return d;
    const envelope = d as V1Response<CatalogPhoneNumber[]>;
    return Array.isArray(envelope?.data) ? envelope.data : [];
  } catch {
    return [];
  }
}

/**
 * Get phone numbers currently active on the account with routing info.
 * Filter for unassigned (no user or dept routing) to find available numbers.
 */
export async function fetchAccountNumbers(accountId: number): Promise<AccountPhoneNumber[]> {
  const api = await getApiClient();
  try {
    const res = await api.get<V1Response<AccountPhoneNumber[]>>(
      `/accounts/${accountId}/phonenumbers`
    );
    const data = res.data.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Phone number stats — how many are in use vs available.
 */
export async function fetchPhoneNumberStats(accountId: number): Promise<{
  maxPhoneNumbers: number;
  phoneNumbersInUse: number;
  unUsedPhones: number;
} | null> {
  const api = await getApiClient();
  try {
    const res = await api.get<V1Response<{
      maxPhoneNumbers: number;
      phoneNumbersInUse: number;
      unUsedPhones: number;
    }>>(`/accounts/${accountId}/phonenumbers/stats`);
    return res.data.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Filter account numbers to those NOT yet routed to a user or department.
 * These are the numbers available to assign to new team members.
 */
export function getUnassignedNumbers(numbers: AccountPhoneNumber[]): AccountPhoneNumber[] {
  return numbers.filter((n) => {
    const rt = n.routeType?.toLowerCase?.() ?? "";
    return !n.userId && !n.deptId && rt !== "user" && rt !== "department";
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * Fetch all users and compute the next available extension (max + 1).
 * Falls back to "200" if no users found.
 */
export async function fetchNextUserExtension(accountId: number): Promise<string> {
  const api = await getApiClient();
  try {
    const res = await api.get<V1Response<Array<{ extension?: string }>>>(
      `/accounts/${accountId}/users`,
      { params: { includeLineNumbersFlag: "N", includeDepartmentUser: false } }
    );
    const users = Array.isArray(res.data.data) ? res.data.data : [];
    const extensions = users
      .map((u) => parseInt(u.extension ?? "0", 10))
      .filter((n) => !isNaN(n) && n > 0);
    if (extensions.length === 0) return "200";
    return String(Math.max(...extensions) + 1);
  } catch {
    return "200";
  }
}

/**
 * Create a new team member on the account.
 * POST /api/accounts/{accountId}/users
 */
export async function createUser(
  accountId: number,
  payload: NewUserPayload
): Promise<CreatedUser> {
  const api = await getApiClient();
  const res = await api.post<V1Response<CreatedUser>>(
    `/accounts/${accountId}/users`,
    {
      ...payload,
      voicemailEnabled: payload.voicemailEnabled ?? true,
      businessClass: payload.businessClass ?? "US",
    }
  );
  if (res.data.hasError) {
    throw new Error(
      res.data.errorMessages?.join(", ") ?? "Failed to create user"
    );
  }
  return res.data.data;
}

/**
 * Assign a phone number (DID) to an existing user.
 * PATCH /api/accounts/{accountId}/users/{userId}
 */
export async function assignPhoneNumberToUser(
  accountId: number,
  userId: number,
  phoneNumber: string
): Promise<void> {
  const api = await getApiClient();
  // Normalise: strip leading + if present; API expects E.164 without +
  const normalised = phoneNumber.replace(/^\+/, "");
  await api.patch(`/accounts/${accountId}/users/${userId}`, {
    lineNumber: [normalised],
  });
}

// ─── Departments ──────────────────────────────────────────────────────────────

/**
 * Create a new department.
 * POST /api/accounts/{accountId}/departments
 */
export async function createDepartment(
  accountId: number,
  payload: NewDepartmentPayload
): Promise<CreatedDepartment> {
  const api = await getApiClient();
  const res = await api.post<V1Response<CreatedDepartment>>(
    `/accounts/${accountId}/departments`,
    { ...payload, businessClass: payload.businessClass ?? "US" }
  );
  if (res.data.hasError) {
    throw new Error(
      res.data.errorMessages?.join(", ") ?? "Failed to create department"
    );
  }
  return res.data.data;
}

/**
 * Get the next available department extension.
 */
export async function fetchNextDepartmentExtension(accountId: number): Promise<string> {
  const api = await getApiClient();
  try {
    const res = await api.get<V1Response<string>>(
      `/account/${accountId}/extensions/department/next`
    );
    return res.data.data ?? "300";
  } catch {
    return "300";
  }
}
