export const UPLOAD_LIMIT = 30;
export const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
export const RECONSTRUCTION_LIMIT = 20;
export const RECONSTRUCTION_WINDOW_MS = 10 * 60 * 1000;
export const TRACE_LIMIT = 20;
export const TRACE_WINDOW_MS = 10 * 60 * 1000;
export const JOB_BUDGET_MS = 90_000;
export const MAX_PIXELS = 4096 * 4096;

const buckets = new Map<string, number[]>();

export function takeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    const oldest = recent[0] ?? now;
    return { ok: false as const, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { ok: true as const };
}

export function resetRateLimits() {
  buckets.clear();
}

export function isResourceId(value: string) {
  return /^[A-Za-z0-9_-]{1,80}$/.test(value);
}

export function rateLimited(message: string, retryAfterSeconds: number) {
  return Response.json(
    { error: { code: "rate_limited", message } },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}
