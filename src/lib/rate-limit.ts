type AttemptMap = Map<string, number[]>;

const CLEANUP_INTERVAL_MS = 5 * 60_000;

export function createInMemoryRateLimiter(input: { maxRequests: number; windowMs: number }) {
  const attempts: AttemptMap = new Map();

  function cleanup(now: number) {
    for (const [key, timestamps] of attempts) {
      const recent = timestamps.filter((timestamp) => now - timestamp < input.windowMs);
      if (recent.length === 0) attempts.delete(key);
      else attempts.set(key, recent);
    }
  }

  const cleanupTimer = setInterval(() => cleanup(Date.now()), CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const recent = (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < input.windowMs);
    recent.push(now);
    attempts.set(key, recent);
    return recent.length > input.maxRequests;
  };
}
