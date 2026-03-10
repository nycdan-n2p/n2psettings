import { NextRequest, NextResponse } from "next/server";

const AUTH_URL = "https://auth.net2phone.com";
const CLIENT_ID = process.env.N2P_OAUTH_CLIENT_ID ?? "unite.webapp";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.append("client_id", CLIENT_ID);
    params.append("grant_type", "password");
    params.append("username", username);
    params.append("password", password);
    params.append("scope", "offline_access openid profile");

    const res = await fetch(`${AUTH_URL}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      // Translate OAuth error codes into human-readable messages
      const errCode = (data as { error?: string }).error;
      let message = "Authentication failed";
      if (errCode === "invalid_grant") message = "Incorrect email or password";
      else if (errCode === "invalid_client") message = "OAuth client configuration error";
      else if (errCode === "unsupported_grant_type") message = "Password login is not supported — use refresh token";
      else if (typeof data.error_description === "string") message = data.error_description;
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
