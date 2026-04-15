import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * OAuth 2.0 Token Endpoint
 *
 * Claude calls this after receiving the auth code from the authorize redirect.
 * The "code" is a base64url-encoded refresh token — we decode it and return
 * it as the access_token. The MCP route then uses it as a refresh token to
 * get a real net2phone access token on each request.
 */
export async function POST(request: NextRequest) {
  let code: string | null = null;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text();
    const params = new URLSearchParams(body);
    code = params.get("code");
  } else {
    try {
      const body = await request.json() as Record<string, string>;
      code = body.code ?? null;
    } catch {
      code = null;
    }
  }

  if (!code) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing code parameter" },
      { status: 400, headers: CORS }
    );
  }

  // Decode the refresh token from the code (base64url)
  let refreshToken: string;
  try {
    const padded = code.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (padded.length % 4)) % 4;
    refreshToken = Buffer.from(padded + "=".repeat(pad), "base64").toString("utf-8");
  } catch {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Invalid code" },
      { status: 400, headers: CORS }
    );
  }

  // Return the refresh token as the "access_token" — the MCP route knows to
  // treat non-JWT tokens as refresh tokens and exchange them automatically.
  return NextResponse.json(
    {
      access_token: refreshToken,
      token_type: "bearer",
      // Large expiry — we refresh the underlying n2p token on every MCP call anyway
      expires_in: 3600 * 24 * 365,
    },
    { headers: CORS }
  );
}
