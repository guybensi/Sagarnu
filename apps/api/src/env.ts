import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

const schema = z.object({
  // Production unless the local .env says otherwise — never pretty-print or relax checks by accident.
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
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

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  // `KEY=` lines in .env files mean "not set", not an empty value.
  const source = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v.trim() !== ""),
  );
  const parsed = schema.safeParse(source);
  const problems = parsed.success
    ? []
    : parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${source[String(i.path[0])] ? i.message : "missing"}`,
      );

  // Defaults are for local dev only: an embedded DB on Railway's disk would lose data on every deploy.
  if ((source.NODE_ENV ?? "production") === "production") {
    if (!source.DATABASE_URL?.startsWith("postgres")) {
      problems.push("DATABASE_URL: missing — on Railway set it to ${{Postgres.DATABASE_URL}}");
    }
    if (!source.WEB_ORIGIN) problems.push("WEB_ORIGIN: missing — the public URL of the web app (Vercel)");
  }

  if (!parsed.success || problems.length > 0) {
    throw new Error(
      [
        "Invalid environment variables:",
        ...problems.map((p) => `  - ${p}`),
        "",
        "Railway: open the API service (not Postgres) → Variables, add them, then press Deploy to apply.",
        "Local: copy apps/api/.env.example to apps/api/.env. See SETUP.txt.",
      ].join("\n"),
    );
  }
  const env = parsed.data;
  return {
    ...env,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION ?? Boolean(env.RESEND_API_KEY),
  };
}
