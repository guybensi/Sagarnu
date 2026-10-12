import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { Db } from "@sagarnu/db";
import type { EmailProvider } from "@sagarnu/notifications";
import Fastify, { type FastifyServerOptions } from "fastify";
import { createAuth } from "./auth";
import type { Env } from "./env";
import { createAuthAttemptLimiter } from "./lib/auth-limits";
import { requireUser } from "./lib/context";
import { registerErrorHandler } from "./lib/errors";
import { contractFileRoutes } from "./routes/contract-files";
import { contractRoutes } from "./routes/contracts";
import { coverRoutes } from "./routes/cover";
import { eventRoutes } from "./routes/events";
import { invitationRoutes, publicInvitationRoutes } from "./routes/invitations";
import { meRoutes } from "./routes/me";
import { paymentFileRoutes } from "./routes/payment-files";

export interface AppDeps {
  env: Env;
  db: Db;
  email: EmailProvider;
}

export async function buildApp({ env, db, email }: AppDeps, opts: FastifyServerOptions = {}) {
  const app = Fastify({ trustProxy: true, bodyLimit: 1024 * 1024, ...opts });
  const auth = createAuth(env, db, email);
  app.decorate("ctx", { env, db, auth });
  app.decorateRequest("user", null);
  app.decorateRequest("sessionId", null);
  registerErrorHandler(app);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: [env.WEB_ORIGIN], credentials: true });
  if (env.RATE_LIMITS) await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  // `commit` shows which version is live (Railway sets RAILWAY_GIT_COMMIT_SHA on every deploy;
  // null when running locally).
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  app.get("/v1/health", async () => ({ ok: true, commit }));

  // Better Auth handles everything under /v1/auth (sign-in, sign-up, OAuth callbacks, reset, verify).
  app.route({
    method: ["GET", "POST"],
    url: "/v1/auth/*",
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    // Login and password reset: 5 a minute per IP and per email.
    preHandler: env.RATE_LIMITS ? createAuthAttemptLimiter() : [],
    async handler(req, reply) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const response = await auth.handler(
        new Request(new URL(req.url, env.WEB_ORIGIN), {
          method: req.method,
          headers,
          body: req.method === "GET" || req.body == null ? undefined : JSON.stringify(req.body),
        }),
      );
      reply.status(response.status);
      for (const cookie of response.headers.getSetCookie()) reply.header("set-cookie", cookie);
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") reply.header(key, value);
      });
      return reply.send(response.body ? await response.text() : null);
    },
  });

  // Invitation preview works before login (the invitee may not have an account yet).
  await app.register(publicInvitationRoutes);

  await app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", requireUser);
    await protectedApp.register(meRoutes);
    await protectedApp.register(eventRoutes);
    await protectedApp.register(contractRoutes);
    await protectedApp.register(coverRoutes);
    await protectedApp.register(paymentFileRoutes);
    await protectedApp.register(contractFileRoutes);
    await protectedApp.register(invitationRoutes(email));
  });

  return app;
}
