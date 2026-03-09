import { NextRequest, NextResponse } from "next/server";

const AUTH_URL = "https://auth.net2phone.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body;
    if (!refresh_token) {
      return NextResponse.json(
        { error: "refresh_token required" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.append("client_id", "unite.webapp");
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refresh_token);

    const res = await fetch(`${AUTH_URL}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
