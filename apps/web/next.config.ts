import type { NextConfig } from "next";

/** Where the Fastify API runs. On Vercel this is the Railway URL. */
const API_URL = process.env.API_URL ?? "http://localhost:8080";

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
