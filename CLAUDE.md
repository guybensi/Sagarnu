# Sagarnu (סגרנו)

Hebrew/RTL wedding budget manager for couples and planners. Live: https://sagarnu-bay.vercel.app.
Reply to the user in Hebrew.

Read before starting work: `Documentation/SESSION_HANDOFF.md` (state, decisions, deployment) and
`Future/FUTURE_WORK.txt` (roadmap; the user edits it, section 8 holds their notes). Redesign work follows
`docs/design/PLAN.md`, one phase per session.

## Stack and layout

- pnpm workspaces + Turborepo, Node 24. `apps/web` (Next.js 16, UI only, proxies `/v1/*` to the API),
  `apps/api` (Fastify + Better Auth), `packages/{domain,schemas,api-client,i18n,db,notifications}`, `e2e/`.
- Business logic lives in the API and `packages/domain`, never in Next.js (a future Expo app reuses the API).
- Money is integer agorot; day-only dates are ISO `YYYY-MM-DD`; date math in `Asia/Jerusalem`.

## Rules

- **UI text:** every user-facing string goes in `packages/i18n/src/he.ts`. An ESLint rule rejects Hebrew
  literals in `apps/web/src`. E2E tests select by Hebrew text, labels, ids and roles — changing them means
  updating the tests in the same commit.
- **RTL:** logical utilities only (`ms-`/`me-`/`ps-`/`pe-`, `start`/`end`); numbers in Hebrew text use `.num`.
- **DB changes:** edit `packages/db/src/schema/*`, then `pnpm --filter @sagarnu/db db:generate --name <change>`
  and commit the SQL + `meta/`. Migrations run on API boot.
- **Before every commit:** `pnpm check` (same as CI). For UI changes also `pnpm e2e`.
- **Commits:** one per finished module, push after each, meaningful message, `package.json` and
  `pnpm-lock.yaml` together. After pushing, check CI and (for `apps/api`/`packages` changes)
  `https://sagarnu-production.up.railway.app/v1/health` shows the new commit.
- **FUTURE_WORK:** mark implemented items `[x]` with a short note of what was done.

## Windows (this machine)

- Run pnpm/node from PowerShell after refreshing PATH:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
- Write files with the Edit/Write tools or a script file; long Bash heredocs with mixed quotes may fail to parse.
- The repo is in OneDrive: local PGlite lives in `%LOCALAPPDATA%\sagarnu`; `e2e/clean-next.mjs` handles
  read-only `.next` folders. No `gh` CLI — use the GitHub API with curl.
