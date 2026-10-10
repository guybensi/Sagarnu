import type { NextConfig } from "next";

/** Where the Fastify API runs. On Vercel this is the public Railway URL. */
// Tolerate a trailing slash or `/v1` — the rewrite below adds `/v1` itself.
const API_URL = (process.env.API_URL ?? "http://localhost:8080")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/v1$/, "");

// The rewrite target is fixed at build time, so on Vercel a missing or private URL would silently
// break every API call (DNS_HOSTNAME_RESOLVED_PRIVATE). Fail the build instead.
const isPublicHttps =
  /^https:\/\/[^/]+$/.test(API_URL) && !/localhost|127\.0\.0\.1|\.internal\b/.test(API_URL);
if (process.env.VERCEL && !isPublicHttps) {
  throw new Error(
    `API_URL is "${process.env.API_URL ?? "(not set)"}". On Vercel it must be the public Railway URL, ` +
      `e.g. https://sagarnu-production.up.railway.app (Settings → Environment Variables, then Redeploy).`,
  );
}

const config: NextConfig = {
  transpilePackages: ["@sagarnu/api-client", "@sagarnu/domain", "@sagarnu/i18n", "@sagarnu/schemas"],
  poweredByHeader: false,
  // The browser only ever talks to this origin: auth cookies stay first-party even
  // before there is a shared custom domain for app. and api.
  async rewrites() {
    return [{ source: "/v1/:path*", destination: `${API_URL}/v1/:path*` }];
  },
};

export default config;
