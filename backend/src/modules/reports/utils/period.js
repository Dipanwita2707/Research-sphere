/**
 * @module reports/utils/period
 * @description Year / financial-year helpers for accreditation reports.
 *
 * Conventions (India):
 *   - Financial year (FY) and academic year (AY) both run 1 April – 31 March.
 *     FY "2024-25" = 2024-04-01 .. 2025-03-31 and is identified by its start year (2024).
 *   - Calendar year (CY) = 1 January – 31 December.
 *   - Dates are bucketed in Indian Standard Time (UTC+05:30), so a receipt stamped
 *     2025-03-31T20:00:00Z (= 1 April IST) lands in FY 2025-26.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MIN_YEAR = 2000;
const MAX_SPAN_YEARS = 10;

class ReportParamError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReportParamError';
    this.statusCode = 400;
    this.isOperational = true;
  }
}

/** Date | string | null → Date shifted to IST wall-clock (read with getUTC*), or null. */
const toIst = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + IST_OFFSET_MS);
};

/** Calendar year of a date (IST), or null. */
const calendarYearOf = (value) => {
  const d = toIst(value);
  return d ? d.getUTCFullYear() : null;
};

/** Start year of the Indian financial / academic year containing the date (IST), or null. */
const fyStartOf = (value) => {
  const d = toIst(value);
  if (!d) return null;
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 3 ? y : y - 1;
};

/** 2024 → "2024-25". */
const fyLabel = (startYear) => `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

/** "2024-25" → 2024; null when malformed or the two halves are not consecutive. */
const parseFyLabel = (label) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(label || '').trim());
  if (!m) return null;
  const start = Number(m[1]);
  return (start + 1) % 100 === Number(m[2]) ? start : null;
};

/** Bucket key for a date under a basis: 'calendar' → CY, 'financial'/'academic' → FY start year. */
const yearOf = (value, basis) => (basis === 'calendar' ? calendarYearOf(value) : fyStartOf(value));

/** Human label for a bucket key under a basis. */
const yearLabel = (year, basis) => (basis === 'calendar' ? String(year) : fyLabel(year));

/** UTC instants bounding [fromYear, toYear] under a basis (inclusive start, exclusive end), in IST. */
const rangeBounds = (fromYear, toYear, basis) => {
  const startMonth = basis === 'calendar' ? 0 : 3;
  const start = new Date(Date.UTC(fromYear, startMonth, 1) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(toYear + 1, startMonth, 1) - IST_OFFSET_MS);
  return { start, end };
};

const currentYear = () => new Date().getUTCFullYear();

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const parseIntStrict = (value, name) => {
  if (!/^\d{4}$/.test(String(value).trim())) throw new ReportParamError(`${name} must be a four-digit year`);
  return Number(value);
};

/**
 * Validate ?fromYear&toYear. Defaults to the last five years ending this year.
 * Years must lie in 2000 .. current+1, fromYear <= toYear, at most 10 years.
 */
const parseYearRange = (query = {}) => {
  const maxYear = currentYear() + 1;
  const hasTo = query.toYear !== undefined && query.toYear !== '';
  const hasFrom = query.fromYear !== undefined && query.fromYear !== '';
  const toYear = hasTo ? parseIntStrict(query.toYear, 'toYear') : currentYear();
  const fromYear = hasFrom ? parseIntStrict(query.fromYear, 'fromYear') : toYear - 4;
  for (const [name, y] of [['fromYear', fromYear], ['toYear', toYear]]) {
    if (y < MIN_YEAR || y > maxYear) throw new ReportParamError(`${name} must be between ${MIN_YEAR} and ${maxYear}`);
  }
  if (fromYear > toYear) throw new ReportParamError('fromYear must not be after toYear');
  if (toYear - fromYear + 1 > MAX_SPAN_YEARS) throw new ReportParamError(`A report can cover at most ${MAX_SPAN_YEARS} years`);
  return { fromYear, toYear, years: range(fromYear, toYear) };
};

/**
 * Validate ?financialYears=2023-24,2024-25. Defaults to the last three completed FYs.
 * Returns sorted, de-duplicated start years.
 */
const parseFinancialYears = (raw) => {
  const maxYear = currentYear() + 1;
  let starts;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    const current = fyStartOf(new Date());
    starts = [current - 3, current - 2, current - 1];
  } else {
    const parts = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) throw new ReportParamError('financialYears must list at least one year like 2024-25');
    if (parts.length > MAX_SPAN_YEARS) throw new ReportParamError(`At most ${MAX_SPAN_YEARS} financial years`);
    starts = parts.map((p) => {
      const start = parseFyLabel(p);
      if (start === null) throw new ReportParamError(`Invalid financial year "${p.slice(0, 20)}" (expected e.g. 2024-25)`);
      return start;
    });
  }
  starts = [...new Set(starts)].sort((a, b) => a - b);
  for (const y of starts) {
    if (y < MIN_YEAR || y > maxYear) throw new ReportParamError(`Financial years must start between ${MIN_YEAR} and ${maxYear}`);
  }
  if (starts[starts.length - 1] - starts[0] + 1 > MAX_SPAN_YEARS) {
    throw new ReportParamError(`Financial years must span at most ${MAX_SPAN_YEARS} years`);
  }
  return { starts, labels: starts.map(fyLabel) };
};

/** One of the allowed values, or the default; anything else is a 400. */
const parseEnum = (value, allowed, fallback, name) => {
  if (value === undefined || value === '') return fallback;
  if (!allowed.includes(value)) throw new ReportParamError(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
};

module.exports = {
  ReportParamError,
  MIN_YEAR,
  MAX_SPAN_YEARS,
  toIst,
  calendarYearOf,
  fyStartOf,
  fyLabel,
  parseFyLabel,
  yearOf,
  yearLabel,
  rangeBounds,
  parseYearRange,
  parseFinancialYears,
  parseEnum,
};
