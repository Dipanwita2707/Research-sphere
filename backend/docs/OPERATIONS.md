# Backend operations

Node/Express API + Prisma 5 on PostgreSQL (Neon). Multi-tenant: one database, every
tenant-owned row carries `universityId`. Run all commands from `backend/`.

## 1. Setup from scratch

1. **Install.** Run `npm ci`. `postinstall` runs `prisma generate`.
2. **Environment.** Run `cp .env.example .env` and fill in the values. Every variable
   is listed there with a comment. You need at least:
   - `DATABASE_URL`: the Neon connection string. The app can use the pooled
     (`-pooler`) host. For `prisma migrate deploy`, use the direct (non-pooler) host,
     because migrations take advisory locks that PgBouncer does not support.
   - `JWT_SECRET`: 32 characters or more, random. Production refuses to start
     without it. Generate one with
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
   - Licensing. For local development, set `LICENSE_WHITELIST_LOCAL=true` and leave
     `LICENSE_KEY` empty (or set it to `LOCAL_DEV_WHITELISTED`). In production,
     `LICENSE_KEY` is issued from Superadmin → Licenses and verified against
     `LICENSE_SERVER_URL`.
3. **Schema.** Run `npx prisma migrate deploy` (or `npm run prisma:deploy`). This
   applies `prisma/migrations/*`. Never use `prisma db push` or `migrate dev`
   against a shared or production database. `prisma/_archive/` is history only.
4. **Platform superadmin.** Run `npm run seed:superadmin`. It creates `SUPER001`, or
   the uid from `--uid` / `SUPERADMIN_UID`, only if that uid does not exist yet. The
   password comes from `SUPERADMIN_PASSWORD`. If that is unset, a random password is
   generated and **printed once**; store it and change it after first login. Running
   the script again never resets a password. With `NODE_ENV=production` it also
   needs `--force`.
5. **Demo data (development only).** Run `npm run seed`, or
   `npm run seed -- --university DEMO` for another demo tenant. It creates the tiers
   `starter`, `growth` and `enterprise`, then university `SGT` (slug `sgt`) with an
   active one-year subscription and a placeholder DPO. Inside that university it
   creates the central departments (DRD, IPR, FINANCE, HR, REGISTRAR, ADMISSIONS),
   one school, department, program and section, and the users
   `SGT-ADMIN`, `SGT-FAC001`, `SGT-STF001` and `SGT-STU001`. Passwords come from
   `SEED_DEFAULT_PASSWORD` or are generated and printed once. The seed is
   idempotent and refuses `NODE_ENV=production` unless you pass `--force`.
6. **Optional per-tenant configuration.**
   - `npm run seed:research-policy -- --university SGT`
   - `npm run seed:conference-policies -- --university SGT`
7. **Run.** Use `npm run dev` for development or `npm start`. The health check is
   `GET /health`.

## 2. Creating a tenant (production)

1. Log in as the superadmin (frontend `/superadmin`).
2. **Tier:** use Superadmin → Billing/Tiers, which calls `POST /api/v1/superadmin/tiers`.
   You can skip this if a suitable tier already exists.
3. **University:** use Superadmin → Universities → New, which calls
   `POST /api/v1/superadmin/universities` with `code`, `slug`, `tierId` and the first
   admin's `adminUsername`, `adminEmail` and `adminPassword`. This creates the
   university, a 30-day `trialing` subscription and the tenant admin in one
   transaction.
4. Set the DPO / grievance officer details (`dpoName`, `dpoEmail`, `dpoPhone`) on the
   university. The DPDP notices show them to data principals.
5. When payment is confirmed, move the subscription to `active`. Access is blocked
   when the subscription is not `active`/`trialing`, or when `currentPeriodEnd`
   plus `SUBSCRIPTION_GRACE_DAYS` has passed. Suspending a university
   (`POST /universities/:id/suspend`) blocks all of its users immediately.
6. The tenant admin then creates schools, departments, users and policies from
   inside the tenant.

## 3. Running with PM2

`ecosystem.config.js` runs `src/server.js` in cluster mode.

```bash
pm2 start ecosystem.config.js --env production
pm2 save && pm2 startup
```

- Cron schedulers (publication sync, API-usage aggregation, workflow health, DPDP retention) run
  only on PM2 instance 0, and only when `RUN_JOBS` is not `false`. On extra web-only
  replicas (other hosts or containers), set `RUN_JOBS=false` so jobs run exactly
  once. BullMQ queue workers are safe on every instance. See `src/jobs/jobRunner.js`.
- `DB_POOL_SIZE` is per worker. Keep `instances × DB_POOL_SIZE` below the Neon pooler
  limit.
- Use `pm2 reload` for zero-downtime deploys. Run `npx prisma migrate deploy`
  before the reload.

## 4. Backups and restore (Neon)

- Neon keeps a point-in-time history for the project (retention depends on the plan;
  set it to at least 7 days for production). No application-level dump is needed
  for normal operation.
- **Restore:** in the Neon console, create a branch from a timestamp before the
  incident, check the data on that branch, then either promote it or point
  `DATABASE_URL` at it. Restore the whole database; you cannot restore a single
  tenant in place. To recover one tenant's rows, restore to a branch and copy those
  rows (filtered by `university_id`) back.
- Take an extra logical backup before risky migrations:
  `pg_dump "<direct connection string>" -Fc -f backup-$(date +%F).dump`.
- Uploaded files (S3 / `uploads/`) are not in the database. Enable versioning on the
  S3 bucket.
- Test a restore at least once per quarter.

## 5. How tenant isolation works

Code lives in `src/shared/tenancy/`: `tenantContext.js` and `tenantExtension.js`.

- `protect` (`src/shared/middleware/auth.js`) resolves the user's university, checks
  that the tenant is active and subscribed, and runs the rest of the request inside
  `tenantContext.run({ tenantId, ... })` (AsyncLocalStorage).
- The Prisma client exported by `src/shared/config/database.js` is extended with
  `tenantExtension`. Inside a tenant context:
  - every read, update and delete on a model with `universityId` is filtered to
    that tenant;
  - every create, including nested creates, is stamped with the tenant's id;
  - a write into another tenant throws `TenantViolationError` (HTTP 403).

  As a result, a foreign id behaves as "not found".
- A superadmin without an `X-University-Id` header, and code running outside any
  context, is unscoped. That code must pass `universityId` explicitly on every
  write, as the seeds do.
- Jobs and scripts wrap per-tenant work in `tenantContext.runForTenant(id, fn)`.
  Deliberate cross-tenant reads use `tenantContext.runAsSystem(fn)`.
- `$queryRaw` / `$executeRaw` are **not** scoped. Filter them by `university_id`
  yourself.
- Cache keys are prefixed with the tenant automatically.

## 6. Tests

- `npm test` runs the unit and structural suites. Suites under
  `__tests__/integration` and `__tests__/e2e` need a database or a running server,
  so they only run with `RUN_DB_TESTS=1`.
- The tenant-isolation DB test runs inside a transaction that is rolled back:
  `RUN_DB_TESTS=1 npx jest src/shared/tenancy`.
