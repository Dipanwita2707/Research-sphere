/**
 * @module tenantContext
 * @description Request-scoped tenant context backed by AsyncLocalStorage.
 *
 * `protect` opens a context for every authenticated request; the Prisma tenant
 * extension (tenantExtension.js) reads it to scope every query automatically.
 *
 * Context shapes:
 *   - no context                 → unauthenticated / startup code: queries are NOT scoped
 *   - { tenantId: '<uuid>' }     → tenant user, or superadmin acting on one tenant: scoped
 *   - { tenantId: null }         → superadmin global view: not scoped
 *   - { system: true }           → explicit cross-tenant system work: not scoped
 *
 * Background jobs that touch tenant data must wrap each unit of work in
 * runForTenant(universityId, fn) so creates get the right universityId.
 */
const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

/**
 * Run fn inside a tenant context.
 *
 * Prisma queries are lazy: `prisma.x.findMany()` does nothing until something calls
 * `.then()`. With `runAsSystem(() => prisma.x.findMany())` that call happens in the
 * caller's `await`, OUTSIDE this context, so the query would silently run with the
 * caller's scope. Starting any returned thenable here keeps it inside the context.
 */
const run = (ctx, fn) =>
  storage.run(Object.freeze({ ...ctx }), () => {
    const result = fn();
    return result && typeof result.then === 'function' && !(result instanceof Promise)
      ? Promise.resolve(result)
      : result;
  });

/** Current context, or undefined outside any request/job scope. */
const get = () => storage.getStore();

/** Tenant id queries are currently scoped to, or null when unscoped. */
const getTenantId = () => {
  const ctx = storage.getStore();
  if (!ctx || ctx.system) return null;
  return ctx.tenantId || null;
};

/** Run fn scoped to one university (for jobs, scripts and superadmin provisioning). */
const runForTenant = (tenantId, fn) => {
  if (!tenantId) throw new Error('runForTenant requires a tenantId');
  return run({ tenantId, system: false }, fn);
};

/**
 * Run fn with tenant scoping disabled. Use only for deliberate cross-tenant work
 * (superadmin analytics, global uniqueness checks, retention jobs) and keep the
 * callback small so the bypass is easy to audit.
 */
const runAsSystem = (fn) => run({ tenantId: null, system: true }, fn);

/**
 * Wrap a callback-style middleware so the tenant context survives it.
 * AsyncLocalStorage does not follow EventEmitter callbacks: multer (busboy)
 * calls next() from the request stream's 'finish' handler, which would run the
 * rest of the request with NO tenant context — unscoped reads, unstamped creates.
 * Every multer middleware must be wrapped (enforced by the architecture test).
 */
const bindMiddleware = (middleware) => (req, res, next) => {
  const ctx = storage.getStore();
  middleware(req, res, (err) => (ctx ? storage.run(ctx, () => next(err)) : next(err)));
};

module.exports = { run, get, getTenantId, runForTenant, runAsSystem, bindMiddleware };
