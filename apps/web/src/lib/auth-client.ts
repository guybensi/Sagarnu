"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Auth calls go to `/v1/auth/*` on this origin; Next.js proxies them to the API. */
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
  basePath: "/v1/auth",
  plugins: [
    inferAdditionalFields({
      user: { userType: { type: "string", required: false } },
    }),
  ],
});

export const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";
