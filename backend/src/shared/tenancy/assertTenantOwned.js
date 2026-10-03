/**
 * @module assertTenantOwned
 * @description Verify that ids taken from a request (body/params) refer to rows of the
 * caller's tenant before they are written into another row.
 *
 * The tenant extension scopes the WHERE of every query and stamps universityId on
 * creates, but it cannot see foreign keys inside `data`: a create of
 * `{ userId: <user of another university> }` would succeed and stamp the caller's
 * tenant onto a row pointing at a foreign user. Call this first.
 *
 * Lookups go through the extended client, so they are scoped to the current tenant
 * automatically; the explicit universityId filter below is a second guard that also
 * works when the client is mocked or the extension is bypassed.
 */
const tenantContext = require('./tenantContext');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Models whose rows with universityId = null are global (mirrors tenantExtension SHARED_MODELS). */
const SHARED_DELEGATES = new Set(['role', 'consentNotice', 'dataRetentionPolicy']);

/**
 * Ids (deduplicated) that do not exist in the current tenant. Non-UUID values count as missing.
 * @param {object} prisma extended Prisma client (or a transaction client)
 * @param {string} delegate model delegate name, e.g. 'userLogin', 'department'
 * @param {string|string[]} ids
 * @returns {Promise<string[]>}
 */
const findMissingIds = async (prisma, delegate, ids) => {
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((id) => id !== undefined && id !== null))];
  if (list.length === 0) return [];
  const valid = list.filter((id) => typeof id === 'string' && UUID_RE.test(id));
  const invalid = list.filter((id) => !valid.includes(id));
  if (valid.length === 0) return invalid;

  const where = { id: { in: valid } };
  const tenantId = tenantContext.getTenantId();
  if (tenantId) {
    if (SHARED_DELEGATES.has(delegate)) where.OR = [{ universityId: tenantId }, { universityId: null }];
    else where.universityId = tenantId;
  }
  const rows = await prisma[delegate].findMany({ where, select: { id: true } });
  const found = new Set(rows.map((r) => r.id));
  return [...invalid, ...valid.filter((id) => !found.has(id))];
};

/**
 * Run several ownership checks; return the message of the first one that fails, or null.
 * Checks with no ids (undefined/null/empty array) are skipped.
 * @param {object} prisma
 * @param {Array<{ model: string, ids: string|string[]|undefined|null, message: string }>} checks
 * @returns {Promise<string|null>}
 *
 * @example
 *   const notFound = await findTenantOwnershipError(prisma, [
 *     { model: 'userLogin', ids: userId, message: 'User not found' },
 *     { model: 'department', ids: departmentId, message: 'Department not found' },
 *   ]);
 *   if (notFound) return res.status(404).json({ success: false, message: notFound });
 */
const findTenantOwnershipError = async (prisma, checks) => {
  for (const { model, ids, message } of checks) {
    if (ids === undefined || ids === null || (Array.isArray(ids) && ids.length === 0)) continue;
    const missing = await findMissingIds(prisma, model, ids);
    if (missing.length > 0) return message;
  }
  return null;
};

module.exports = { findMissingIds, findTenantOwnershipError };
