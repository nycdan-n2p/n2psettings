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

// ─── Request handler ──────────────────────────────────────────────────────────

async function handleMCP(request: NextRequest): Promise<Response> {
  // Extract Bearer token
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();

  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization header. Pass: Authorization: Bearer <your-n2p-token>" },
      { status: 401 }
    );
  }

  // Optional overrides via headers
  const accountIdHeader = request.headers.get("x-account-id");
  const sipClientIdHeader = request.headers.get("x-sip-client-id");

  const ctx = {
    token,
    accountId: accountIdHeader
      ? Number(accountIdHeader)
      : process.env.N2P_DEFAULT_ACCOUNT_ID
      ? Number(process.env.N2P_DEFAULT_ACCOUNT_ID)
      : undefined,
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
  return transport.handleRequest(request);
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
export async function DELETE(_request: NextRequest) {
  return new Response(null, { status: 200 });
}
