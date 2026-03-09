const ACCESS_TOKEN_KEY = "n2p_access_token";
const REFRESH_TOKEN_KEY = "n2p_refresh_token";
const TOKEN_EXPIRY_KEY = "n2p_token_expiry";

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(response: TokenResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token);
  const expiry = Date.now() + response.expires_in * 1000;
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
  if (response.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
  }
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

export function isTokenExpired(): boolean {
  if (typeof window === "undefined") return true;
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  return Date.now() >= parseInt(expiry, 10) - 60000;
}

export function hasAuth(): boolean {
  return !!getAccessToken();
}

/**
 * Decode a JWT token and return its payload claims.
 * Does NOT verify the signature — reading claims only.
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface TokenClaims {
  accountId: number | null;
  userId: number | null;
  clientId: number | null;
  email: string | null;
  role: string | null;
}

/**
 * Extract n2p-specific claims from the stored access token.
 * Tries multiple claim name variants (exact name differs by environment).
 * Falls back to NEXT_PUBLIC_ env vars so the app can be configured without a code change.
 */
export function getTokenClaims(): TokenClaims {
  const token = getAccessToken();
  const claims = token ? decodeJwtPayload(token) : {};

  const pick = (...keys: string[]): number | null => {
    for (const k of keys) {
      const v = claims[k];
      if (v !== undefined && v !== null) {
        const n = Number(v);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return null;
  };

  const pickStr = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = claims[k];
      if (typeof v === "string" && v) return v;
    }
    return null;
  };

  const envNum = (key: string): number | null => {
    if (typeof process === "undefined") return null;
    const val = process.env[key];
    if (!val) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  const accountId =
    pick("accountId", "account_id", "AccountId", "account") ??
    envNum("NEXT_PUBLIC_ACCOUNT_ID");

  // sub is the standard OIDC subject — some issuers put userId there
  const userId =
    pick("userId", "user_id", "UserId") ??
    envNum("NEXT_PUBLIC_USER_ID") ??
    pick("sub");

  const clientId =
    pick("clientId", "client_id", "ClientId") ??
    envNum("NEXT_PUBLIC_CLIENT_ID");

  const email = pickStr("email", "Email", "preferred_username");
  const role = pickStr("role", "Role");

  return { accountId, userId, clientId, email, role };
}
