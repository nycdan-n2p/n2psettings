/**
 * SSRF Guard — blocks Server-Side Request Forgery attempts.
 *
 * Rejects URLs that resolve to private/loopback/link-local IP ranges,
 * metadata endpoints, and non-HTTP(S) schemes.
 *
 * Apply this before any server-side fetch of a user-supplied URL.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254", // AWS/GCP/Azure instance metadata
]);

// RFC-1918 and other private / special-use CIDR ranges
const PRIVATE_PREFIXES = [
  "10.",
  "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",
  "127.",
  "0.",
  "::1",
  "fc00:",
  "fd",
  "fe80:",
];

export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
}

export function checkSsrf(rawUrl: string): SsrfCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  // Only allow http and https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: `Disallowed scheme: ${parsed.protocol}` };
  }

  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "Blocked hostname" };
  }

  for (const prefix of PRIVATE_PREFIXES) {
    if (host.startsWith(prefix)) {
      return { ok: false, reason: "Private/internal address not allowed" };
    }
  }

  // Block numeric IP addresses outside public ranges as a catch-all
  const isNumericIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isNumericIp) {
    const parts = host.split(".").map(Number);
    if (
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254)
    ) {
      return { ok: false, reason: "Private IP address not allowed" };
    }
  }

  return { ok: true };
}
