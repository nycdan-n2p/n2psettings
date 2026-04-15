import { NextResponse } from "next/server";

const BASE = "https://n2psettings.vercel.app";

export async function GET() {
  return NextResponse.json({
    issuer: BASE,
    authorization_endpoint: `${BASE}/api/oauth/authorize`,
    token_endpoint: `${BASE}/api/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}
