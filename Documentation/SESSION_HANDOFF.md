# Sagarnu — session handoff

Checkpoint written 2026-10-11 before `/compact`; updated 2026-10-11 (`453d9ce` → `cf1944a`), 2026-10-13 (`bf15ac6` → `a4d698e`) and again 2026-10-13 before `/compact` (`1634d21` → `f0816d1`: research, redesign plan, audit, skills, brand brief). Covers the work sessions of 2026-10-10 to 2026-10-13.

**Legend:** ✅ verified in this session (tests, browser run, live HTTP check, or git) · ⚠️ assumption / not verified · 🔒 secret (name only, never the value).

Related docs (read these too, they are kept up to date):

- `docs/PLAN.txt` — the approved plan (Hebrew, RTL marks per line). Source of truth for scope and phases.
- `Future/FUTURE_WORK.txt` — Hebrew roadmap/checklist, edited by both the user and Claude. Section 8 holds the user's own notes ("הערות של גיא והגר"); the user asked that every implemented item be marked `[x]`.
- `SETUP.txt` — Hebrew step-by-step deploy guide for the user (Railway → Vercel → Resend → Google → Groq → Meta).
- `README.md` — dev quick start, layout table, live URL.
- `datasets/contracts/README.md`, `datasets/contracts/SCHEMA_GAPS.md` — contract-extraction ground-truth dataset and schema gaps.
- `CLAUDE.md` (repo root) — short project rules loaded automatically by every Claude Code session (Hebrew replies, he.ts, RTL, migrations, `pnpm check` + `pnpm e2e`, commit per module, Windows notes).
- `docs/design/` — the redesign: `PLAN.md` (phases 0–5, one per session, with status checkboxes and ready prompts), `AUDIT.md` (phase 0 audit), `BRAND.md` (phase 1: three brand directions), `brand-preview.html` (visual comparison), `SKILLS.md` (installed skills, sources, pinned commits). Screenshots go to `docs/design/shots/` (git-ignored).
- `reports/מיתוג מחדש ומקורות מחירי ספקים.md` — deep-research report (redesign skills + prompts; Israeli vendor price sources; price-estimation method). Its working notes in `research_notes/` are git-ignored.

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
| Tests    | Vitest 5 (unit + API integration on in-memory PGlite); Playwright 1.64 E2E in `e2e/` (`pnpm e2e`; local Edge, CI Chromium)                                      |
| CI       | GitHub Actions `.github/workflows/ci.yml`: job `check` (frozen install → format:check → lint → typecheck → test) + job `e2e`                                    |
| Excel    | exceljs 4.4 (API only) for the expenses export                                                                                                                  |

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
e2e/          @sagarnu/e2e — Playwright config (own ports 3100/8180, in-memory DB), specs, clean-next.mjs
datasets/     @sagarnu/datasets — contract ground-truth template, docs, validator (not deployed)
Future/       FUTURE_WORK.txt roadmap + contract_extraction.schema.json (phase-2 design)
docs/PLAN.txt approved plan
SETUP.txt     Hebrew deploy guide
Documentation/SESSION_HANDOFF.md  this file
```

Key API files: `apps/api/src/app.ts` (route registration, auth handler, health), `env.ts` (env validation), `auth.ts` (Better Auth config + password-policy hook), `lib/access.ts` (`eventAccess` → 404 for non-members), `services/ledger.ts` (loads contracts/schedule/payments/files, computes DTOs), `routes/{me,events,contracts,cover,payment-files,contract-files,expenses-export,invitations}.ts`, `lib/auth-limits.ts` (5/min login & reset limiter), `lib/files.ts` (type sniffing from bytes, incl. Word).

UI text: every user-facing string is in `packages/i18n/src/he.ts`, grouped by screen; an ESLint rule rejects Hebrew literals in `apps/web/src`. Name/payer labels: `packages/i18n/src/people.ts` (`partnerName`, `payerLabels`, `payerLabel`). E2E: `e2e/` (Playwright, `pnpm e2e`, separate CI job).

Key web files: `components/shell/app-shell.tsx` (header, nav, event switcher, `UserMenu`), `components/contracts/contract-dialog.tsx` (view/edit contract form), `components/contracts/vendor-drawer.tsx` (side panel), `components/payments/*`, `app/e/[eventId]/*` pages, `app/events/page.tsx`, `app/(auth)/*` incl. `invite/[token]`, `app/settings/page.tsx` + `components/settings/*` (profile, password, sessions, data cards), `components/shell/plain-shell.tsx` (header shared by `/events` and `/settings`), `components/settings/google-card.tsx`, `components/contracts/contract-files.tsx`, `components/payments/payer-picker.tsx`, `lib/auth-client.ts` (`googleEnabled`, `googlePublic` flags).

---

## 2. Current state

### Implemented and verified ✅

- **Auth:** sign-up (couple/planner), login with "remember me", forgot/reset password, verify-email page, show/hide password, Hebrew error messages (wrong credentials → link to sign-up with email prefilled; weak password → unmet rules in red; server down → "השרת לא זמין"), `?next=` return path (same-site only, `lib/next-path.ts`). Password policy (8+ chars, A–Z, digit, special) enforced client and server. **Rate limit:** sign-in, request-password-reset and reset-password limited to 5/min per IP **and** per email (in-memory counter, 429 + `Retry-After`, web shows "יותר מדי ניסיונות"). **"Remember me" off** → 24-hour non-renewing session (Better Auth already did this; now pinned by a test). Login/sign-up refresh the cached session before navigating (fixed: logging in again after a logout in the same tab bounced back to `/login`).
- **Google sign-in** (✅ live, 2026-10-12): Google Cloud project "Sagarnu", OAuth client with redirect `https://sagarnu-bay.vercel.app/v1/auth/callback/google` (+ localhost:3000); app in **Testing** mode with test users Guy and Hagar. Better Auth refuses to auto-link Google to an existing password account whose email is unverified (`requireLocalEmailVerified`, anti-takeover) → `/login?error=account_not_linked` now shows a Hebrew explanation, and `/settings` has "חיבור חשבון Google" (`linkSocial`; `MeDto.hasGoogle`). Guy linked his account and signed in with Google ✅. Because only test users can use it, the button is shown **disabled with "בקרוב"** unless `NEXT_PUBLIC_GOOGLE_PUBLIC=true` (not set); the settings card shows only to already-linked accounts.
- **Account settings** (`/settings`, user menu → "הגדרות החשבון"): name, account type (couple/planner), phone (normalized to international format in `@sagarnu/domain` `phone.ts`) + WhatsApp consent with date (needs a phone; removing it withdraws consent), change password (optionally sign out other devices), signed-in devices list (sign out one / all others), JSON data export (`GET /v1/me/export`, no file contents or secrets), account deletion (`DELETE /v1/me`, password required; solo events deleted, shared events stay with members; refused while sole owner of a shared event; the user's sent invitations are deleted). Migration `0003_account_deletion`: `event.created_by` nullable, `ON DELETE SET NULL`. Not yet: changing the email address (needs a real email domain).
- **Onboarding questionnaire** (`/onboarding`): date/time ("לא ידוע עדיין" per field), noon/evening **derived from start time** (<17:00 = noon; server enforces), guests, budget, place, names, style (`hall, garden, outdoor=שטח, home=בית, festival=פסטיבל (לינה), restaurant, other`), kashrut, ceremony, relevant categories + **custom categories**. **People step:** each partner has a name + **groom/bride** chips (`partner1Role`/`partner2Role`, any combination); field labels follow ("שם החתן", "שם הכלה הראשונה"…), plus **"מאיפה ייצאו רוב התשלומים?"** (`defaultPayer` + `defaultPayerName`). Same fields in event details. Migration `0004_payers_and_partner_roles`.
- **Dashboard** (`/e/[id]`): countdown in **calendar days only**, personal **cover photo** (resized client-side to 1600px JPEG, stored in DB), next payment, overdue list, budget bar, vendor counts, missing categories, event details.
- **Contracts** (`/e/[id]/contracts`): category tabs with visible scrollbar/arrows (`ScrollRow`), contract cards. Clicking a card opens the **contract form locked ("צפייה בלבד")**; "עריכה" unlocks; "ביטול" reverts; "שמירה" saves fields → schedule diff (add/update/remove pending items) → status (confirmation when leaving "approved"). Paid/cancelled items locked. Error summary next to Save listing every invalid field (clickable). Links get `https://` auto-prefixed. Fields include ח.פ/ע.מ and "days after the event". Schedule rows with a relative timing (days before/after the event, after signing) show the **resolved date** under the row, update when the anchor date changes, flag a date already passed, and explain when the anchor date is missing. **Contract files:** under "קישור לחוזה" upload PDF/Word/image (≤10MB, ≤5 per contract; table `contract_file`, migration `0005_contract_files`; routes `POST /contracts/:id/files`, `GET|DELETE /contract-files/:fileId`; PDFs/images inline in a sandbox, Word downloads). New contracts upload picked files right after creation. "צפייה בחוזה" in view mode.
- **Vendor drawer** (side panel): status badge (read-only), installments with "סמן כשולם", payment history with **attached files** (receipt/confirmation), attach later, delete, **who paid** (clickable for editors to change); links to the contract URL and each uploaded contract file; "עריכה" opens the form in edit mode.
- **Payments:** payment dialog with link **or file upload** per kind (PDF/JPG/PNG/WebP ≤5MB, images resized to JPEG and renamed `.jpg`), **"מי שילם"** (`payer`: partner1/partner2/joint/partner1_parents/partner2_parents/other + `payerName`; labels use the couple's names; defaults to the event's `defaultPayer`; older payments = null → "לא צוין"), overpay confirmation, "next payment" prompt.
- **Expenses** (`/e/[id]/expenses`): totals tiles, table (cards on mobile), numbers right-aligned, **"מי שילם" filter** chips with each payer's total (`ExpensesDto.paidBy`, per row `paidBy`, `totalsByPayer` in domain), **"ייצוא לאקסל"** → `GET /expenses/export[?payer=<payerKey>]`: RTL .xlsx, sheets "הוצאות" (approved vendors + SUM row) and "תשלומים" (every payment with method, payer, installment, contract status).
- **Event details** (`/e/[id]/details`), delete event.
- **Planner mode + sharing:** planners land on **"האירועים שלי"** (`/events`); after creating an event → `/e/[id]/members?invite=1`. Sharing screen: invite by email + role (editor/viewer), one-time link (7 days) with copy + WhatsApp, pending invitations with cancel, change roles, remove members, leave event, last-owner protection. `/invite/[token]` public preview → sign up/log in → join.
- **Test suite** (✅ all green locally and in CI on `a4d698e`): domain 28, schemas 11, i18n 6, db 1, api 42, datasets 8 tests; **E2E 10 specs** (sign-up + questionnaire incl. groom/bride, logout/login, Google error message, auth redirect, contract + payment, contract view/edit, contract file upload, phone-width layout, payer flow + Excel download, settings incl. account deletion, planner↔couple sharing).
- **Screenshots reviewed** (desktop + 390px) for the new screens: people step, payer picker, vendor drawer payer, expenses filter, contract files.

### Deployed and verified live ✅

- Railway runs **`a4d698e`** (`GET /v1/health` → `{"ok":true,"commit":"a4d698e"}`, ✅ checked 2026-10-12); migrations `0000`–`0005` applied (server boots only after migrating). Vercel deployment of `a4d698e` completed (GitHub commit status) and the login page shows Google as "בקרוב" ✅.
- Google OAuth on the live site ✅: redirect reaches Google with the right `redirect_uri`; Guy linked Google in settings and signed in with it.
- Live smoke tests (2026-10-11): sign-up, festival style, derived noon, custom category, cover photo upload/serve, link-with-spaces rejected (422), invitation route (404 for fake token), payment-file route (401 without session).
- Resend in **testing mode**: a password-reset email to the account owner's address arrived (in spam).

### Not verified ⚠️

- The invitation and payment-file features were clicked through only locally; on the live site only route-level HTTP checks were done.
- Settings screen, account deletion/export, the rate limiter, payer/roles, contract files and the Excel export were not smoke-tested on the live site (deploy verified via `/v1/health`; covered by local API + E2E tests).
- The .xlsx was checked by reading it back in tests (values, RTL, filter), not opened in real Excel.

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
| `1c53e6a`            | docs: README features + this handoff committed                                                                                                                         |
| `bf15ac6`            | fix(web): re-login after logout in the same tab no longer bounces to `/login` (refresh session before navigating)                                                      |
| `4c55b5a`, `5cd2bad` | Playwright E2E in repo + CI job; `RATE_LIMITS=false` env for E2E (refused in production); OneDrive read-only `.next` cleanup before the E2E build                      |
| `e3177d9`            | all UI text moved to `he.ts`; ESLint rule against Hebrew literals in `apps/web/src`                                                                                    |
| `5f5862f`, `4949301` | partner roles (groom/bride) + who paid (`payer`), migration `0004`, expenses payer filter (FUTURE_WORK §8 items 7–8)                                                   |
| `7e83e89`            | Google sign-in: error message on `/login`, "connect Google" in settings, `MeDto.hasGoogle`                                                                             |
| `e907db2`            | contract file upload/view (`contract_file`, migration `0005`)                                                                                                          |
| `a4d698e`            | Excel export of expenses (exceljs); Google button "בקרוב" unless `NEXT_PUBLIC_GOOGLE_PUBLIC=true`                                                                      |
| `1634d21`            | docs: README + this handoff through `a4d698e`                                                                                                                          |
| `fa9c114`            | FUTURE_WORK: §8 interactive planner contract review (comments + WhatsApp alerts, 7 tasks); new §9 "כמה זה אמור לעלות" (price estimation, ~65 tasks in phases A–H)      |
| `7831c20`, `12016af` | deep-research report in `reports/`; `research_notes/` git-ignored                                                                                                      |
| `8ae1046`            | `docs/design/PLAN.md` (redesign phases + prompts) and `CLAUDE.md`; `docs/design/shots/` git-ignored                                                                    |
| `619995d`            | redesign phase 0: `docs/design/AUDIT.md` (38 screenshots, code scan, WCAG contrast, top 10 issues)                                                                     |
| `fc31e6a`            | redesign skills vendored into `.claude/skills/` (Markdown only, pinned commits; `docs/design/SKILLS.md`); `.claude/skills/` in `.prettierignore`                       |
| `f0816d1`            | redesign phase 1: `docs/design/BRAND.md` with directions A/B/C + `brand-preview.html`                                                                                  |

User's own commits (FUTURE_WORK edits only): `d03c2f2`, `4dc4199`, `45b2d72`, `1363767`.

---

## 4. Current task

**Status: redesign phase 1 done, waiting for the user (Guy and Hagar) to choose a brand direction.** No application code changed since `a4d698e` (the live site is still that version); everything since is docs, research and skills, all committed and pushed (`f0816d1`).

The redesign ("before stage 2", the user's request) follows `docs/design/PLAN.md`:

- [x] Setup — skills vendored into `.claude/skills/` (not via `npx`/plugins; see `docs/design/SKILLS.md`): `frontend-design` (official), `redesign-existing-projects` (taste-skill), emilkowalski's `animate`, `animation-vocabulary`, `animation-performance`, `find-animation-opportunities`, `improve-animations`, `review-animations` (manual only: `/review-animations`), `ask-sonner`, and skills-il's `hebrew-rtl-best-practices`, `hebrew-tailwind-preset`. They load at session start.
- [x] Phase 0 — `docs/design/AUDIT.md`. Top issues: no hierarchy around "how much is left" (countdown hero dominates), 6 failing contrast pairs (`muted` on canvas 4.34, `muted` on soft, success/warning on soft, `gold`, input borders `line` 1.26:1), **a real bidi bug** — `.num` (`direction: ltr`) wraps whole Hebrew sentences so ₪ jumps (`expenses/page.tsx:235` mobile "₪הבא: …", also `e/[eventId]/page.tsx:135` "עד …", `vendor-drawer.tsx:56` "נותר …"), three different ₪ formats, inverted scroll-row chevrons (`scroll-row.tsx:91-99`), `Select` without an arrow, identical SaaS cards / 8 radii / 5 shadows, Heebo + raspberry gradient + rings logo, 32–36px touch targets, no `reduced-motion`, no dark mode. The user was offered to fix the 3 small a11y/RTL bugs (select arrow, chevrons, ₪ bidi) before phase 1 or in phase 3 — **not answered yet**.
- [x] Phase 1 — `docs/design/BRAND.md` + `brand-preview.html` (screenshot sent to the user). Directions: **A "חוזה ודיו"** (Frank Ruhl Libre + IBM Plex Sans Hebrew; cool paper, ink blue `#2A3D78`; memorable: a "סגרנו" rubber stamp on the vendor card), **B "זית ורימון"** (Playpen Sans Hebrew display + Rubik UI; olive `#4B5A27`, pomegranate `#8C1D52` decorative; handwritten "סגרנו!" with pomegranate seeds), **C "ערב ירוק-עד"** (Noto Serif Hebrew thin display + Noto Sans Hebrew; light UI with one evergreen `#12392C` "evening band", champagne foil line, payment timeline; denser, planner-oriented). All keep existing token names, add `line-strong` and `on-brand`, have light+dark hex/OKLCH, pass 4.5:1 text / 3:1 borders (checked by script). Fonts verified (Hebrew, ≥4 weights, tabular digits): **Assistant has proportional digits → not for amounts**; Secular One/Suez One/Bellefair single weight → out; Heebo not the brand voice.
- [ ] Phase 2 — after the choice: tokens (keep names, change values), fonts via `next/font`, dev-only `/design-system` page, `.claude/skills/sagarnu-brand/SKILL.md` via skill-creator → stop for approval.
- [ ] Phases 3–5 — components, motion ("סגרנו!" moments), pages one per session.

The "סגרנו" branding item in FUTURE_WORK (slogan, per-category "סגרנו צלם! 📸" toasts, "סגרנו חשבון", "סגרנו הכל!") is now part of the redesign brief (the brand "moment").

---

## 5. Pending tasks (priority order)

From `Future/FUTURE_WORK.txt` (authoritative; re-read it — the user edits it):

1. **Stage 1 leftovers** (all done except:)
   1. Sign in with Apple — deferred until the mobile app (stage 5).
   2. Change email address in settings (after the email domain exists).
2. **Domain & email (before real users; the user waits for a final name):** buy domain → Vercel domain → update `WEB_ORIGIN` (Railway) and add the domain's origin + redirect URI in Google Clients → Resend domain (SPF, DKIM, DMARC) → `EMAIL_FROM=סגרנו <noreply@domain>` → **remove `REQUIRE_EMAIL_VERIFICATION`** so verification is required again → fill Google Branding (home page, privacy policy, terms, logo), **Publish** the Google app, set `NEXT_PUBLIC_GOOGLE_PUBLIC=true` in Vercel + Redeploy.
3. **Redesign / rebrand** (`docs/design/PLAN.md`, before phase 2 AI) — waiting for the direction choice; then phases 2–5. Includes the "סגרנו" branding item.
   3a. **FUTURE_WORK §8 interactive planner mode** (added 13/10): planner uploads a contract, the couple comments/approves, WhatsApp/email alert to the other side; 7 tasks (review status, `contract_comment`, notes tab, activity feed, alerts via phase 3, digest, tests).
   3b. **FUTURE_WORK §9 "כמה זה אמור לעלות"** (added 13/10): expected cost per vendor for the couple's month/region/guests + self-balancing budget. Cold start from published Israeli ranges (d.co.il, Attending via Bizportal, zap via N12, Walla, Mit4Mit — quote with attribution, never scrape) as weak log-normal priors in `price_prior`, hierarchical shrinkage with own signed contracts, P25/P50/P75, show a cell only with ≥10 contracts from ≥5 vendors, explicit opt-in under Amendment 13, no vendor-facing benchmarks without legal review. Details in the research report.
4. **Phase 2 — AI contract analysis** (see FUTURE_WORK §2, `docs/PLAN.txt` §6, `datasets/contracts/SCHEMA_GAPS.md`): R2 storage (also move cover photos, payment files and contract files from DB), `contract_analysis` table (`contract_file` + upload already exist), `apps/worker` (pg-boss), text extraction, OCR, Groq call using `Future/contract_extraction.schema.json`, review UI, `pnpm eval:contracts`, label 5–10 real contracts with `pnpm dataset:validate`. Decisions needed: category guess field, where to store confidence/warnings/raw_text, event-date mismatch warning, VAT normalization (plan Q7).
5. **Phase 3 — reminders** (Resend + WhatsApp via Meta; user handles Meta Business setup).
6. **Phase 4–5:** planner overview with per-event stats, restore deletes/audit UI, PDF export, PWA, billing, Expo app.
7. **Infra:** Sentry, Postgres backups (pg_dump → R2), Vercel Pro when commercial.

Plan open questions (§11) still unanswered by the user; defaults in use: neutral wording ("יש לשלם"), 09:00 send hour, VAT shown as in contract (`vatMode`); Shabbat/holiday skipping undecided.

---

## 6. Important decisions and conventions

**Decisions that deviate from `docs/PLAN.txt` (made with the user):**

- DB host **Railway Postgres**, not Neon (API + worker on Railway; pg-boss keeps a connection open).
- **No Docker** (user's request). Local dev uses embedded **PGlite**: `DATABASE_URL=pglite:local` → `%LOCALAPPDATA%\sagarnu\pglite-dev` (outside the repo **because the repo is under OneDrive**, which turns data files into ReparsePoint placeholders and breaks PGlite — "PGlite failed to initialize properly"). `pglite:memory` for tests.
- **Proxy architecture** (web rewrites `/v1/*` to the API) so cookies work without a shared custom domain.
- Files (cover photo `event_cover_photo`, payment files `payment_file`, contract files `contract_file`) stored as **bytea in Postgres** until R2 exists (phase 2). File type sniffed from bytes; served with sandbox CSP.
- **Google linking safeguard kept on** (Better Auth `requireLocalEmailVerified`): existing unverified password accounts connect Google from settings instead of implicit linking.
- **Payer labels use the couple's names**, not groom/bride (works for every couple type); "other" takes a free-text name. Existing payments stay "לא צוין" (user's choice) and can be changed in the vendor drawer.
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
- Inserting code through `node -e '…'`/sed in Bash strips backslashes (regexes, `\u` escapes, Windows paths) and drops literal invisible characters — use the Edit/Write tools or a `.py`/`.cjs` script file in the scratchpad. Long Bash heredocs with mixed quotes sometimes fail to parse in this tool ("unexpected EOF"); write the file with the Write tool instead. Python on Windows writes CRLF unless `newline=""`.
- Force-killing the dev servers (TaskStop / Stop-Process) is how local servers are stopped here; the DB is now outside OneDrive so this no longer corrupts it.
- UI checks: `pnpm e2e` (Edge locally). For screenshots, drop a temporary `e2e/tests/zz-shots.spec.ts` that saves to the scratchpad, run `pnpm exec playwright test zz-shots` in `e2e/`, then delete it. OneDrive marks `apps/web/.next` folders read-only (EPERM on `next build`); `e2e/clean-next.mjs` clears them before the E2E build.
- Railway logs: Deploy Logs search matches only the message text; use **Network Logs** (paths + status codes) to trace requests.
- Third-party skills are vendored as Markdown at pinned commits (see `docs/design/SKILLS.md`), never installed with `npx skills` / hooks. Font checks: download the Google Fonts woff2 and inspect with fontTools (`pip install --target <scratch>/pylib fonttools brotli`).
- Word export of a Markdown report: no pandoc/LibreOffice here; a small `docx` (npm) script in the scratchpad worked; Word COM automation hangs in the background — don't use it.

---

## 7. Known issues, risks, open questions

- **Email deliverability:** Resend has no verified domain → it only delivers to the Resend account owner and lands in spam. Railway therefore has `REQUIRE_EMAIL_VERIFICATION=false` (otherwise new users would be stuck at sign-up). Invitation emails to other people fail silently on the server (`emailSent: false`, UI tells the owner to share the link). Real users who forget their password cannot get a reset link yet.
- **Files in Postgres:** fine for now, but receipts/photos/contracts (up to 10MB each) grow the DB; must move to R2 (phase 2).
- **Google app in Testing:** only Guy and Hagar (test users) can sign in with Google; everyone else sees "בקרוב". Publishing needs the Branding tab completed (Google refused to publish without it).
- **Auth rate-limit counters are in memory** (`apps/api/src/lib/auth-limits.ts`) — fine for one API instance; move to Postgres/Redis when scaling out.
- `event_invitation.invited_by` still references `user` without `ON DELETE`; account deletion handles it by deleting the user's sent invitations first (`routes/me.ts`). Any other user-deletion path must do the same.
- Planner overview has no per-event financial stats yet (cards show date, place, guests, days left only).
- `/v1/auth/*` is proxied by building a Fetch `Request` from Fastify; works for GET/POST JSON and the Google OAuth callback ✅.
- Local E2E occasionally hits a one-off `ECONNRESET` or a slow API test under `pnpm check` load; a rerun passes.
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
| **GitHub Actions** | CI                                                                                                           | green on `a4d698e` ✅                                                                                                                                                                                                                                                                                                                                              |

**Environment variable names** (values are 🔒 and live only in the platforms / local `apps/api/.env`, which is git-ignored):

- Railway (API): `BETTER_AUTH_SECRET` 🔒, `DATABASE_URL` 🔒, `WEB_ORIGIN` (= `https://sagarnu-bay.vercel.app`), `RESEND_API_KEY` 🔒, `EMAIL_FROM`, `REQUIRE_EMAIL_VERIFICATION` (= `false` for now), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 🔒 (set 2026-10-12), `MIGRATE_ON_START`, `LOG_LEVEL`. `RATE_LIMITS=false` exists only for E2E runs and is refused in production. Railway sets `PORT`, `RAILWAY_GIT_COMMIT_SHA` itself. **Do not set `NODE_ENV`** on Railway (code defaults to production; setting it would make pnpm skip devDependencies at build).
- Vercel (web): `API_URL` (= `https://sagarnu-production.up.railway.app`, must be public https; the build fails otherwise), `NEXT_PUBLIC_GOOGLE_ENABLED=true` (set 2026-10-12), `NEXT_PUBLIC_GOOGLE_PUBLIC` (not set → Google shown as "בקרוב"; set `true` after publishing the Google app). Must be enabled for the Production environment; changes need a Redeploy (rewrite target is fixed at build time).
- Local: `apps/api/.env` with `BETTER_AUTH_SECRET`, `WEB_ORIGIN=http://localhost:3000`, `DATABASE_URL=pglite:local`, `NODE_ENV=development`. Templates: `apps/api/.env.example`, `apps/web/.env.example`.
- Future (not used yet): `GROQ_API_KEY`, `R2_*`, `WHATSAPP_*`.

In production the API refuses to start without a real `DATABASE_URL` and `WEB_ORIGIN` and lists every missing variable with Railway hints (`apps/api/src/env.ts`).

---

## 9. Git status (✅ inspected 2026-10-13)

- Branch: `main`, in sync with `origin/main`, working tree clean before this docs update.
- HEAD before this docs commit: `f0816d1 docs(design): phase 1 brand brief with three directions`. Live site (Railway/Vercel) still runs `a4d698e` code; later commits are docs/skills only.
- Git-ignored working folders: `research_notes/`, `docs/design/shots/`.
- Git-ignored local files: `apps/api/.env`, `apps/web/next-env.d.ts`, `*.tsbuildinfo`, `.data/`, `datasets/contracts/examples/*` (except `.gitkeep`), `datasets/**/*.pdf`.

---

## 10. Next steps (how to continue)

1. **Re-read** `Future/FUTURE_WORK.txt` (the user may have added items, especially in section 8) and this file. Don't redo anything marked `[x]`.
2. **Ask which brand direction (A/B/C, or a combination with one memorable element) Guy and Hagar chose**, and whether to fix the 3 small a11y/RTL bugs from AUDIT now. Then run phase 2 from `docs/design/PLAN.md` (start a fresh session with the opening line there; Plan mode recommended). After the redesign: phase 2 AI contract analysis (open decisions: category guess, where confidence/warnings live, event-date mismatch warning, VAT normalization). Domain/Google publish remains the user's action (§5 item 2).
3. **Local run** (PowerShell, after the PATH refresh above):
   ```
   pnpm install
   pnpm dev            # or separately: cd apps/api; pnpm dev   and   cd apps/web; pnpm dev
   ```
   Web http://localhost:3000, API http://localhost:8080. Emails print in the API log.
4. **Before each commit:** `pnpm check` (and `pnpm e2e` for UI changes); new DB columns → edit `packages/db/src/schema/*` then `pnpm --filter @sagarnu/db db:generate --name <change>` and commit the generated SQL + `meta/`.
5. **After each push:** check CI (GitHub API curl), and for API/package changes check `https://sagarnu-production.up.railway.app/v1/health` shows the new short SHA.
6. **Verify UI changes** with E2E specs and screenshots at desktop and 390px width (see Windows notes in §6).
7. Mark finished FUTURE_WORK items `[x]`, commit + push per module.
