/**
 * Incentive-policy effective windows — one model for every policy type
 * (research, book, book chapter, conference, grant, IPR):
 *
 *   - isActive means "enabled by an admin". It is never derived from dates.
 *   - A policy applies to day D when it is enabled and effectiveFrom ≤ D ≤ effectiveTo
 *     (effectiveTo null = open-ended). Dates are compared by calendar day (UTC), so a
 *     publication dated 2025-12-31 is covered by a policy ending 2025-12-31.
 *   - Enabled policies of the same tenant and key (publication type, conference sub-type,
 *     grant category/type, IPR type) never overlap; the database enforces this with
 *     exclusion constraints (migration 20261002233000_incentive_policy_windows).
 *   - Once the university has incentive cycles, a policy whose dates are set must sit inside
 *     one cycle (see policyCycle.js); open-ended policies are closed at the cycle's end.
 */

const { fitWindowToCycle } = require('./policyCycle');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of the given date's calendar day. */
function startOfUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Parse a date input; returns null for empty and throws nothing (callers validate). */
function toDateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Prisma `where` fragment selecting enabled policies whose window covers `date`'s day.
 * Spread it into a where clause; it owns the `OR` key.
 */
function policyWindowWhere(date = new Date()) {
  const valid = toDateOrNull(date) || new Date();
  const dayStart = startOfUtcDay(valid);
  const nextDay = new Date(dayStart.getTime() + DAY_MS);
  return {
    isActive: true,
    effectiveFrom: { lt: nextDay },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: dayStart } }],
  };
}

/** True when windows [aFrom, aTo] and [bFrom, bTo] share at least one instant (null = open). */
function windowsOverlap(aFrom, aTo, bFrom, bTo) {
  const aStart = new Date(aFrom).getTime();
  const bStart = new Date(bFrom).getTime();
  const aEnd = aTo ? new Date(aTo).getTime() : Infinity;
  const bEnd = bTo ? new Date(bTo).getTime() : Infinity;
  return aStart <= bEnd && bStart <= aEnd;
}

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'open-ended');

/**
 * Make room for a new/updated enabled policy window among the other enabled policies of
 * the same key. Runs on a transaction client.
 *
 * mode 'reject'    : any overlap → 409 POLICY_OVERLAP.
 * mode 'supersede' : an older policy that started before the new window and runs into it is
 *                    closed the day before (effectiveTo = newFrom − 1 day); a policy lying
 *                    entirely inside the new window is disabled (replaced). Any other
 *                    overlap (a bounded new window inside an older policy, or a policy that
 *                    starts inside the new window and outlasts it) → 409 POLICY_OVERLAP.
 *
 * @param {object} args
 * @param {object} args.delegate      Prisma model delegate on the transaction client
 * @param {object} args.where         key filter (tenant + type), without isActive/id
 * @param {Date}   args.from          new window start
 * @param {Date|null} args.to         new window end (null = open-ended)
 * @param {string} [args.excludeId]   the policy being updated
 * @param {'reject'|'supersede'} [args.mode]
 * @param {string} [args.actorId]     updatedById for trimmed policies
 * @returns {Promise<Array<{id, policyName, effectiveTo?, disabled?}>>} policies closed or replaced
 */
async function resolveOverlaps({ delegate, where, from, to, excludeId = null, mode = 'reject', actorId = null }) {
  const others = await delegate.findMany({
    where: { ...where, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { effectiveFrom: 'asc' },
  });

  const trimmed = [];
  for (const other of others) {
    if (!windowsOverlap(from, to, other.effectiveFrom, other.effectiveTo)) continue;

    const otherStart = new Date(other.effectiveFrom).getTime();
    const otherEnd = other.effectiveTo ? new Date(other.effectiveTo).getTime() : Infinity;
    const newStart = new Date(from).getTime();
    const newEnd = to ? new Date(to).getTime() : Infinity;
    const closeAt = new Date(startOfUtcDay(from).getTime() - DAY_MS);

    const canClosePrevious = mode === 'supersede'
      && otherStart < newStart
      && closeAt.getTime() >= startOfUtcDay(other.effectiveFrom).getTime()
      // closing it must not leave dates after the new window uncovered
      && otherEnd <= newEnd;
    // A policy lying entirely inside the new window is replaced by it (admin supersedes it).
    const isEngulfed = mode === 'supersede' && !canClosePrevious && otherStart >= newStart && otherEnd <= newEnd;

    if (isEngulfed) {
      await delegate.update({
        where: { id: other.id },
        data: { isActive: false, ...(actorId ? { updatedById: actorId } : {}) },
      });
      trimmed.push({ id: other.id, policyName: other.policyName, disabled: true });
      continue;
    }

    if (!canClosePrevious) {
      const err = new Error(
        `The dates ${fmt(from)} – ${fmt(to)} overlap the enabled policy "${other.policyName}" ` +
        `(${fmt(other.effectiveFrom)} – ${fmt(other.effectiveTo)}). Adjust the dates, or edit or disable that policy first.`
      );
      err.statusCode = 409;
      err.code = 'POLICY_OVERLAP';
      err.conflictingPolicyId = other.id;
      throw err;
    }

    await delegate.update({
      where: { id: other.id },
      data: { effectiveTo: closeAt, ...(actorId ? { updatedById: actorId } : {}) },
    });
    trimmed.push({ id: other.id, policyName: other.policyName, effectiveTo: closeAt });
  }
  return trimmed;
}

/** True when a save sets the policy's window: a new policy, changed dates, or re-enabling. */
function windowChanged(data, existing) {
  if (!existing) return true;
  if (data.isActive === true && existing.isActive === false) return true;
  const same = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
  if (data.effectiveFrom !== undefined && !same(data.effectiveFrom, existing.effectiveFrom)) return true;
  if (data.effectiveTo !== undefined && !same(data.effectiveTo, existing.effectiveTo)) return true;
  return false;
}

/**
 * Create or update an incentive policy in ONE transaction: fit its window into its incentive
 * cycle (when the university has cycles and the window is being set), make room among the
 * enabled policies of the same key (see resolveOverlaps), then write. A disabled policy
 * (isActive false) never conflicts.
 *
 * @param {object} args
 * @param {object} args.prisma      client exposing $transaction
 * @param {string} args.model       delegate name, e.g. 'bookIncentivePolicy'
 * @param {object} args.keyWhere    key filter without tenant (e.g. { conferenceSubType })
 * @param {object} args.data        validated Prisma data (effectiveFrom/effectiveTo/isActive…)
 * @param {object} [args.existing]  stored row when updating
 * @param {string} [args.tenantId]
 * @param {string} args.actorId
 * @param {'reject'|'supersede'} [args.mode]
 * @param {object} [args.include]   Prisma include for the returned row
 * @param {boolean} [args.setUpdatedByOnCreate]
 * @returns {Promise<{ policy, adjusted }>}
 */
async function savePolicy({
  prisma, model, keyWhere = {}, data, existing = null, tenantId = null, actorId,
  mode = 'reject', include, setUpdatedByOnCreate = false,
}) {
  return prisma.$transaction(async (tx) => {
    const isActive = data.isActive ?? existing?.isActive ?? true;
    if (isActive && windowChanged(data, existing)) {
      const from = data.effectiveFrom ?? existing?.effectiveFrom;
      const to = data.effectiveTo !== undefined ? data.effectiveTo : existing?.effectiveTo ?? null;
      const fit = await fitWindowToCycle(tx.incentiveCycle, from, to);
      if (fit && !to) data = { ...data, effectiveTo: fit.effectiveTo };
    }
    let adjusted = [];
    if (isActive) {
      adjusted = await resolveOverlaps({
        delegate: tx[model],
        where: { ...keyWhere, ...(tenantId ? { universityId: tenantId } : {}) },
        from: data.effectiveFrom,
        to: data.effectiveTo ?? null,
        excludeId: existing?.id,
        mode,
        actorId,
      });
    }
    const policy = existing
      ? await tx[model].update({
        where: { id: existing.id },
        data: { ...data, isActive, updatedById: actorId },
        ...(include ? { include } : {}),
      })
      : await tx[model].create({
        data: {
          ...data,
          isActive,
          createdById: actorId,
          ...(setUpdatedByOnCreate ? { updatedById: actorId } : {}),
          ...(tenantId ? { universityId: tenantId } : {}),
        },
        ...(include ? { include } : {}),
      });
    return { policy, adjusted };
  });
}

module.exports = {
  savePolicy,
  DAY_MS,
  startOfUtcDay,
  toDateOrNull,
  policyWindowWhere,
  windowsOverlap,
  resolveOverlaps,
};
