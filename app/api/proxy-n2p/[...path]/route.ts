import { NextRequest, NextResponse } from "next/server";

// Routes to api.n2p.io/v2 — used for sip-registrations, sip-trunks, etc.
// (Distinct from proxy-v2 which routes to app.net2phone.com/api/v2 for call-queues)
const N2P_BASE = "https://api.n2p.io/v2";

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

export async function PATCH(
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
  const targetUrl = `${N2P_BASE}/${pathStr}${url.search}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-accept-version": "v1.1",
    "x-application-name": "Unite",
    "x-client-trace-id": crypto.randomUUID().replace(/-/g, ""),
    Accept: "application/json, text/plain, */*",
  };

  const auth = request.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try { body = await request.text(); } catch { /* ignore */ }
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
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Proxy error";
    console.error("[proxy/n2p] fetch failed:", targetUrl, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
