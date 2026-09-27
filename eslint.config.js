// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Packages that must never be imported from client code (web / future mobile). */
const SERVER_ONLY = ["@sagarnu/db", "@sagarnu/ai", "@sagarnu/notifications"];

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/.turbo/**", "**/drizzle/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Shared packages must stay platform-agnostic so the future mobile app can reuse them.
    files: ["apps/web/**", "apps/mobile/**", "packages/{domain,schemas,api-client,i18n}/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [{ group: SERVER_ONLY.map((p) => `${p}*`), message: "server-only package" }],
        },
      ],
    },
  },
);
