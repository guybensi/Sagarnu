import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8080),
  /** `postgresql://…` (Railway) or `pglite:./.data/dev` for an embedded local database. */
  DATABASE_URL: z.string().default("pglite:./.data/dev"),
  /** Public origin of the web app. Auth runs under it via the Next.js `/v1` proxy. */
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** Defaults to on when email sending is configured. */
  REQUIRE_EMAIL_VERIFICATION: bool.optional(),
  MIGRATE_ON_START: bool.default(true),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof schema> & { requireEmailVerification: boolean };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  const env = parsed.data;
  return {
    ...env,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION ?? Boolean(env.RESEND_API_KEY),
  };
}
