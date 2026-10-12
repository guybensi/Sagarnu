# Sagarnu — session handoff

Checkpoint written 2026-10-11 before `/compact`, updated later on 2026-10-11 after commits `453d9ce` → `cf1944a`. Covers the work sessions of 2026-10-10 and 2026-10-11.

**Legend:** ✅ verified in this session (tests, browser run, live HTTP check, or git) · ⚠️ assumption / not verified · 🔒 secret (name only, never the value).

Related docs (read these too, they are kept up to date):

- `docs/PLAN.txt` — the approved plan (Hebrew, RTL marks per line). Source of truth for scope and phases.
- `Future/FUTURE_WORK.txt` — Hebrew roadmap/checklist, edited by both the user and Claude. Section 8 holds the user's own notes ("הערות של גיא והגר"); the user asked that every implemented item be marked `[x]`.
- `SETUP.txt` — Hebrew step-by-step deploy guide for the user (Railway → Vercel → Resend → Google → Groq → Meta).
- `README.md` — dev quick start, layout table, live URL.
- `datasets/contracts/README.md`, `datasets/contracts/SCHEMA_GAPS.md` — contract-extraction ground-truth dataset and schema gaps.

---

## 1. Project overview

**Sagarnu (סגרנו)** — a Hebrew/RTL wedding-budget manager for couples and event planners: vendor contracts, payment schedules, payments, budget tracking; planned AI contract analysis (phase 2) and WhatsApp/email reminders (phase 3).

**Live:** web https://sagarnu-bay.vercel.app · API https://sagarnu-production.up.railway.app (✅ both up, 2026-10-11).
**Repo:** https://github.com/guybensi/Sagarnu (branch `main`).

### Architecture

```
Browser ──► Vercel (Next.js web, UI only) ──/v1/* rewrite──► Railway (Fastify API) ──► Railway Postgres
```

- The browser only talks to the Vercel origin. `apps/web/next.config.ts` rewrites `/v1/*` to `API_URL` (Railway). Auth cookies are therefore **first-party** without a custom domain. Better Auth's `baseURL` = `WEB_ORIGIN` (the Vercel URL), `basePath` = `/v1/auth`.
- All business logic lives in the API + `packages/domain`; Next.js has no server actions / business logic (so a future Expo app can reuse the API).
- Money is **integer agorot** everywhere; day-only dates are ISO `YYYY-MM-DD`; all date math in `Asia/Jerusalem`.

### Tech stack (versions as installed)

| Layer    | Choice                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo | pnpm 10.28 workspaces + Turborepo 2.11; Node 24 (`.nvmrc`)                                                                                                      |
| Web      | Next.js 16.4 (App Router, Turbopack), React 19.3, Tailwind 4.3, Radix (`radix-ui`), TanStack Query 5, react-hook-form + Zod 4, sonner, lucide-react, Heebo font |
| API      | Fastify 5, Better Auth 1.7 (Drizzle adapter, email+password, Google optional), Zod 4, tsup bundle                                                               |
| DB       | PostgreSQL (Railway) via Drizzle ORM 0.45 + drizzle-kit; **PGlite** (embedded Postgres) for local dev and tests                                                 |
| Email    | Resend via `fetch` (`packages/notifications`); console fallback when no key                                                                                     |
| Tests    | Vitest 5 (unit + API integration on in-memory PGlite); Playwright-core + system Edge used ad hoc from the scratchpad (not in repo)                              |
| CI       | GitHub Actions `.github/workflows/ci.yml`: frozen install → format:check → lint → typecheck → test                                                              |

### Repository structure

```
apps/
  api/        Fastify REST /v1, Better Auth, routes, migrations on boot (railway.json, tsup.config.ts)
  web/        Next.js UI (src/app, src/components, src/lib)
packages/
  domain/     pure logic: money, Israel dates, permissions can(), balances, schedule, pricing, categories, enums
  schemas/    Zod request schemas + response DTO types + error codes (shared client/server)
  api-client/ typed fetch client + TanStack Query hooks
  i18n/       Hebrew labels (he.ts) + ₪/date formatters
  db/         Drizzle schema, SQL migrations (drizzle/), seed, createDb (Postgres | PGlite)  [server-only]
  notifications/ email provider (Resend/console) + RTL templates                       [server-only]
  config/     shared tsconfig
datasets/     @sagarnu/datasets — contract ground-truth template, docs, validator (not deployed)
Future/       FUTURE_WORK.txt roadmap + contract_extraction.schema.json (phase-2 design)
docs/PLAN.txt approved plan
SETUP.txt     Hebrew deploy guide
Documentation/SESSION_HANDOFF.md  this file
```

Key API files: `apps/api/src/app.ts` (route registration, auth handler, health), `env.ts` (env validation), `auth.ts` (Better Auth config + password-policy hook), `lib/access.ts` (`eventAccess` → 404 for non-members), `services/ledger.ts` (loads contracts/schedule/payments/files, computes DTOs), `routes/{me,events,contracts,cover,payment-files,invitations}.ts`, `lib/auth-limits.ts` (5/min login & reset limiter).

UI text: every user-facing string is in `packages/i18n/src/he.ts`, grouped by screen; an ESLint rule rejects Hebrew literals in `apps/web/src`. E2E: `e2e/` (Playwright, `pnpm e2e`, separate CI job).

Key web files: `components/shell/app-shell.tsx` (header, nav, event switcher, `UserMenu`), `components/contracts/contract-dialog.tsx` (view/edit contract form), `components/contracts/vendor-drawer.tsx` (side panel), `components/payments/*`, `app/e/[eventId]/*` pages, `app/events/page.tsx`, `app/(auth)/*` incl. `invite/[token]`, `app/settings/page.tsx` + `components/settings/*` (profile, password, sessions, data cards), `components/shell/plain-shell.tsx` (header shared by `/events` and `/settings`).

---

## 2. Current state

### Implemented and verified ✅

- **Auth:** sign-up (couple/planner), login with "remember me", forgot/reset password, verify-email page, show/hide password, Hebrew error messages (wrong credentials → link to sign-up with email prefilled; weak password → unmet rules in red; server down → "השרת לא זמין"), `?next=` return path (same-site only, `lib/next-path.ts`). Password policy (8+ chars, A–Z, digit, special) enforced client and server. **Rate limit:** sign-in, request-password-reset and reset-password limited to 5/min per IP **and** per email (in-memory counter, 429 + `Retry-After`, web shows "יותר מדי ניסיונות"). **"Remember me" off** → 24-hour non-renewing session (Better Auth already did this; now pinned by a test).
- **Account settings** (`/settings`, user menu → "הגדרות החשבון"): name, account type (couple/planner), phone (normalized to international format in `@sagarnu/domain` `phone.ts`) + WhatsApp consent with date (needs a phone; removing it withdraws consent), change password (optionally sign out other devices), signed-in devices list (sign out one / all others), JSON data export (`GET /v1/me/export`, no file contents or secrets), account deletion (`DELETE /v1/me`, password required; solo events deleted, shared events stay with members; refused while sole owner of a shared event; the user's sent invitations are deleted). Migration `0003_account_deletion`: `event.created_by` nullable, `ON DELETE SET NULL`. Not yet: changing the email address (needs a real email domain).
- **Onboarding questionnaire** (`/onboarding`): date/time ("לא ידוע עדיין" per field), noon/evening **derived from start time** (<17:00 = noon; server enforces), guests, budget, place, names, style (`hall, garden, outdoor=שטח, home=בית, festival=פסטיבל (לינה), restaurant, other`), kashrut, ceremony, relevant categories + **custom categories**.
- **Dashboard** (`/e/[id]`): countdown in **calendar days only**, personal **cover photo** (resized client-side to 1600px JPEG, stored in DB), next payment, overdue list, budget bar, vendor counts, missing categories, event details.
- **Contracts** (`/e/[id]/contracts`): category tabs with visible scrollbar/arrows (`ScrollRow`), contract cards. Clicking a card opens the **contract form locked ("צפייה בלבד")**; "עריכה" unlocks; "ביטול" reverts; "שמירה" saves fields → schedule diff (add/update/remove pending items) → status (confirmation when leaving "approved"). Paid/cancelled items locked. Error summary next to Save listing every invalid field (clickable). Links get `https://` auto-prefixed. Fields include ח.פ/ע.מ and "days after the event". Schedule rows with a relative timing (days before/after the event, after signing) show the **resolved date** under the row, update when the anchor date changes, flag a date already passed, and explain when the anchor date is missing.
- **Vendor drawer** (side panel): status badge (read-only), installments with "סמן כשולם", payment history with **attached files** (receipt/confirmation), attach later, delete; "עריכה" opens the form in edit mode.
- **Payments:** payment dialog with link **or file upload** per kind (PDF/JPG/PNG/WebP ≤5MB, images resized to JPEG and renamed `.jpg`), overpay confirmation, "next payment" prompt.
- **Expenses** (`/e/[id]/expenses`): totals tiles, table (cards on mobile), numbers right-aligned.
- **Event details** (`/e/[id]/details`), delete event.
- **Planner mode + sharing:** planners land on **"האירועים שלי"** (`/events`); after creating an event → `/e/[id]/members?invite=1`. Sharing screen: invite by email + role (editor/viewer), one-time link (7 days) with copy + WhatsApp, pending invitations with cancel, change roles, remove members, leave event, last-owner protection. `/invite/[token]` public preview → sign up/log in → join.
- **Test suite** (✅ all green locally and in CI on `cf1944a`): domain 27, schemas 11, i18n 4, db 1, api 34, datasets 8 tests.
- **Browser runs** (✅ headless Edge via playwright-core, scratchpad scripts, local stack): full UI flow desktop+mobile, auth errors, contract validation summary, tab scroll row, contract view/edit modes, payment files, number alignment, planner + partner invitation flow (two browser contexts). Screenshots were reviewed.

### Deployed and verified live ✅

- Railway runs **`cf1944a`** (`GET /v1/health` → `{"ok":true,"commit":"cf1944a"}`, ✅ checked 2026-10-11); migrations `0000`–`0003` applied (server boots only after migrating; `0001` features and the file/invitation routes answered correctly live).
- Live smoke tests (2026-10-11): sign-up, festival style, derived noon, custom category, cover photo upload/serve, link-with-spaces rejected (422), invitation route (404 for fake token), payment-file route (401 without session).
- Resend in **testing mode**: a password-reset email to the account owner's address arrived (in spam).

### Not verified ⚠️

- The invitation and payment-file features were clicked through only locally; on the live site only route-level HTTP checks were done.
- Google sign-in is wired but not configured/tested (no `GOOGLE_CLIENT_ID` set as far as known).
- Settings screen, account deletion/export and the rate limiter were not smoke-tested on the live site (deploy itself verified via `/v1/health`).

---

## 3. Work completed in these sessions (chronological, with commits)

| Commit               | Change                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `91a1ee3`            | `packages/domain` (money, dates, permissions, balances, schedule, pricing, countdown) + tests                                                                          |
| `7ad3f19`            | `packages/schemas` + `packages/i18n`                                                                                                                                   |
| `811268d`            | `packages/db`: Drizzle schema, migration `0000_init`, seed, Postgres/PGlite client                                                                                     |
| `6a6605e`, `59dca84` | `apps/api`: Fastify + Better Auth + core endpoints + integration tests                                                                                                 |
| `1dd1182`            | `apps/web` core screens + `packages/api-client`                                                                                                                        |
| `335e3bb`, `43ce9de` | Railway config (`apps/api/railway.json`), env hardening, `SETUP.txt`, `.env.example` files                                                                             |
| `8a837fd`            | env errors list every missing var; `pnpm check` script                                                                                                                 |
| `8fab78a`, `dbec409` | PGlite recovery hint; clearer auth errors, show/hide password                                                                                                          |
| `b332025`            | README live URL                                                                                                                                                        |
| `1d2a031`, `877724d` | Vercel build fails if `API_URL` missing/private; turbo passes `API_URL` + `NEXT_PUBLIC_*` to build (`turbo.json` `env`) — this fixed `DNS_HOSTNAME_RESOLVED_PRIVATE`   |
| `f153592`            | questionnaire/dashboard feedback: derived noon/evening, new styles (migration `0001`), custom categories, days-only countdown, cover photo (`event_cover_photo` table) |
| `2f80963`            | `ScrollRow` for category tabs                                                                                                                                          |
| `212ca40`            | contract form error summary; invalid money text kept (NaN) instead of cleared; auto `https://`; stricter `httpUrl`                                                     |
| `2ebe727`, `f19f4fd` | local PGlite moved out of OneDrive (`pglite:local`); test timeouts 60s                                                                                                 |
| `b556052`            | `datasets/` ground-truth scaffolding + validator                                                                                                                       |
| `299221f`            | `Future/` roadmap + planned extraction JSON Schema                                                                                                                     |
| `0ff5506`, `a2db300` | `/v1/health` reports deployed commit; Railway auto-deploy note                                                                                                         |
| `92c0dda`, `3186725` | FUTURE_WORK stage 0 updates (Railway, Resend testing mode)                                                                                                             |
| `73ecb64`            | numbers right-aligned (`.num` in `@layer components`, `text-align: right`; `.text-center .num` centered)                                                               |
| `e35b075`            | payment files (migration `0002_payment_files`, routes, UI) + Hebrew relative-date bidi fix                                                                             |
| `e2b8795`            | contract view/edit mode; drawer read-only; ח.פ/ע.מ field; "days after event"                                                                                           |
| `ceef63d`            | API: invitations + member management                                                                                                                                   |
| `bfb6555`            | web: planner mode, `/events`, sharing screen, `/invite/[token]`, `?next=`                                                                                              |
| `453d9ce`            | web: contract form shows the resolved date of relative installments (FUTURE_WORK §8 item 6)                                                                            |
| `0daf53d`            | API: 5/min limit on login + password reset per IP and email; test pins 24h session without "remember me"                                                               |
| `c733265`            | API: `PATCH /v1/me`, `/v1/me/sessions`, `/v1/me/export`, `DELETE /v1/me`; phone normalization; migration `0003_account_deletion`                                       |
| `cf1944a`            | web: `/settings` account settings screen, `PlainShell`                                                                                                                 |

User's own commits (FUTURE_WORK edits only): `d03c2f2`, `4dc4199`, `45b2d72`, `1363767`.

---

## 4. Current task

**Status: nothing in progress.** All 6 items of FUTURE_WORK section 8 (user notes) are done and marked `[x]`. Stage 1 leftovers settings screen, "remember me" 24h and rate limits are also done (`453d9ce` → `cf1944a`), committed, pushed, CI-green and deployed (`cf1944a`).

---

## 5. Pending tasks (priority order)

From `Future/FUTURE_WORK.txt` (authoritative; re-read it — the user edits it):

1. **Stage 1 leftovers** (all done except:)
   1. Sign in with Apple — deferred until the mobile app (stage 5).
   2. Google sign-in — code ready, free; waiting for the final domain (redirect URI + consent screen name).
   3. Change email address in settings (after the email domain exists).
2. **Domain & email (before real users):** buy domain → Vercel domain → update `WEB_ORIGIN` (Railway) and Google redirect URI → Resend domain (SPF, DKIM, DMARC) → `EMAIL_FROM=סגרנו <noreply@domain>` → **remove `REQUIRE_EMAIL_VERIFICATION`** so verification is required again.
3. **Phase 2 — AI contract analysis** (see FUTURE_WORK §2, `docs/PLAN.txt` §6, `datasets/contracts/SCHEMA_GAPS.md`): R2 storage (also move cover photos + payment files from DB), `contract_file`/`contract_analysis` tables, upload endpoint, `apps/worker` (pg-boss), text extraction, OCR, Groq call using `Future/contract_extraction.schema.json`, review UI, `pnpm eval:contracts`, label 5–10 real contracts with `pnpm dataset:validate`. Decisions needed: category guess field, where to store confidence/warnings/raw_text, event-date mismatch warning, VAT normalization (plan Q7).
4. **Phase 3 — reminders** (Resend + WhatsApp via Meta; user handles Meta Business setup).
5. **Phase 4–5:** planner overview with per-event stats, restore deletes/audit UI, exports, PWA, billing, Expo app.
6. **Infra:** Sentry, Postgres backups (pg_dump → R2), Vercel Pro when commercial.

Plan open questions (§11) still unanswered by the user; defaults in use: neutral wording ("יש לשלם"), 09:00 send hour, VAT shown as in contract (`vatMode`); Shabbat/holiday skipping undecided.

---

## 6. Important decisions and conventions

**Decisions that deviate from `docs/PLAN.txt` (made with the user):**

- DB host **Railway Postgres**, not Neon (API + worker on Railway; pg-boss keeps a connection open).
- **No Docker** (user's request). Local dev uses embedded **PGlite**: `DATABASE_URL=pglite:local` → `%LOCALAPPDATA%\sagarnu\pglite-dev` (outside the repo **because the repo is under OneDrive**, which turns data files into ReparsePoint placeholders and breaks PGlite — "PGlite failed to initialize properly"). `pglite:memory` for tests.
- **Proxy architecture** (web rewrites `/v1/*` to the API) so cookies work without a shared custom domain.
- Files (cover photo `event_cover_photo`, payment files `payment_file`) stored as **bytea in Postgres** until R2 exists (phase 2). File type sniffed from bytes; served with sandbox CSP.
- Ground-truth dataset targets the **implemented** `createContractSchema` (minus user-entered fields), not the planned LLM output; mapping in `SCHEMA_GAPS.md`.

**Product rules implemented:**

- Roles `owner | editor | viewer` (`packages/domain/src/permissions.ts`). Non-members get **404**, not 403. A couple may own one event; planners unlimited. Invitations grant `editor`/`viewer`; ownership via role change; last owner protected.
- Contract status changes go only through `POST /contracts/:id/status` (leaving `approved` cancels pending installments, needs `confirm`). PATCH of contracts uses optimistic locking (`version`). Schedule items: amount wins over percent; relative date wins over fixed date (`resolveScheduleAmount`, `resolveDueDate`).
- Invitation tokens: random 24 bytes base64url, only SHA-256 stored, single use, 7 days; anyone holding the link can accept (forwarded on WhatsApp by design).

**Working conventions (user preferences and lessons learned):**

- **Commit + push after each finished module**, meaningful messages, attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit `package.json` and `pnpm-lock.yaml` together.
- **Run `pnpm check` before every commit** (same as CI); after pushing, verify CI via `curl https://api.github.com/repos/guybensi/Sagarnu/actions/runs?per_page=1` (no `gh` CLI on this machine).
- Railway auto-deploys only when changes touch `apps/api/**`, `packages/**` or `pnpm-lock.yaml` (`watchPatterns` in `apps/api/railway.json`). Verify with `/v1/health` → `commit`.
- Mark implemented FUTURE_WORK items with `[x]` (user's explicit instruction).
- User communicates in Hebrew; replies in Hebrew. Neutral/inclusive Hebrew in UI ("את/ה", "מזמין/ה").
- `apps/web/AGENTS.md` is regenerated by `next dev`; it is tracked — commit it as-is if it changes.

**Windows tooling notes (this machine):**

- Node 24 installed via winget; pnpm 10.28 via `npm i -g`. Run pnpm/node from **PowerShell** after refreshing PATH:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
  In Git Bash the global pnpm shim resolves to a broken path.
- PowerShell 5.1 mangles `"` in native args → commit with `git commit -F -` (Bash heredoc) or `-F file`. `Set-Content -Encoding utf8` writes a BOM — avoid for source.
- Inserting code through `node -e '…'`/sed in Bash strips backslashes (regexes, `\u` escapes, Windows paths) and drops literal invisible characters — use the Edit/Write tools or a `.cjs` script file in the scratchpad.
- Force-killing the dev servers (TaskStop / Stop-Process) is how local servers are stopped here; the DB is now outside OneDrive so this no longer corrupts it.
- UI checks: playwright-core with `channel: "msedge"` from the scratchpad (`…/scratchpad/pw/*.mjs`, helpers in `seed.mjs`); hide `nextjs-portal` (dev badge) and pass `ignoreDefaultArgs: ["--hide-scrollbars"]` when measuring scrollbars. Scratchpad files are not part of the repo and may be gone after the session.

---

## 7. Known issues, risks, open questions

- **Email deliverability:** Resend has no verified domain → it only delivers to the Resend account owner and lands in spam. Railway therefore has `REQUIRE_EMAIL_VERIFICATION=false` (otherwise new users would be stuck at sign-up). Invitation emails to other people fail silently on the server (`emailSent: false`, UI tells the owner to share the link). Real users who forget their password cannot get a reset link yet.
- **Files in Postgres:** fine for now, but receipts/photos grow the DB; must move to R2 (phase 2).
- **Auth rate-limit counters are in memory** (`apps/api/src/lib/auth-limits.ts`) — fine for one API instance; move to Postgres/Redis when scaling out.
- **No automated E2E in CI**; browser checks were manual/ad hoc.
- `event_invitation.invited_by` still references `user` without `ON DELETE`; account deletion handles it by deleting the user's sent invitations first (`routes/me.ts`). Any other user-deletion path must do the same.
- Planner overview has no per-event financial stats yet (cards show date, place, guests, days left only).
- `/v1/auth/*` is proxied by building a Fetch `Request` from Fastify; works for GET/POST JSON. ⚠️ Not exercised for OAuth callbacks (Google not configured).
- Test users may remain in production DB from smoke tests: `smoke-test-1791628611271@example.com`, `smoke-test-1791704310803@example.com`, `smoke-test-1791705832098@example.com` — the user reported deleting them (FUTURE_WORK edits `45b2d72` and the removed line); ⚠️ not re-verified.
- Next.js 16 note: `text-align: match-parent` is resolved by Chromium against the element's own direction — don't use it for `.num`.

---

## 8. Deployment

| Service            | What                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vercel**         | web, project URL https://sagarnu-bay.vercel.app                                                              | Root Directory `apps/web`; auto-deploys every push to `main`                                                                                                                                                                                                                                                                                                       |
| **Railway**        | API service "Sagarnu" + "Postgres" (volume `postgres-volume`), project "jubilant-elegance", env "production" | Config as code `/apps/api/railway.json` (Railpack build `pnpm --filter @sagarnu/api build`, start `pnpm --filter @sagarnu/api start`, healthcheck `/v1/health`). **Auto deploy was disabled on `main`; the user enabled it on 2026-10-11** — verified working (`a2db300` deployed within ~1 min). Migrations + seed run on boot (`MIGRATE_ON_START` default true). |
| **Postgres**       | Railway Postgres                                                                                             | `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the API service                                                                                                                                                                                                                                                                                                       |
| **Resend**         | email                                                                                                        | testing mode, sender `onboarding@resend.dev` ⚠️ (assumed from instructions; user confirmed the email arrived)                                                                                                                                                                                                                                                      |
| **GitHub Actions** | CI                                                                                                           | green on `cf1944a` ✅                                                                                                                                                                                                                                                                                                                                              |

**Environment variable names** (values are 🔒 and live only in the platforms / local `apps/api/.env`, which is git-ignored):

- Railway (API): `BETTER_AUTH_SECRET` 🔒, `DATABASE_URL` 🔒, `WEB_ORIGIN` (= `https://sagarnu-bay.vercel.app`), `RESEND_API_KEY` 🔒, `EMAIL_FROM`, `REQUIRE_EMAIL_VERIFICATION` (= `false` for now), optional `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 🔒, `MIGRATE_ON_START`, `LOG_LEVEL`. Railway sets `PORT`, `RAILWAY_GIT_COMMIT_SHA` itself. **Do not set `NODE_ENV`** on Railway (code defaults to production; setting it would make pnpm skip devDependencies at build).
- Vercel (web): `API_URL` (= `https://sagarnu-production.up.railway.app`, must be public https; the build fails otherwise), optional `NEXT_PUBLIC_GOOGLE_ENABLED`. Must be enabled for the Production environment; changes need a Redeploy (rewrite target is fixed at build time).
- Local: `apps/api/.env` with `BETTER_AUTH_SECRET`, `WEB_ORIGIN=http://localhost:3000`, `DATABASE_URL=pglite:local`, `NODE_ENV=development`. Templates: `apps/api/.env.example`, `apps/web/.env.example`.
- Future (not used yet): `GROQ_API_KEY`, `R2_*`, `WHATSAPP_*`.

In production the API refuses to start without a real `DATABASE_URL` and `WEB_ORIGIN` and lists every missing variable with Railway hints (`apps/api/src/env.ts`).

---

## 9. Git status (✅ inspected 2026-10-11)

- Branch: `main`, in sync with `origin/main`; this handoff file and the README are committed together with this update (the user asked to commit them).
- HEAD before this docs commit: `cf1944a feat(web): account settings screen`.
- Git-ignored local files: `apps/api/.env`, `apps/web/next-env.d.ts`, `*.tsbuildinfo`, `.data/`, `datasets/contracts/examples/*` (except `.gitkeep`), `datasets/**/*.pdf`.

---

## 10. Next steps (how to continue)

1. **Re-read** `Future/FUTURE_WORK.txt` (the user may have added items, especially in section 8) and this file. Don't redo anything marked `[x]`.
2. **Ask the user which item to take next.** Default proposal: remaining stage 1 items — i18n strings → Playwright E2E in repo — or phase 2 (AI contract analysis). (Domain purchase is the user's action; when done, follow the "דומיין ומיילים" checklist in FUTURE_WORK §6.)
3. **Local run** (PowerShell, after the PATH refresh above):
   ```
   pnpm install
   pnpm dev            # or separately: cd apps/api; pnpm dev   and   cd apps/web; pnpm dev
   ```
   Web http://localhost:3000, API http://localhost:8080. Emails print in the API log.
4. **Before each commit:** `pnpm check`; new DB columns → edit `packages/db/src/schema/*` then `pnpm --filter @sagarnu/db db:generate --name <change>` and commit the generated SQL + `meta/`.
5. **After each push:** check CI (GitHub API curl), and for API/package changes check `https://sagarnu-production.up.railway.app/v1/health` shows the new short SHA.
6. **Verify UI changes** in a real browser (playwright-core + Edge) at desktop and 390px width; look at screenshots.
7. Mark finished FUTURE_WORK items `[x]`, commit + push per module.
