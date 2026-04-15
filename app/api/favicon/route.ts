import { NextResponse } from "next/server";

const FAVICON_URL = "https://settings.net2phone.com/favicon.png?v=2";

/**
 * Serves the net2phone favicon through the same origin so it satisfies
 * the CSP img-src 'self' directive without needing an external domain exception.
 * Response is cached at the CDN edge for 24 hours.
 */
export async function GET() {
  try {
    const upstream = await fetch(FAVICON_URL, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
