import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { loadEnv, getEnv } from "./env";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isTokenExpired,
  type TokenResponse,
} from "./auth";

function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

let apiClient: AxiosInstance | null = null;
let v2ApiClient: AxiosInstance | null = null;
let n2pApiClient: AxiosInstance | null = null;
let authClient: AxiosInstance | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const url =
    typeof window !== "undefined"
      ? "/api/auth/refresh"
      : `${getEnv().N2P_API_AUTH_URL.replace(/\/$/, "")}/connect/token`;

  const body =
    typeof window !== "undefined"
      ? JSON.stringify({ refresh_token: refreshToken })
      : new URLSearchParams({
          client_id: "unite.webapp",
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }).toString();

  const res = await fetch(url, {
    method: "POST",
    headers:
      typeof window !== "undefined"
        ? { "Content-Type": "application/json" }
        : { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data: TokenResponse = await res.json();
  setTokens(data);
  return data.access_token;
}

function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    // 30 s default — prevents hanging requests from blocking the UI indefinitely.
    // Individual call sites can override this via config.timeout.
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json",
      "x-accept-version": "v1.1",
      "x-application-name": "Unite",
      Accept: "application/json, text/plain, */*",
    },
  });

  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      config.headers["x-client-trace-id"] = generateTraceId();
      let token = getAccessToken();
      if (token && isTokenExpired()) {
        token = await refreshAccessToken();
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (err) => Promise.reject(err)
  );

  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      const original = err.config;
      if (err.response?.status === 401 && !original._retry) {
        original._retry = true;
        const token = await refreshAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        }
      }
      return Promise.reject(err);
    }
  );

  return client;
}

export async function getApiClient(): Promise<AxiosInstance> {
  await loadEnv();
  if (!apiClient) {
    const base =
      typeof window !== "undefined"
        ? "/api/proxy"
        : `${getEnv().N2P_API_URL.replace(/\/$/, "")}/api`;
    apiClient = createApiClient(base);
  }
  return apiClient;
}

export async function getV2ApiClient(): Promise<AxiosInstance> {
  await loadEnv();
  if (!v2ApiClient) {
    const base =
      typeof window !== "undefined"
        ? "/api/proxy-v2"
        : getEnv().N2P_API_V2_URL.replace(/\/$/, "");
    v2ApiClient = createApiClient(base);
  }
  return v2ApiClient;
}

/** Client for api.n2p.io/v2 — sip-registrations, sip-trunks, etc. */
export async function getN2pApiClient(): Promise<AxiosInstance> {
  await loadEnv();
  if (!n2pApiClient) {
    const base =
      typeof window !== "undefined"
        ? "/api/proxy-n2p"
        : "https://api.n2p.io/v2";
    n2pApiClient = createApiClient(base);
  }
  return n2pApiClient;
}

export async function getAuthApiClient(): Promise<AxiosInstance> {
  await loadEnv();
  if (!authClient) {
    // Browser: proxy through Next.js to avoid CORS on auth.net2phone.com
    // Server: call auth.net2phone.com directly
    const base =
      typeof window !== "undefined"
        ? "/api/proxy-auth"
        : `${getEnv().N2P_API_AUTH_URL.replace(/\/$/, "")}/api`;
    authClient = createApiClient(base);
  }
  return authClient;
}

export interface V1Response<T> {
  hasError: boolean;
  data: T;
  errorMessages?: string[];
  errorType?: number;
}

export interface V2PaginatedResponse<T> {
  items: T[];
  after?: string | null;
  before?: string | null;
  has_after?: boolean;
  has_before?: boolean;
}
