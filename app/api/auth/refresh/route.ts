import { NextRequest, NextResponse } from "next/server";

const AUTH_URL = "https://auth.net2phone.com";
const CLIENT_ID = process.env.N2P_OAUTH_CLIENT_ID ?? "unite.webapp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = (body as { refresh_token?: string }).refresh_token;
    const refresh_token = typeof raw === "string" ? raw.trim() : "";
    if (!refresh_token) {
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.append("client_id", CLIENT_ID);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refresh_token);

    const res = await fetch(`${AUTH_URL}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await res.json()) as {
      error?: string;
      error_description?: string;
      access_token?: string;
      [key: string]: unknown;
    };

    if (!res.ok) {
      const errCode = data.error;
      let message = data.error_description ?? "Authentication failed";
      if (errCode === "invalid_grant") {
        message =
          "Refresh token is invalid or expired. Get a fresh token from app.net2phone.com: DevTools → Application → Local Storage → n2p_refresh_token";
      } else if (errCode === "invalid_client") {
        message = "OAuth client configuration error";
      }
      return NextResponse.json({ error: message }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
