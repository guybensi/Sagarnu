import { type Db, schema } from "@sagarnu/db";
import { type EmailProvider, resetPasswordMessage, verifyEmailMessage } from "@sagarnu/notifications";
import { passwordSchema } from "@sagarnu/schemas";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { uuidv7 } from "uuidv7";
import type { Env } from "./env";

const PASSWORD_PATHS = new Set(["/sign-up/email", "/reset-password", "/change-password"]);

export function createAuth(env: Env, db: Db, email: EmailProvider) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: "סגרנו",
    // The browser talks to the web origin; Next.js proxies /v1/* here, so cookies stay first-party.
    baseURL: env.WEB_ORIGIN,
    basePath: "/v1/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    advanced: {
      cookiePrefix: "sagarnu",
      database: { generateId: () => uuidv7() },
    },
    session: {
      // "Remember me" keeps the session for 30 days, renewed on use. Without it the cookie dies with the browser.
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    user: {
      additionalFields: {
        userType: { type: ["couple", "planner"], required: false, defaultValue: "couple", input: true },
        phoneE164: { type: "string", required: false, input: false },
        defaultEventId: { type: "string", required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: env.requireEmailVerification,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await email.send(resetPasswordMessage(user.email, user.name, url));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await email.send(verifyEmailMessage(user.email, user.name, url));
      },
    },
    socialProviders: google,
    hooks: {
      // Better Auth only checks length; enforce the full policy (A-Z, digit, special) server-side too.
      before: createAuthMiddleware(async (ctx) => {
        if (!PASSWORD_PATHS.has(ctx.path)) return;
        const body = ctx.body as { password?: unknown; newPassword?: unknown } | undefined;
        const password = body?.newPassword ?? body?.password;
        const result = passwordSchema.safeParse(password);
        if (!result.success) {
          throw new APIError("BAD_REQUEST", {
            code: "PASSWORD_POLICY",
            message: result.error.issues.map((i) => i.message).join(","),
          });
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
