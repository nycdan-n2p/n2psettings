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
 * RFC 9728 — OAuth 2.0 Protected Resource Metadata.
 * MCP clients (e.g. Claude) follow WWW-Authenticate resource_metadata here.
 */
export async function GET(request: NextRequest) {
  const base = publicBaseUrlFromRequest(request);
  const body = {
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp.tools"],
  };
  return NextResponse.json(body, { headers: CORS });
}
