type RateEntry = { count: number; resetAt: number };

const globalRateStore = globalThis as typeof globalThis & {
  __imageBgRateStore?: Map<string, RateEntry>;
};

const store = globalRateStore.__imageBgRateStore ?? new Map<string, RateEntry>();
globalRateStore.__imageBgRateStore = store;

export function consumeRateLimit(key: string, limit: number, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfter: 0 };
}
