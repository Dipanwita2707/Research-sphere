/**
 * Money/points helpers shared by every incentive calculation.
 *
 * Policy amounts are Prisma Decimal columns (objects), and JSON tables may hold numbers or
 * numeric strings. Adding them with `+` concatenates strings (70000 + "2000" → "700002000"),
 * so every policy value goes through toNumber() before any arithmetic.
 */

/** ₹1 crore: no single work (research paper, book, grant, IPR…) may pay more than this. */
const DEFAULT_MAX_INCENTIVE_PER_WORK = 10000000;

/**
 * Convert a policy value (number, numeric string, Prisma Decimal, null) to a finite Number.
 * Anything not numeric becomes `fallback` (0 by default).
 */
function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'bigint') return Number(value);
  // Prisma Decimal (decimal.js) and similar objects.
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(typeof value === 'object' ? String(value) : value);
  return Number.isFinite(n) ? n : fallback;
}

/** Configured per-work cap (env MAX_INCENTIVE_PER_WORK), defaulting to ₹1 crore. */
function maxIncentivePerWork() {
  const configured = Number(process.env.MAX_INCENTIVE_PER_WORK);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_INCENTIVE_PER_WORK;
}

/**
 * Refuse to pay an implausible amount. A pool above the cap means the policy (or the data)
 * is wrong — e.g. string concatenation of Decimals — and must never reach the payout ledger.
 * @throws {Error} statusCode 422, code INCENTIVE_ABOVE_CAP
 */
function assertWithinCap(amount, context = 'this work') {
  const n = toNumber(amount, NaN);
  const cap = maxIncentivePerWork();
  if (!Number.isFinite(n) || n < 0 || n > cap) {
    const err = new Error(
      `Computed incentive for ${context} (₹${String(amount)}) is outside the allowed range ` +
      `(₹0 – ₹${cap.toLocaleString('en-IN')}). Check the incentive policy configuration.`
    );
    err.statusCode = 422;
    err.code = 'INCENTIVE_ABOVE_CAP';
    throw err;
  }
  return n;
}

module.exports = { toNumber, maxIncentivePerWork, assertWithinCap, DEFAULT_MAX_INCENTIVE_PER_WORK };
