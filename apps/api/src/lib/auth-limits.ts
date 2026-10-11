import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Brute-force protection for login and password reset (plan: 5 attempts a minute, by IP and by
 * email). Fixed one-minute windows in memory: enough for a single API instance; move to Postgres
 * or Redis before running several.
 */
const LIMITED_PATHS = new Set([
  "/v1/auth/sign-in/email",
  "/v1/auth/request-password-reset",
  "/v1/auth/reset-password",
]);

export const AUTH_ATTEMPTS_PER_MINUTE = 5;
const WINDOW_MS = 60_000;

export function createAuthAttemptLimiter(max = AUTH_ATTEMPTS_PER_MINUTE, now = () => Date.now()) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = now();

  /** Counts one attempt; returns the seconds until retry when over the limit. */
  const hit = (key: string): number | null => {
    const t = now();
    if (t - lastSweep > WINDOW_MS) {
      for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
      lastSweep = t;
    }
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= t) {
      buckets.set(key, { count: 1, resetAt: t + WINDOW_MS });
      return null;
    }
    bucket.count += 1;
    return bucket.count > max ? Math.ceil((bucket.resetAt - t) / 1000) : null;
  };

  return async function limitAuthAttempts(req: FastifyRequest, reply: FastifyReply) {
    const path = req.url.split("?")[0] ?? "";
    if (req.method !== "POST" || !LIMITED_PATHS.has(path)) return;
    const body = req.body as { email?: unknown } | null | undefined;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
    // Count both keys on every attempt so one cannot be used to dodge the other.
    const byIp = hit(`ip:${path}:${req.ip}`);
    const byEmail = email ? hit(`email:${path}:${email}`) : null;
    const retryAfter = Math.max(byIp ?? 0, byEmail ?? 0);
    if (retryAfter > 0) {
      req.log.warn({ path, ip: req.ip, byEmail: byEmail != null }, "auth attempts rate-limited");
      return reply
        .status(429)
        .header("retry-after", String(retryAfter))
        .send({ code: "TOO_MANY_REQUESTS", message: "Too many attempts" });
    }
  };
}
