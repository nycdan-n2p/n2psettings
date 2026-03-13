import { getApiClient, type V1Response } from "../api-client";

/** Phone number to port, with optional association */
export interface PortingPhoneNumber {
  phoneNumber: string;
  error?: string;
  secondError?: string;
  isValid?: boolean;
  inUsePendingNumbers?: string[];
  /** User to associate this number with (extension/userId) */
  associatedUserId?: number;
}

export interface OnboardProvider {
  serviceProvider: string;
  accountNumber: string;
  providerBtn: string;
  portBtn?: boolean;
  numberTransferPin?: string;
}

export interface OnboardAddress {
  companyName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  firstName: string;
  lastName: string;
  email: string;
  contactPhoneNumber: string;
}

export interface CreateOnboardPayload {
  phoneNumbersModel: {
    phoneNumbers: PortingPhoneNumber[];
    rangePhoneNumbers?: PortingPhoneNumber[];
  };
  targetPortDate: string; // ISO date
  onboardProvider: OnboardProvider;
  onboardAddress: OnboardAddress;
}

export interface PortingOnboard {
  id: number;
  status: string;
  quoteId?: string;
  targetPortDate?: string;
  submittedDate?: string | null;
  onboardProvider?: OnboardProvider;
  onboardAddress?: OnboardAddress;
  phoneNumbersModel?: {
    phoneNumbers: Array<{ phoneNumber: string; status?: string; associatedUserId?: number }>;
  };
  [key: string]: unknown;
}

/** POST /accounts/{id}/porting/onboard - create new port request */
export async function createOnboard(
  accountId: number,
  payload: CreateOnboardPayload
): Promise<PortingOnboard> {
  const api = await getApiClient();
  const res = await api.post<V1Response<PortingOnboard>>(
    `/accounts/${accountId}/porting/onboard`,
    payload
  );
  return res.data.data;
}

/** POST /accounts/{id}/porting/{onboardId}/invoice - upload invoice file */
export async function uploadInvoice(
  accountId: number,
  onboardId: number,
  file: File
): Promise<unknown> {
  const api = await getApiClient();
  const form = new FormData();
  form.append("files", file);
  const res = await api.post<V1Response<unknown>>(
    `/accounts/${accountId}/porting/${onboardId}/invoice`,
    form
  );
  return res.data.data;
}

/** GET /accounts/{id}/porting/{onboardId}/sign/links - get signNow LOA link */
export interface SignLink {
  link: string;
  documentId: string;
}

export async function fetchSignLinks(
  accountId: number,
  onboardId: number
): Promise<SignLink[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<SignLink[]>>(
    `/accounts/${accountId}/porting/${onboardId}/sign/links`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

/** GET /accounts/{id}/porting/onboards - list port requests */
export async function fetchOnboards(accountId: number): Promise<PortingOnboard[]> {
  const api = await getApiClient();
  const res = await api.get<V1Response<PortingOnboard[]>>(
    `/accounts/${accountId}/porting/onboards`
  );
  const data = res.data.data;
  return Array.isArray(data) ? data : [];
}

/** POST /phonenumbers/phone-numbers-in-use - validate numbers (legacy uses this) */
export async function checkPhoneNumbersInUse(
  phoneNumbers: string[]
): Promise<{ inUse?: Record<string, string[]> }> {
  const api = await getApiClient();
  const res = await api.post<{ inUse?: Record<string, string[]> }>(
    "/phonenumbers/phone-numbers-in-use",
    phoneNumbers
  );
  return res.data ?? {};
}
