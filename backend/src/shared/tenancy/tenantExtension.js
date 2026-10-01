/**
 * @module tenantExtension
 * @description Prisma client extension that enforces tenant isolation centrally.
 *
 * Every model with a `universityId` column is tenant-owned. While a tenant
 * context is active (see tenantContext.js) this extension:
 *   - adds `universityId = <tenant>` to the where of every read, update and delete
 *   - stamps `universityId` onto every create, including nested creates
 *   - rejects writes that would move a row to, or create it in, another tenant
 *
 * Handlers therefore cannot leak or corrupt another tenant's data by forgetting
 * a filter: a lookup by id of a foreign row behaves as "not found".
 *
 * Not covered (by design): $queryRaw/$executeRaw, and rows reached through
 * `include`/`select` of a relation — those are reachable only from a row that
 * already passed the tenant filter.
 */
const { Prisma } = require('@prisma/client');
const tenantContext = require('./tenantContext');
const { relationFromFields } = require('./schemaRelations');

const TENANT_FIELD = 'universityId';

/** Models whose rows with universityId = null are global and readable by every tenant. */
const SHARED_MODELS = new Set(['Role', 'ConsentNotice', 'DataRetentionPolicy']);

const READ_OPS = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy',
]);
const WHERE_WRITE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

// ── DMMF-derived metadata ────────────────────────────────────────────────────
const MODELS = new Map(); // name → { tenantRel, relations: Map(field → { type }), fkScalars: Set }
for (const model of Prisma.dmmf.datamodel.models) {
  const relations = new Map();
  const fkScalars = new Set();
  let tenantRel = null;
  let hasTenantField = false;
  for (const f of model.fields) {
    if (f.name === TENANT_FIELD && f.kind === 'scalar') hasTenantField = true;
    if (f.kind !== 'object') continue;
    relations.set(f.name, { type: f.type });
    // Prisma 5 exposes relationFromFields in the DMMF; Prisma 7 does not, so fall back to the schema.
    const fromFields = f.relationFromFields || relationFromFields(model.name, f.name);
    for (const fk of fromFields) fkScalars.add(fk);
    if (fromFields.includes(TENANT_FIELD)) tenantRel = f.name;
  }
  MODELS.set(model.name, { tenant: hasTenantField, tenantRel, relations, fkScalars });
}

class TenantViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenantViolationError';
    this.statusCode = 403;
    this.isOperational = true;
    this.status = 'fail';
  }
}

// ── where scoping ────────────────────────────────────────────────────────────
const andWhere = (where, filter) => {
  if (!where) return filter;
  const existing = where.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
  return { ...where, AND: [...existing, filter] };
};

const readFilter = (model, tenantId) => {
  if (model === 'University') return { id: tenantId };
  if (SHARED_MODELS.has(model)) return { OR: [{ [TENANT_FIELD]: tenantId }, { [TENANT_FIELD]: null }] };
  return { [TENANT_FIELD]: tenantId };
};

const writeFilter = (model, tenantId) =>
  model === 'University' ? { id: tenantId } : { [TENANT_FIELD]: tenantId };

// ── data stamping / guarding ─────────────────────────────────────────────────
const connectedId = (relValue) => relValue?.connect?.id;

/** Throw if data tries to point the row at another tenant. */
const guardTenantChange = (model, data, tenantId) => {
  const meta = MODELS.get(model);
  if (!meta?.tenant || !data) return;
  if (data[TENANT_FIELD] !== undefined && data[TENANT_FIELD] !== tenantId) {
    throw new TenantViolationError(`Cross-tenant write blocked on ${model}`);
  }
  if (meta.tenantRel && data[meta.tenantRel] !== undefined) {
    const id = connectedId(data[meta.tenantRel]);
    if (id !== tenantId) throw new TenantViolationError(`Cross-tenant write blocked on ${model}`);
  }
};

/** Does this create payload use relation objects (checked input) rather than FK scalars? */
const usesRelationInput = (meta, data) => {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (meta.fkScalars.has(key) && key !== TENANT_FIELD) return false;
  }
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && meta.relations.has(key)) return true;
  }
  return false;
};

const stampCreate = (model, data, tenantId, { scalarOnly = false } = {}) => {
  const meta = MODELS.get(model);
  if (!meta || !data || typeof data !== 'object') return data;
  const out = { ...data };
  if (meta.tenant) {
    guardTenantChange(model, out, tenantId);
    const alreadySet = out[TENANT_FIELD] !== undefined || (meta.tenantRel && out[meta.tenantRel] !== undefined);
    if (!alreadySet) {
      if (!scalarOnly && meta.tenantRel && usesRelationInput(meta, out)) {
        out[meta.tenantRel] = { connect: { id: tenantId } };
      } else {
        out[TENANT_FIELD] = tenantId;
      }
    }
  }
  return scalarOnly ? out : stampNested(model, out, tenantId);
};

const mapOneOrMany = (value, fn) => (Array.isArray(value) ? value.map(fn) : fn(value));

/** Walk relation fields of a create/update payload and stamp nested creates. */
const stampNested = (model, data, tenantId) => {
  const meta = MODELS.get(model);
  if (!meta || !data || typeof data !== 'object') return data;
  // Children created under a University get their universityId from the parent relation.
  if (model === 'University') return data;
  const out = { ...data };
  for (const [field, rel] of meta.relations) {
    const op = out[field];
    if (!op || typeof op !== 'object' || field === meta.tenantRel) continue;
    const child = rel.type;
    const next = { ...op };
    if (next.create) next.create = mapOneOrMany(next.create, (d) => stampCreate(child, d, tenantId));
    if (next.createMany?.data) {
      next.createMany = {
        ...next.createMany,
        data: mapOneOrMany(next.createMany.data, (d) => stampCreate(child, d, tenantId, { scalarOnly: true })),
      };
    }
    if (next.connectOrCreate) {
      next.connectOrCreate = mapOneOrMany(next.connectOrCreate, (c) => ({ ...c, create: stampCreate(child, c.create, tenantId) }));
    }
    if (next.upsert) {
      next.upsert = mapOneOrMany(next.upsert, (u) => ({
        ...u,
        create: stampCreate(child, u.create, tenantId),
        update: stampUpdate(child, u.update, tenantId),
      }));
    }
    if (next.update) {
      next.update = mapOneOrMany(next.update, (u) =>
        u && u.data && (u.where || Object.keys(u).length === 1)
          ? { ...u, data: stampUpdate(child, u.data, tenantId) }
          : stampUpdate(child, u, tenantId));
    }
    if (next.updateMany) {
      next.updateMany = mapOneOrMany(next.updateMany, (u) => {
        guardTenantChange(child, u?.data, tenantId);
        return u;
      });
    }
    out[field] = next;
  }
  return out;
};

const stampUpdate = (model, data, tenantId) => {
  guardTenantChange(model, data, tenantId);
  return stampNested(model, data, tenantId);
};

// ── the extension ────────────────────────────────────────────────────────────
const isTenantScoped = (model) => model === 'University' || MODELS.get(model)?.tenant;

/**
 * Rewrite the arguments of one top-level model operation for a tenant.
 * Pure function (no I/O) so it can be unit-tested directly.
 */
const scopeArgs = (model, operation, args, tenantId) => {
  const a = { ...(args || {}) };
  if (READ_OPS.has(operation)) {
    a.where = andWhere(a.where, readFilter(model, tenantId));
  } else if (WHERE_WRITE_OPS.has(operation)) {
    a.where = andWhere(a.where, writeFilter(model, tenantId));
    if (a.data) {
      if (operation === 'updateMany') guardTenantChange(model, a.data, tenantId);
      else a.data = stampUpdate(model, a.data, tenantId);
    }
  } else if (operation === 'upsert') {
    a.where = andWhere(a.where, writeFilter(model, tenantId));
    a.create = stampCreate(model, a.create, tenantId);
    a.update = stampUpdate(model, a.update, tenantId);
  } else if (CREATE_OPS.has(operation)) {
    if (model === 'University') throw new TenantViolationError('Tenants cannot create universities');
    a.data = operation === 'create'
      ? stampCreate(model, a.data, tenantId)
      : mapOneOrMany(a.data, (d) => stampCreate(model, d, tenantId, { scalarOnly: true }));
  }
  return a;
};

const tenantExtension = Prisma.defineExtension({
  name: 'tenant-isolation',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = tenantContext.getTenantId();
        if (!tenantId || !isTenantScoped(model)) return query(args);
        return query(scopeArgs(model, operation, args, tenantId));
      },
    },
  },
});

module.exports = { tenantExtension, TenantViolationError, scopeArgs, isTenantScoped };
