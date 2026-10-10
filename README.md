# Sagarnu

Sagarnu – Wedding budget manager for couples and planners: AI-powered vendor contract analysis, payment tracking, and automatic WhatsApp &amp; email reminders. Hebrew/RTL.

**Live:** https://sagarnu-bay.vercel.app

**Setup & deployment (Hebrew, step by step): [SETUP.txt](SETUP.txt)** · Plan: [docs/PLAN.txt](docs/PLAN.txt)

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

## Commands

```sh
pnpm test        # all unit + API integration tests (PGlite, no services needed)
pnpm typecheck
pnpm lint
pnpm --filter @sagarnu/db db:generate --name <change>   # after editing the Drizzle schema
```
