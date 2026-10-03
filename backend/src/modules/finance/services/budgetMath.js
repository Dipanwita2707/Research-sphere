/**
 * Research budget: pure rules and arithmetic (no database). Shared by budget.service.js,
 * budgetGuard.js and their unit tests.
 *
 * Figures for a node and incentive cycle, from the payout lines charged to it (approvedAmount):
 *   pending    = pending_verification                     (not yet verified; not counted against the budget)
 *   committed  = recommended + on_hold + approved          (recommended lines in a draft batch are "recommended")
 *   utilised   = paid
 *   consumed   = committed + utilised
 *   available  = allocated − consumed
 *   utilisation % = consumed / allocated
 * Cancelled lines are ignored.
 */

const CATEGORIES = ['research_paper', 'book', 'book_chapter', 'conference_paper', 'ipr', 'grant'];
const CATEGORY_LABELS = {
  research_paper: 'Research papers',
  book: 'Books',
  book_chapter: 'Book chapters',
  conference_paper: 'Conference papers',
  ipr: 'IPR',
  grant: 'Grants',
  other: 'Other',
};
const IPR_WORK_TYPES = new Set(['patent', 'copyright', 'trademark', 'design', 'ipr']);

const STATUS_BUCKET = {
  pending_verification: 'pending',
  recommended: 'committed',
  on_hold: 'committed',
  approved: 'committed',
  paid: 'utilised',
};
const CONSUMED_STATUSES = ['recommended', 'on_hold', 'approved', 'paid'];
const DEFAULT_WARN_PCT = 80;
const MAX_AMOUNT = 9_999_999_999_999.99; // Decimal(15, 2)

class BudgetError extends Error {
  constructor(statusCode, message, code = 'BUDGET_ERROR', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const paise = (n) => Math.round(Number(n || 0) * 100);
const fromPaise = (p) => p / 100;

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const formatINR = (n) => inr.format(round2(n)).replace(/\.00$/, '');

/** Payout line → budget category. IPR sub-types (patent, copyright, …) roll up into "ipr". */
function categoryOf({ sourceType, workType }) {
  if (sourceType === 'ipr' || IPR_WORK_TYPES.has(workType)) return 'ipr';
  if (sourceType === 'grant' || workType === 'grant') return 'grant';
  return CATEGORIES.includes(workType) ? workType : 'other';
}

const bucketOf = (status) => STATUS_BUCKET[status] || null;

function isValidFinancialYear(fy) {
  if (typeof fy !== 'string' || !/^\d{4}-\d{2}$/.test(fy)) return false;
  const start = Number(fy.slice(0, 4));
  return Number(fy.slice(5)) === (start + 1) % 100 && start >= 2000 && start <= 2100;
}

function requireFinancialYear(fy) {
  if (!isValidFinancialYear(fy)) throw new BudgetError(400, 'Financial year must look like 2026-27', 'INVALID_FINANCIAL_YEAR');
  return fy;
}

/** "YYYY-MM" of a date in IST. */
function monthKeyIST(date) {
  if (!date) return null;
  const d = new Date(new Date(date).getTime() + 5.5 * 3600 * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 7);
}

/** The twelve months of an FY, April first. */
function monthsOfFinancialYear(fy) {
  const start = Number(fy.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const m = (3 + i) % 12;
    const y = i < 9 ? start : start + 1;
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  });
}

/** "YYYY-MM" months from the start date's month to the end date's month (cycle dates are calendar days). */
function monthsOfRange(startDate, endDate) {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const out = [];
  let y = s.getUTCFullYear();
  let m = s.getUTCMonth();
  while (y < e.getUTCFullYear() || (y === e.getUTCFullYear() && m <= e.getUTCMonth())) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m === 12) { m = 0; y += 1; }
  }
  return out;
}

/** A cycle ({ startDate, endDate }) or an FY string ("2026-27") → its months. */
const monthsOfPeriod = (period) =>
  (typeof period === 'string' ? monthsOfFinancialYear(period) : monthsOfRange(period.startDate, period.endDate));

/** Months of the period that have started by `now` (IST): 0 for a future cycle, all for a past one. */
function monthsElapsed(period, now = new Date()) {
  const current = monthKeyIST(now);
  return monthsOfPeriod(period).filter((m) => m <= current).length;
}

/** Validate an amount: a finite number ≥ 0 within Decimal(15, 2). Returns it rounded to paise. */
function parseAmount(value, label = 'Amount') {
  if (value === '' || value === null || value === undefined) throw new BudgetError(400, `${label} is required`, 'INVALID_AMOUNT');
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BudgetError(400, `${label} must be a number`, 'INVALID_AMOUNT');
  if (n < 0) throw new BudgetError(400, `${label} cannot be negative`, 'INVALID_AMOUNT');
  if (n > MAX_AMOUNT) throw new BudgetError(400, `${label} is too large`, 'INVALID_AMOUNT');
  return round2(n);
}

/** Validate a category split. Unknown keys and negative values are rejected; zero entries are dropped. */
function parseCategories(input) {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BudgetError(400, 'Category split must be an object of category → amount', 'INVALID_CATEGORIES');
  }
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (!CATEGORIES.includes(key)) {
      throw new BudgetError(400, `Unknown category "${key}". Use one of: ${CATEGORIES.join(', ')}`, 'INVALID_CATEGORIES');
    }
    if (value === '' || value === null || value === undefined) continue;
    const n = parseAmount(value, `${CATEGORY_LABELS[key]} amount`);
    if (n > 0) out[key] = n;
  }
  return out;
}

const sumCategories = (cats) => fromPaise(Object.values(cats || {}).reduce((s, v) => s + paise(v), 0));

function assertCategoriesFit(cats, amount, label) {
  const total = sumCategories(cats);
  if (paise(total) > paise(amount)) {
    throw new BudgetError(
      400,
      `The category split adds up to ${formatINR(total)}, more than the ${formatINR(amount)} allocated to ${label}`,
      'CATEGORIES_EXCEED_NODE',
      { categoriesTotal: total, amount },
    );
  }
}

/**
 * Children of a parent may not add up to more than the parent.
 * @param {{ amount:number, siblingsTotal:number, parentAmount:number, label:string, parentLabel:string, childNoun:string }} p
 */
function assertFitsParent({ amount, siblingsTotal, parentAmount, label, parentLabel, childNoun }) {
  const total = paise(amount) + paise(siblingsTotal);
  if (total > paise(parentAmount)) {
    const left = Math.max(0, paise(parentAmount) - paise(siblingsTotal));
    throw new BudgetError(
      400,
      `${label}: ${childNoun} would total ${formatINR(fromPaise(total))}, more than ${parentLabel}'s ${formatINR(parentAmount)}. `
        + `At most ${formatINR(fromPaise(left))} can be allocated here.`,
      'EXCEEDS_PARENT',
      { requested: round2(amount), siblingsTotal: round2(siblingsTotal), parentAmount: round2(parentAmount), maxAllowed: fromPaise(left) },
    );
  }
}

/** A parent may not be reduced below what its children already hold. */
function assertCoversChildren({ amount, childrenTotal, label, childNoun }) {
  if (paise(amount) < paise(childrenTotal)) {
    throw new BudgetError(
      400,
      `${label} cannot be less than the ${formatINR(childrenTotal)} already allocated to its ${childNoun}. Reduce those first.`,
      'BELOW_CHILDREN',
      { requested: round2(amount), childrenTotal: round2(childrenTotal) },
    );
  }
}

function nodeStatus(allocated, consumed, warnPct = DEFAULT_WARN_PCT) {
  const a = paise(allocated);
  const c = paise(consumed);
  if (a === 0) return c > 0 ? 'over' : 'unallocated';
  if (c > a) return 'over';
  if (c * 100 >= a * warnPct) return 'warning';
  return 'healthy';
}

const emptyFigures = () => ({ committed: 0, utilised: 0, pending: 0, lines: 0 });

function addToFigures(fig, bucket, amount, count = 1) {
  if (!bucket) return;
  fig[bucket] = round2(fig[bucket] + amount);
  fig.lines += count;
}

/** Final figures for a node given its allocation. */
function finalizeFigures(allocated, fig = emptyFigures(), warnPct = DEFAULT_WARN_PCT) {
  const consumed = round2(fig.committed + fig.utilised);
  const alloc = round2(allocated);
  return {
    allocated: alloc,
    committed: round2(fig.committed),
    utilised: round2(fig.utilised),
    pending: round2(fig.pending),
    consumed,
    available: round2(alloc - consumed),
    utilisationPct: alloc > 0 ? Math.round((consumed / alloc) * 1000) / 10 : null,
    lines: fig.lines,
    status: nodeStatus(alloc, consumed, warnPct),
  };
}

const keyOf = (nodeType, nodeId) => `${nodeType}:${nodeId}`;

/**
 * Build the university → school → department tree with utilisation.
 *
 * @param {object} p
 * @param {{id:string,name:string}} p.university
 * @param {object|null} p.budget             ResearchBudget row (amounts as numbers or Decimals)
 * @param {Array<{id,facultyName,facultyCode,isActive}>} p.schools
 * @param {Array<{id,departmentName,departmentCode,facultyId,isActive}>} p.departments
 * @param {Array<{id,nodeType,nodeId,amount,categoryAllocations,updatedAt}>} p.allocations
 * @param {Array<{schoolId,departmentId,status,workType,sourceType,amount,count}>} p.aggregates  payout line sums
 * @param {Array<{schoolId,departmentId,amount}>} p.receipts  grant fund receipts (external inflow)
 * @param {{all:boolean, schoolIds?:string[]}} [p.scope]  read-only viewers limited to some schools
 */
function buildTree({ university, budget, schools, departments, allocations, aggregates, receipts = [], scope = { all: true } }) {
  const warnPct = budget?.warnThresholdPct || DEFAULT_WARN_PCT;
  const alloc = new Map(allocations.map((a) => [keyOf(a.nodeType, a.nodeId), a]));
  const schoolIdsKnown = new Set(schools.map((s) => s.id));

  const fig = new Map(); // key → figures
  const cat = new Map(); // key → Map(category → figures)
  const ext = new Map(); // key → { amount, count }
  const touch = (key, bucket, category, amount, count) => {
    if (!fig.has(key)) fig.set(key, emptyFigures());
    addToFigures(fig.get(key), bucket, amount, count);
    if (!cat.has(key)) cat.set(key, new Map());
    const c = cat.get(key);
    if (!c.has(category)) c.set(category, emptyFigures());
    addToFigures(c.get(category), bucket, amount, count);
  };
  const addExt = (key, amount) => {
    const e = ext.get(key) || { amount: 0, count: 0 };
    e.amount = round2(e.amount + amount);
    e.count += 1;
    ext.set(key, e);
  };

  const scopeSchools = new Set(scope.schoolIds || []);
  const inScopeSchool = (id) => scope.all || scopeSchools.has(id);

  for (const g of aggregates) {
    const bucket = bucketOf(g.status);
    if (!bucket) continue;
    const amount = Number(g.amount) || 0;
    const count = Number(g.count) || 0;
    const category = categoryOf(g);
    const schoolId = g.schoolId && schoolIdsKnown.has(g.schoolId) ? g.schoolId : null;
    if (!scope.all && !(schoolId && inScopeSchool(schoolId))) continue;
    touch('university', bucket, category, amount, count);
    if (!schoolId) {
      touch('unassigned', bucket, category, amount, count);
      continue;
    }
    touch(keyOf('school', schoolId), bucket, category, amount, count);
    if (g.departmentId) touch(keyOf('department', g.departmentId), bucket, category, amount, count);
    else touch(keyOf('school-direct', schoolId), bucket, category, amount, count);
  }
  for (const r of receipts) {
    const amount = Number(r.amount) || 0;
    const schoolId = r.schoolId && schoolIdsKnown.has(r.schoolId) ? r.schoolId : null;
    if (!scope.all && !(schoolId && inScopeSchool(schoolId))) continue;
    addExt('university', amount);
    if (!schoolId) { addExt('unassigned', amount); continue; }
    addExt(keyOf('school', schoolId), amount);
    if (r.departmentId) addExt(keyOf('department', r.departmentId), amount);
  }

  const categoryRows = (key, allocatedCats) => {
    const c = cat.get(key) || new Map();
    const keys = [...CATEGORIES, ...(c.has('other') ? ['other'] : [])];
    return keys.map((k) => {
      const f = c.get(k) || emptyFigures();
      const allocated = Number(allocatedCats?.[k] || 0);
      return {
        category: k,
        label: CATEGORY_LABELS[k],
        allocated: round2(allocated),
        committed: f.committed,
        utilised: f.utilised,
        pending: f.pending,
        consumed: round2(f.committed + f.utilised),
        lines: f.lines,
      };
    });
  };

  const makeNode = (nodeType, id, name, code, parentId, allocRow, isActive = true) => {
    const key = nodeType === 'university' ? 'university' : nodeType === 'unassigned' ? 'unassigned' : keyOf(nodeType, id);
    const allocated = allocRow ? Number(allocRow.amount) : 0;
    const cats = allocRow?.categoryAllocations || {};
    return {
      nodeType,
      id,
      name,
      code: code || null,
      parentId,
      isActive,
      allocationId: allocRow?.id || null,
      hasAllocation: !!allocRow,
      categoryAllocations: cats,
      ...finalizeFigures(allocated, fig.get(key), warnPct),
      categories: categoryRows(key, cats),
      externalFunding: ext.get(key) || { amount: 0, count: 0 },
      updatedAt: allocRow?.updatedAt || null,
      children: [],
    };
  };

  const deptsBySchool = new Map();
  for (const d of departments) {
    if (!deptsBySchool.has(d.facultyId)) deptsBySchool.set(d.facultyId, []);
    deptsBySchool.get(d.facultyId).push(d);
  }
  const relevant = (nodeType, row) => row.isActive !== false || alloc.has(keyOf(nodeType, row.id)) || fig.has(keyOf(nodeType, row.id));

  const schoolNodes = [];
  for (const s of [...schools].sort((a, b) => String(a.facultyName).localeCompare(String(b.facultyName)))) {
    if (!inScopeSchool(s.id)) continue;
    if (!relevant('school', s)) continue;
    const deptRows = (deptsBySchool.get(s.id) || [])
      .filter((d) => relevant('department', d))
      .sort((a, b) => String(a.departmentName).localeCompare(String(b.departmentName)));
    const node = makeNode('school', s.id, s.facultyName, s.shortName || s.facultyCode, university.id, alloc.get(keyOf('school', s.id)), s.isActive !== false);
    node.children = deptRows.map((d) => makeNode('department', d.id, d.departmentName, d.shortName || d.departmentCode, s.id, alloc.get(keyOf('department', d.id)), d.isActive !== false));
    node.childrenAllocated = fromPaise(node.children.reduce((sum, c) => sum + paise(c.allocated), 0));
    node.unallocated = round2(node.allocated - node.childrenAllocated);
    const direct = fig.get(keyOf('school-direct', s.id));
    node.withoutDepartment = direct ? finalizeFigures(0, direct, warnPct) : null;
    schoolNodes.push(node);
  }

  const rootAllocated = scope.all
    ? Number(budget?.totalAmount || 0)
    : fromPaise(schoolNodes.reduce((s, n) => s + paise(n.allocated), 0));
  const root = makeNode('university', university.id, university.name, university.code, null, budget
    ? { id: budget.id, amount: rootAllocated, categoryAllocations: scope.all ? budget.categoryAllocations || {} : {}, updatedAt: budget.updatedAt }
    : null);
  root.children = schoolNodes;
  root.childrenAllocated = fromPaise(schoolNodes.reduce((s, n) => s + paise(n.allocated), 0));
  root.unallocated = round2(root.allocated - root.childrenAllocated);
  root.scoped = !scope.all;

  if (scope.all && fig.has('unassigned')) {
    const un = makeNode('unassigned', 'unassigned', 'Unassigned', null, university.id, null);
    un.status = 'unattributed';
    un.available = 0;
    root.children.push(un);
  }

  // Without a budget there is nothing to be over: spending is shown, statuses stay neutral.
  if (!budget) {
    const neutral = (n) => { if (n.status !== 'unattributed') n.status = 'unallocated'; (n.children || []).forEach(neutral); };
    neutral(root);
  }
  return root;
}

/** Depth-first list of nodes (root first). */
function flattenTree(root) {
  const out = [];
  const walk = (n, depth) => {
    out.push({ ...n, depth, children: undefined });
    (n.children || []).forEach((c) => walk(c, depth + 1));
  };
  if (root) walk(root, 0);
  return out;
}

/** Burn rate from monthly utilised amounts, projected to the end of the cycle. */
function burnRate(period, monthly, allocated, now = new Date()) {
  const elapsed = monthsElapsed(period, now);
  const totalMonths = monthsOfPeriod(period).length;
  const utilised = monthly.reduce((s, m) => s + (m.utilised || 0), 0);
  const avgMonthly = elapsed > 0 ? round2(utilised / elapsed) : 0;
  const projectedCycleEnd = elapsed > 0 ? round2(avgMonthly * totalMonths) : 0;
  return {
    monthsElapsed: elapsed,
    totalMonths,
    avgMonthly,
    projectedCycleEnd,
    projectedPct: allocated > 0 ? Math.round((projectedCycleEnd / allocated) * 1000) / 10 : null,
  };
}

module.exports = {
  CATEGORIES,
  CATEGORY_LABELS,
  CONSUMED_STATUSES,
  DEFAULT_WARN_PCT,
  BudgetError,
  round2,
  paise,
  formatINR,
  categoryOf,
  bucketOf,
  isValidFinancialYear,
  requireFinancialYear,
  monthKeyIST,
  monthsOfFinancialYear,
  monthsOfRange,
  monthsElapsed,
  parseAmount,
  parseCategories,
  sumCategories,
  assertCategoriesFit,
  assertFitsParent,
  assertCoversChildren,
  nodeStatus,
  finalizeFigures,
  buildTree,
  flattenTree,
  burnRate,
};
