# Sagarnu

Sagarnu – Wedding budget manager for couples and planners: AI-powered vendor contract analysis, payment tracking, and automatic WhatsApp &amp; email reminders. Hebrew/RTL.

**Setup & deployment (Hebrew, step by step): [SETUP.txt](SETUP.txt)** · Plan: [docs/PLAN.txt](docs/PLAN.txt)

## Quick start

```sh
pnpm install
cp apps/api/.env.example apps/api/.env   # fill BETTER_AUTH_SECRET
pnpm dev                                  # web :3000, api :8080
```

No Docker or Postgres install needed locally — the API uses embedded PGlite (`DATABASE_URL=pglite:./.data/dev`).

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
