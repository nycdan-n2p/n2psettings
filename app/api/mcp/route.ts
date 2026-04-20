/**
 * net2phone MCP — Vercel HTTP (Streamable HTTP, stateless).
 *
 * Login is the same as the web app: the user’s net2phone refresh token from the browser
 * (`n2p_refresh_token`). The server exchanges it for an access token and calls net2phone APIs.
 *
 * Typical connector URL:
 *   /api/mcp?refreshToken=...&accountId=...
 *
 * Also supported: Authorization Bearer (refresh or access JWT), OAuth discovery (401 →
 * /.well-known/*), optional X-Account-Id / X-Sip-Client-Id, env N2P_DEFAULT_*.
 *
 * User-facing steps: /claude-mcp
 */

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createN2PMCPServer } from "@/lib/mcp/server";
import { publicBaseUrlFromRequest } from "@/lib/mcp/public-base-url";

// Allow long-running tool calls (Vercel Pro: 60s, Hobby: 10s)
export const maxDuration = 60;

// ─── Refresh token → access token (cached per warm instance) ─────────────────

const N2P_AUTH_URL = "https://auth.net2phone.com/connect/token";

/** Reuse access tokens until near expiry; cuts OAuth traffic on burst MCP calls. */
const CACHE_SKEW_MS = 60_000;
const DEFAULT_ACCESS_TTL_SEC = 3600;

const refreshTokenCache = new Map<
  string,
  { accessToken: string; expiresAtMs: number }
>();

function refreshCacheKey(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function jwtExpMs(accessToken: string): number | null {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(
      Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    ) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Calls net2phone OAuth token endpoint (refresh_token grant). Uncached.
 */
async function fetchAccessTokenWithRefreshGrant(
  refreshToken: string
): Promise<{ accessToken: string; expiresAtMs: number } | null> {
  try {
    const res = await fetch(N2P_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "unite.webapp",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    const accessToken = data.access_token;
    if (!accessToken) return null;

    const now = Date.now();
    const fromOAuthSec = data.expires_in ?? DEFAULT_ACCESS_TTL_SEC;
    let expiresAtMs = now + fromOAuthSec * 1000 - CACHE_SKEW_MS;
    const jwtEnd = jwtExpMs(accessToken);
    if (jwtEnd !== null) {
      expiresAtMs = Math.min(expiresAtMs, jwtEnd - CACHE_SKEW_MS);
    }
    if (expiresAtMs <= now) {
      expiresAtMs = now + 30_000;
    }
    return { accessToken, expiresAtMs };
  } catch {
    return null;
  }
}

async function exchangeRefreshToken(refreshToken: string): Promise<string | null> {
  const key = refreshCacheKey(refreshToken);
  const now = Date.now();
  const hit = refreshTokenCache.get(key);
  if (hit && hit.expiresAtMs > now) {
    return hit.accessToken;
  }

  const fresh = await fetchAccessTokenWithRefreshGrant(refreshToken);
  if (!fresh) return null;

  refreshTokenCache.set(key, {
    accessToken: fresh.accessToken,
    expiresAtMs: fresh.expiresAtMs,
  });
  return fresh.accessToken;
}

// ─── CORS headers (required for Claude connector UI) ──────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, X-Account-Id, X-Sip-Client-Id, Mcp-Session-Id",
};

function wwwAuthenticateHeader(request: NextRequest): string {
  const base = publicBaseUrlFromRequest(request);
  return `Bearer realm="${base}", resource_metadata="${base}/.well-known/oauth-protected-resource"`;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── Request handler ──────────────────────────────────────────────────────────

async function handleMCP(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization") ?? "";
  const tokenFromHeader = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  // ?refreshToken= → opaque token: exchange each request. JWT in this param is treated as access token (connector UX).
  // ?token=        → use directly as access JWT (~1hr)
  // Bearer        → JWT or opaque refresh (exchanged if opaque)
  const refreshParam = url.searchParams.get("refreshToken");
  let token = tokenFromHeader || url.searchParams.get("token") || "";

  if (refreshParam?.startsWith("eyJ")) {
    if (!token) token = refreshParam;
  } else if (refreshParam) {
    const exchanged = await exchangeRefreshToken(refreshParam);
    if (!exchanged) {
      return NextResponse.json(
        { error: "Failed to exchange refresh token. It may be expired or revoked." },
        { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": wwwAuthenticateHeader(request) } }
      );
    }
    token = exchanged;
  } else if (token && !token.startsWith("eyJ")) {
    const exchanged = await exchangeRefreshToken(token);
    if (!exchanged) {
      return NextResponse.json(
        { error: "Failed to exchange refresh token. It may be expired or revoked." },
        { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": wwwAuthenticateHeader(request) } }
      );
    }
    token = exchanged;
  }

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": wwwAuthenticateHeader(request) } }
    );
  }

  // If the caller passed a refresh token but no explicit account/sip IDs,
  // decode them from the freshly issued access token JWT claims
  const autoAccountId = (() => {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
      ) as Record<string, unknown>;
      const id = payload["aid"] ?? payload["accountId"] ?? payload["account_id"];
      return id ? Number(id) : undefined;
    } catch { return undefined; }
  })();

  // Optional overrides via headers OR query params
  const accountIdHeader =
    request.headers.get("x-account-id") ?? url.searchParams.get("accountId");
  const sipClientIdHeader =
    request.headers.get("x-sip-client-id") ?? url.searchParams.get("sipClientId");

  const ctx = {
    token,
    accountId: accountIdHeader
      ? Number(accountIdHeader)
      : process.env.N2P_DEFAULT_ACCOUNT_ID
      ? Number(process.env.N2P_DEFAULT_ACCOUNT_ID)
      : autoAccountId,
    sipClientId: sipClientIdHeader ?? process.env.N2P_DEFAULT_SIP_CLIENT_ID,
  };

  // Create a stateless transport (no session ID, no state between requests)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  // Create server with this request's context
  const server = createN2PMCPServer(ctx);
  await server.connect(transport);

  // Handle the MCP request and return the response
  const response = await transport.handleRequest(request);
  // Attach CORS headers to every MCP response
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

// All MCP traffic goes through POST (stateless Streamable HTTP)
export async function POST(request: NextRequest) {
  return handleMCP(request);
}

// GET for SSE streaming (optional — some MCP clients use this)
export async function GET(request: NextRequest) {
  return handleMCP(request);
}

// DELETE for session cleanup (no-op in stateless mode, but required by spec)
export async function DELETE() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}
