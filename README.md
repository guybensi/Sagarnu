# Sagarnu

Sagarnu – Wedding budget manager for couples and planners: AI-powered vendor contract analysis, payment tracking, and automatic WhatsApp &amp; email reminders. Hebrew/RTL.

**Live:** https://sagarnu-bay.vercel.app

**Setup & deployment (Hebrew, step by step): [SETUP.txt](SETUP.txt)** · Plan: [docs/PLAN.txt](docs/PLAN.txt)

## Features (implemented)

- **Auth:** sign-up as couple or planner, login with "remember me" (off = 24-hour non-renewing session), forgot/reset password, password policy. Login and password reset are limited to 5 attempts a minute per IP and per email (429 + `Retry-After`).
- **Onboarding questionnaire** and **dashboard**: countdown, cover photo, next payment, overdue items, budget bar, missing categories.
- **Contracts:** open locked, "עריכה" unlocks and saves everything at once; payment schedules by fixed date or "X days before/after the event / after signing", with the resolved date shown live under each row.
- **Payments:** mark installments paid, attach receipt / transfer-confirmation files (PDF/images ≤5MB).
- **Expenses** table and budget status.
- **Planner mode & sharing:** planners manage many events (`/events`); invite the couple by email or one-time link (7 days, WhatsApp share), roles owner/editor/viewer, member management.
- **Account settings** (`/settings`): profile, account type, phone + WhatsApp consent, password change, signed-in devices (sign out one/all others), JSON data export and account deletion (privacy law, amendment 13).

Roadmap and open items: [Future/FUTURE_WORK.txt](Future/FUTURE_WORK.txt) · Session handoff: [Documentation/SESSION_HANDOFF.md](Documentation/SESSION_HANDOFF.md)

## Deployment

| Service | Where                                                             | Notes                                                                                 |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Web     | Vercel — [sagarnu-bay.vercel.app](https://sagarnu-bay.vercel.app) | Root directory `apps/web`; env `API_URL` = the Railway API URL                        |
| API     | Railway (config: `apps/api/railway.json`)                         | env `WEB_ORIGIN=https://sagarnu-bay.vercel.app`, `DATABASE_URL`, `BETTER_AUTH_SECRET` |
| DB      | Railway Postgres                                                  | `DATABASE_URL=${{Postgres.DATABASE_URL}}`; migrations run on API boot                 |

## Quick start

```sh
pnpm install
cp apps/api/.env.example apps/api/.env   # fill BETTER_AUTH_SECRET
pnpm dev                                  # web :3000, api :8080
```

No Docker or Postgres install needed locally — the API uses embedded PGlite (`DATABASE_URL=pglite:local`), stored in the user app-data folder (`%LOCALAPPDATA%\sagarnu\pglite-dev` on Windows) because sync clients like OneDrive corrupt a database kept inside the project.

## Layout

| Path                     | What                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| `apps/web`               | Next.js UI only. Proxies `/v1/*` to the API so auth cookies stay first-party |
| `apps/api`               | Fastify REST `/v1`, Better Auth, permissions, migrations on boot             |
| `packages/domain`        | Pure business rules: balances, schedule, permissions, dates (Israel)         |
| `packages/schemas`       | Zod request schemas + response DTO types, shared client/server               |
| `packages/api-client`    | Typed fetch client + TanStack Query hooks (web and future mobile)            |
| `packages/i18n`          | Hebrew labels and ₪ / date formatters                                        |
| `packages/db`            | Drizzle schema, SQL migrations, seed (server-only)                           |
| `packages/notifications` | Email provider (Resend / console) and templates (server-only)                |
| `e2e`                    | Playwright end-to-end tests (run in CI; locally on the installed Edge)       |
| `datasets`               | Contract-extraction ground-truth dataset + validator (not deployed)          |
| `Future`                 | Roadmap (`FUTURE_WORK.txt`) and planned AI extraction JSON Schema            |

## Commands

```sh
pnpm test        # all unit + API integration tests (PGlite, no services needed)
pnpm typecheck
pnpm lint
pnpm check       # format:check + lint + typecheck + test — same as CI; run before every commit
pnpm e2e         # Playwright end-to-end tests (starts API + web on :8180/:3100 with an in-memory DB)
pnpm --filter @sagarnu/db db:generate --name <change>   # after editing the Drizzle schema
```
