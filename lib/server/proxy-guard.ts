/**
 * Proxy Guard — validates path segments before forwarding to upstream APIs.
 *
 * Prevents path traversal attacks (../../etc/passwd) and ensures only
 * safe characters reach the upstream service.
 */

export interface PathCheckResult {
  ok: boolean;
  reason?: string;
  sanitized?: string;
}

/**
 * Validates and sanitizes a path segment array produced by a Next.js
 * catch-all route ([...path]).
 *
 * Rules:
 * - No empty segments after join
 * - No path traversal sequences (.. or .)
 * - Only URL-safe characters: alphanumeric, -, _, ., ~, %, +, =, @, :
 * - Max total path length: 512 characters
 */
export function checkProxyPath(segments: string[]): PathCheckResult {
  if (!segments || segments.length === 0) {
    return { ok: false, reason: "Empty path" };
  }

  for (const seg of segments) {
    if (seg === ".." || seg === ".") {
      return { ok: false, reason: "Path traversal not allowed" };
    }
    if (!/^[\w\-._~%+@:,!$&'()*=]+$/.test(seg)) {
      return { ok: false, reason: `Unsafe path segment: ${seg}` };
    }
  }

  const joined = segments.join("/");
  if (joined.length > 512) {
    return { ok: false, reason: "Path too long" };
  }

  return { ok: true, sanitized: joined };
}
