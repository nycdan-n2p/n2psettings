import { NextRequest, NextResponse } from "next/server";

// Proxies requests to auth.net2phone.com/api
// Forwards the Bearer token so we don't need cookie-based auth.
const N2P_AUTH_BASE =
  (process.env.N2P_API_AUTH_URL ?? "https://auth.net2phone.com").replace(/\/$/, "");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

async function proxyRequest(
  request: NextRequest,
  { path }: { path: string[] }
) {
  const pathStr = path.join("/");
  const url = new URL(request.url);
  const targetUrl = `${N2P_AUTH_BASE}/api/${pathStr}${url.search}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-accept-version": "v1.1",
    "x-application-name": "Unite",
    "x-client-trace-id": crypto.randomUUID().replace(/-/g, ""),
    Accept: "application/json, text/plain, */*",
  };

  const auth = request.headers.get("authorization");
  if (auth) {
    headers["Authorization"] = auth;
  }

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text();
    } catch {
      // ignore
    }
  }

  try {
    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body || undefined,
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth proxy error";
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : undefined;
    console.error("[proxy/auth] fetch failed:", targetUrl, msg, cause ?? "");
    return NextResponse.json(
      {
        error: msg,
        ...(process.env.NODE_ENV === "development" && cause ? { cause } : {}),
      },
      { status: 500 }
    );
  }
}
