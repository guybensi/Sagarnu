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
/**
 * While the Google app is in "Testing" only listed test users can sign in with it, so everyone
 * else sees the button as "coming soon". Set to true after publishing the app in Google Cloud.
 */
export const googlePublic = process.env.NEXT_PUBLIC_GOOGLE_PUBLIC === "true";
