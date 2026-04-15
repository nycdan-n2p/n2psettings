/**
 * Server-side JWT utilities.
 *
 * These functions only decode the payload — they do NOT verify the signature.
 * Signature verification is delegated to the net2phone auth service.
 * Used exclusively in API route handlers (Node.js runtime).
 */

export interface JwtClaims {
  accountId: number | null;
  clientId: number | null;
  sipClientId: string | null;
  userId: number | null;
  email: string | null;
  role: string | null;
}

/** Decode a JWT payload without verifying the signature. */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function pickNumber(claims: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = claims[k];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

function pickString(claims: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = claims[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

/** Extract all known n2p-specific claims from a decoded payload. */
export function extractClaims(claims: Record<string, unknown>): JwtClaims {
  return {
    accountId:   pickNumber(claims, "aid", "accountId", "account_id", "AccountId", "account"),
    clientId:    pickNumber(claims, "cid", "clientId", "client_id", "ClientId"),
    sipClientId: pickString(claims, "sipClientId", "sip_client_id"),
    userId:      pickNumber(claims, "uid", "userId", "user_id", "UserId"),
    email:       pickString(claims, "email", "Email", "preferred_username"),
    role:        pickString(claims, "role", "Role"),
  };
}

/**
 * Parse a Bearer token from an Authorization header value and return
 * the decoded claims.  Returns null if the header is missing or malformed.
 */
export function claimsFromAuthHeader(authHeader: string | null): JwtClaims | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = decodeJwtPayload(token);
  return extractClaims(payload);
}

/**
 * Convenience: extract the raw token string from an Authorization header.
 * Returns null if missing or malformed.
 */
export function tokenFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
