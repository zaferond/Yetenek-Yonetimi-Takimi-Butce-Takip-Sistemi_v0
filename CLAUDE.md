# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Local budget-tracking app for a Talent Management team (Turkish UI, Turkish user-facing messages and docs). React 19 + TypeScript frontend, Express 5 API, SQLite via Node's built-in `node:sqlite`. Requires **Node 24+**. No ORM, no separate DB server.

## Commands

```sh
npm ci
npm run setup        # create DB + first user (prints a random password once unless ADMIN_PASSWORD set; min 12 chars)
npm run dev          # API + Vite middleware on one port (default 127.0.0.1:3100)
npm run build        # tsc --noEmit + vite build into dist/
npm start            # serves API + built dist/
npm test             # node --test tests/*.test.mjs
node --test tests/store.test.mjs                      # single test file
node --test --test-name-pattern="CSRF" tests/*.test.mjs # single test by name
npm run test:ui      # build + Playwright check (scripts/ui-check.mjs, port 3198, in-memory DB)
npm run verify       # test + build
npm run format       # prettier (no linter configured)
npm run backup       # consistent SQLite backup + integrity check into data/backups/
ALLOW_DEMO_RESET=YES npm run demo:reset   # wipes local demo DB data (refused in production / non-default DB_PATH)
npm run db:export:mssql                   # MSSQL migration package (see docs/MSSQL.md)
```

`test:ui` uses local Chrome by default; without it run `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. Screenshots go to `test-results/` (git-ignored).

CI (`.github/workflows/verify.yml`) runs `npm test`, `npm run build`, then the UI check with `PLAYWRIGHT_CHANNEL=chromium`.

Env vars (read via `--env-file-if-exists=.env`, see `.env.example`): `HOST`, `PORT`, `APP_ORIGIN` (must exactly match the browser URL — used for Origin/CSRF checks), `DB_PATH`, `SEED_DEMO`, `COOKIE_SECURE`. `NODE_ENV=production` requires an https `APP_ORIGIN` and `COOKIE_SECURE=true`. Passwords: `scripts/reset-password.mjs`, sessions: `scripts/revoke-sessions.mjs`.

## Architecture

- `backend/server.mjs` — entrypoint; builds `Store`, calls `createApp`, and in `--dev` mounts Vite as middleware.
- `backend/store.mjs` — the `Store` class owns all SQL and business rules. It applies `schema.sql` and runs ad-hoc `ALTER TABLE` migrations in its constructor (check `PRAGMA table_info` before adding columns). `snapshot(year, versionId)` builds the single state payload the UI renders. `seedDemo()` creates demo data.
- `backend/app.mjs` — `createApp(store, {origin, secure})`: Express routes, cookie sessions (hashed token in `sessions`), CSRF via `X-CSRF-Token` header, login rate limiting. Write routes are wrapped in `mutation(action, entity, fn)`, which enforces roles (`admin`/`editor`/`viewer`; viewers are read-only) and writes `audit_logs`. Role checks live in the API, not just the UI. `admin.mjs` holds user/role management; `auth.mjs` holds scrypt password hashing, token/digest helpers and the `budget_session` cookie reader.
- `shared/domain.mjs` — validation and money math used by both backend and tests: amounts are **BigInt micro-units (`SCALE = 1000000n`)** kept in `*_units` INTEGER columns (all tables are `STRICT`). Plan and invoice amounts are VAT-excluded TL. Input uses Turkish format (`1.250,50`). More than 6 decimals is rejected, not rounded. Display rounds half-up to 2 decimals. Never use floats for money. `report-scope.mjs` holds the filter logic shared by the Excel exports.
- `backend/*-export.mjs` — ExcelJS reports per screen; they must honor the same year/period/filters as the screen.
- `frontend/src` — `main.tsx` handles auth bootstrap, `Workspace.tsx` is the main screen with all sections, `api.ts` is a fetch wrapper that sends the CSRF token, and `navigation.ts` defines the sections. Styles go through `styles/tokens.css`.
- Core calculations (see README "Hesaplama kararları"): remaining = plan − actual (active invoice lines); available = remaining − unbilled planned payments; pending payment = planned − matched invoices − savings.
- Savings (`planned_payments.saving_units`) appear in every version of that year on the Versiyon & Tasarruf screen and are not subtracted from the plan. Cancelled invoices and payments use `status='cancelled'` and are not deleted.
- `schema.mssql.sql`, `scripts/export-mssql.mjs`, and `docs/MSSQL.md` prepare a future MSSQL migration only. The runtime is SQLite.
- `docs/` (Turkish) holds requirements (`GEREKSINIMLER.md`), acceptance and test coverage notes (`KABUL.md`), operations, backup restore and HTTPS (`ISLETIM.md`), and the UI/screen plans. Check these before changing behavior that users have specified.

Tests create `new Store(":memory:")` and start `createApp` on port 0, so they never touch `data/`. `data/` (DBs, backups) is git-ignored and must stay out of commits.

## Local customizations

The year list is currently limited to 2027+ (`WHERE year>=2027` in `Store.snapshot`). The default year is 2027 in `Workspace.tsx` and in `/api/state`. The 2026 data still exists in the DB.
