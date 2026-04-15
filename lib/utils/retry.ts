export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  shouldRetry: () => true,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === opts.maxRetries || !opts.shouldRetry(err)) throw err;
      const delay = Math.min(opts.baseDelayMs * 2 ** attempt, opts.maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }

  throw lastError;
}

export function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"))) return true;
  if (err instanceof Error && "status" in err) {
    const status = (err as { status: number }).status;
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
  return false;
}
