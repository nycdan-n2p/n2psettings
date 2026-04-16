/**
 * net2phone MCP Server — Vercel HTTP endpoint
 *
 * Uses the MCP Streamable HTTP transport (stateless mode).
 * Each request creates a fresh Server instance — no session state stored.
 *
 * Authentication:
 *   Pass the net2phone Bearer token in the Authorization header:
 *     Authorization: Bearer <your-n2p-jwt-token>
 *
 *   MCP OAuth clients (e.g. Claude connector): unauthenticated requests receive 401 with
 *   WWW-Authenticate pointing at /.well-known/oauth-protected-resource; that JSON links to
 *   /.well-known/oauth-authorization-server so the client can run the OAuth flow.
 *
 * Optional headers:
 *   X-Account-Id:    Override the default UCaaS account ID
 *   X-Sip-Client-Id: Override the default SIP trunk account ID
 *
 * Env vars (used as defaults when headers are not provided):
 *   N2P_DEFAULT_ACCOUNT_ID   — default account ID
 *   N2P_DEFAULT_SIP_CLIENT_ID — default SIP trunk account ID
 *
 * Claude Desktop config for remote HTTP:
 * {
 *   "mcpServers": {
 *     "net2phone": {
 *       "url": "https://your-app.vercel.app/api/mcp",
 *       "headers": {
 *         "Authorization": "Bearer <token>",
 *         "X-Account-Id": "1017456"
 *       }
 *     }
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createN2PMCPServer } from "@/lib/mcp/server";

// Allow long-running tool calls (Vercel Pro: 60s, Hobby: 10s)
export const maxDuration = 60;

// ─── Refresh token → access token ─────────────────────────────────────────────

const N2P_AUTH_URL = "https://auth.net2phone.com/connect/token";

async function exchangeRefreshToken(refreshToken: string): Promise<string | null> {
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
    const data = await res.json() as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// ─── CORS headers (required for Claude connector UI) ──────────────────────────
const BASE_URL = "https://n2psettings.vercel.app";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Account-Id, X-Sip-Client-Id, Mcp-Session-Id",
};

// WWW-Authenticate header tells OAuth clients where to find auth server metadata
const WWW_AUTH = `Bearer realm="${BASE_URL}", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`;

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

  // ?refreshToken= → exchange for a fresh access token every request (long-lived)
  // ?token=        → use directly as access token (expires in ~1hr)
  // Bearer header  → if it doesn't look like a JWT (no "eyJ" prefix), treat as refresh token
  const refreshParam = url.searchParams.get("refreshToken");
  let token = tokenFromHeader || url.searchParams.get("token") || "";

  // Auto-detect refresh tokens: JWTs start with "eyJ", anything else is a refresh token
  const isRefreshToken = (t: string) => t.length > 0 && !t.startsWith("eyJ");

  const rawRefresh = refreshParam || (isRefreshToken(token) ? token : null);
  if (rawRefresh) {
    const exchanged = await exchangeRefreshToken(rawRefresh);
    if (!exchanged) {
      return NextResponse.json(
        { error: "Failed to exchange refresh token. It may be expired or revoked." },
        { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": WWW_AUTH } }
      );
    }
    token = exchanged;
  }

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": WWW_AUTH } }
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
