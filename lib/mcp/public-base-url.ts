import type { NextRequest } from "next/server";

/**
 * Public origin for this deployment (Vercel sets x-forwarded-* headers).
 */
export function publicBaseUrlFromHeaders(headers: Headers): string {
  const host =
    headers.get("x-forwarded-host") ??
    headers.get("host") ??
    "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function publicBaseUrlFromRequest(request: NextRequest): string {
  return publicBaseUrlFromHeaders(request.headers);
}
