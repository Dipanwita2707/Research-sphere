/**
 * Incentive cycles ↔ policy windows. A cycle (finance → Research budget) is the period that
 * incentive policies and the research budget share. Once a university has cycles, an enabled
 * policy whose dates are being set must sit inside ONE cycle:
 *
 *   - its start date picks the cycle (none covers it → 400 POLICY_OUTSIDE_CYCLES);
 *   - an open-ended policy is closed at the cycle's last day;
 *   - an end date past the cycle's last day → 400 POLICY_CROSSES_CYCLE.
 *
 * A university without cycles keeps the plain date-window behaviour. Payout lines are charged to
 * the cycle containing the date that selected their policy, so policy and budget always agree.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of the date's calendar day (the same day rule as policy windows). */
function utcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const isoDay = (d) => (d ? utcDay(d).toISOString().slice(0, 10) : null);

class PolicyCycleError extends Error {
  constructor(message, code, details) {
    super(message);
    this.statusCode = 400;
    this.code = code;
    if (details) this.details = details;
  }
}

/** The cycle whose dates contain `date`'s calendar day, or null. `delegate` = client.incentiveCycle. */
async function cycleContaining(delegate, date) {
  if (!delegate || !date) return null;
  const day = utcDay(date);
  if (Number.isNaN(day.getTime())) return null;
  return delegate.findFirst({ where: { startDate: { lte: day }, endDate: { gte: day } } });
}

/**
 * Fit a policy window into its cycle. Returns null when the university has no cycles (nothing
 * to enforce), else { cycle, effectiveTo } with effectiveTo filled in for open-ended policies.
 * @param {object} delegate  client.incentiveCycle (tenant-scoped)
 * @param {Date} from
 * @param {Date|null} to
 */
async function fitWindowToCycle(delegate, from, to) {
  if (!delegate || typeof delegate.count !== 'function') return null;
  if (!(await delegate.count())) return null;
  const cycle = await cycleContaining(delegate, from);
  if (!cycle) {
    throw new PolicyCycleError(
      `No incentive cycle covers ${isoDay(from)}. Pick a start date inside an existing cycle, or ask finance to create the cycle on the Research budget page first.`,
      'POLICY_OUTSIDE_CYCLES',
    );
  }
  const cycleEnd = utcDay(cycle.endDate);
  if (to && utcDay(to).getTime() > cycleEnd.getTime()) {
    throw new PolicyCycleError(
      `This policy runs to ${isoDay(to)}, but its cycle "${cycle.name}" ends on ${isoDay(cycleEnd)}. End it by ${isoDay(cycleEnd)} and create a separate policy for the next cycle.`,
      'POLICY_CROSSES_CYCLE',
      { cycleId: cycle.id, cycleName: cycle.name, cycleStart: isoDay(cycle.startDate), cycleEnd: isoDay(cycleEnd) },
    );
  }
  return { cycle, effectiveTo: to || cycleEnd };
}

module.exports = { DAY_MS, utcDay, isoDay, cycleContaining, fitWindowToCycle, PolicyCycleError };
