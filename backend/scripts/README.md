# Backend scripts

Run everything from `backend/`. See `docs/OPERATIONS.md` for the full setup flow.

| Script | npm script | Purpose |
|--------|-----------|---------|
| `database/seeds/seed-superadmin.js` | `npm run seed:superadmin` | Create the platform superadmin if missing (password from `SUPERADMIN_PASSWORD` or generated and printed once). |
| `../src/shared/database/seed.js` | `npm run seed` | Idempotent dev/demo tenant (tiers, university, users, academic structure). |
| `database/seeds/seed-research-policy-updated.js` | `npm run seed:research-policy -- --university <CODE>` | Default research-paper incentive policies for one university (`--replace` to recreate). |
| `database/seeds/seed-conference-policy-not-indexed.js` | `npm run seed:conference-policies -- --university <CODE>` | Default conference incentive policies for one university. |
| `build-protected-dist.js` | `npm run build:protected` | Build the obfuscated production bundle. |
| `maintenance/healthcheck.js` | – | Container health check (copied by `Dockerfile.backend`). |
| `find-unindexed-fkeys.js`, `inspect-indexes.js`, `measure-rtt.js` | – | Read-only database diagnostics. |

Rules for new scripts:

- Seeds refuse to run with `NODE_ENV=production` unless `--force` is passed.
- Never hardcode passwords, user ids or tenant ids. Take them from arguments or env.
- Tenant data: require `--university <CODE>` and wrap the work in
  `tenantContext.runForTenant(universityId, fn)` using the shared Prisma client
  (`src/shared/config/database`), or pass `universityId` explicitly on every write.
- One-off debugging scripts do not belong in the repository.
