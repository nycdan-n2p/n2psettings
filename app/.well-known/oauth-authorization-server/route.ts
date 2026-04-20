import { NextRequest, NextResponse } from "next/server";
import { publicBaseUrlFromRequest } from "@/lib/mcp/public-base-url";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata.
 * Points MCP OAuth clients at our paste-token authorize + token endpoints.
 */
export async function GET(request: NextRequest) {
  const base = publicBaseUrlFromRequest(request);
  const body = {
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    code_challenge_methods_supported: ["S256", "plain"],
  };
  return NextResponse.json(body, { headers: CORS });
}
