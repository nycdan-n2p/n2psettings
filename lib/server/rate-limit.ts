/**
 * In-memory sliding-window rate limiter.
 *
 * NOTE: This implementation is per-instance. On a multi-instance deployment
 * (e.g. Vercel's serverless edge) each function instance has its own counter.
 * For production multi-instance rate limiting, replace the store with
 * Upstash Redis (@upstash/ratelimit) — a 5-line change.
 *
 * Usage:
 *   const { allowed, retryAfterSec } = checkRateLimit(ip, "ai", 10, 60);
 *   if (!allowed) return NextResponse.json({ error: "Too many requests" }, {
 *     status: 429,
 *     headers: { "Retry-After": String(retryAfterSec) },
 *   });
 */

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

// namespace → key → window
const store = new Map<string, Map<string, Window>>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key       Identifier to rate-limit (e.g. IP address or account ID)
 * @param namespace Bucket name (e.g. "ai", "porting") — prevents cross-route collisions
 * @param limit     Max requests allowed per window
 * @param windowSec Window duration in seconds
 */
export function checkRateLimit(
  key: string,
  namespace: string,
  limit: number,
  windowSec: number
): RateLimitResult {
  if (!store.has(namespace)) store.set(namespace, new Map());
  const ns = store.get(namespace)!;

  const now = Date.now();
  const existing = ns.get(key);

  if (!existing || now >= existing.resetAt) {
    ns.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfterSec: 0 };
}

/** Extract a best-effort client identifier from a Next.js request. */
export function getClientKey(req: { headers: { get: (k: string) => string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
