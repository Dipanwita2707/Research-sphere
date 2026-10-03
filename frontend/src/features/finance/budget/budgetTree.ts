/**
 * Research budget helpers with no React: status meta, tree walking/search, organogram layout,
 * and the allocation validation rules (the same rules the backend enforces, so the editor can
 * explain a problem before saving; the backend stays the authority).
 */
import type { BudgetCategory, BudgetNode, BudgetStatus, CategoryAllocations } from './types';

export const BUDGET_CATEGORIES: BudgetCategory[] = ['research_paper', 'book', 'book_chapter', 'conference_paper', 'ipr', 'grant'];
export const CATEGORY_LABELS: Record<BudgetCategory | 'other', string> = {
  research_paper: 'Research papers',
  book: 'Books',
  book_chapter: 'Book chapters',
  conference_paper: 'Conference papers',
  ipr: 'IPR',
  grant: 'Grants',
  other: 'Other',
};

// ─── Status ─────────────────────────────────────────────────────────────────

export interface StatusMeta {
  label: string;
  /** Short explanation for tooltips / screen readers. */
  description: string;
  /** CSS colour token from the status palette (globals.css --viz-good / warning / critical). */
  color: string;
  icon: 'healthy' | 'warning' | 'over' | 'none';
}

export function statusMeta(status: BudgetStatus, warnPct = 80): StatusMeta {
  switch (status) {
    case 'healthy':
      return { label: 'Healthy', description: `Under ${warnPct}% of the allocation used`, color: 'var(--viz-good)', icon: 'healthy' };
    case 'warning':
      return { label: `≥${warnPct}% used`, description: `${warnPct}% or more of the allocation is committed or paid`, color: 'var(--viz-warning)', icon: 'warning' };
    case 'over':
      return { label: 'Over budget', description: 'Committed and paid amounts exceed the allocation', color: 'var(--viz-critical)', icon: 'over' };
    case 'unattributed':
      return { label: 'Unassigned', description: 'Payees without a school or department; counted against the university total only', color: 'var(--viz-ink-muted)', icon: 'none' };
    default:
      return { label: 'No allocation', description: 'Nothing allocated yet', color: 'var(--viz-ink-muted)', icon: 'none' };
  }
}

/** Status from figures — mirrors budgetMath.nodeStatus on the backend. */
export function computeStatus(allocated: number, consumed: number, warnPct = 80): BudgetStatus {
  const a = Math.round(allocated * 100);
  const c = Math.round(consumed * 100);
  if (a === 0) return c > 0 ? 'over' : 'unallocated';
  if (c > a) return 'over';
  if (c * 100 >= a * warnPct) return 'warning';
  return 'healthy';
}

/** Share of the allocation used, split for the utilisation bar (each 0–100, capped). */
export function utilisationSplit(n: Pick<BudgetNode, 'allocated' | 'utilised' | 'committed'>) {
  if (!(n.allocated > 0)) return { utilised: 0, committed: 0, overflow: n.utilised + n.committed > 0 };
  const u = (n.utilised / n.allocated) * 100;
  const c = (n.committed / n.allocated) * 100;
  const uCap = Math.min(100, u);
  return { utilised: uCap, committed: Math.max(0, Math.min(100 - uCap, c)), overflow: u + c > 100 };
}

// ─── Tree walking ───────────────────────────────────────────────────────────

export const nodeKey = (n: Pick<BudgetNode, 'nodeType' | 'id'>) => `${n.nodeType}:${n.id}`;

export function flatten(root: BudgetNode | null | undefined): Array<BudgetNode & { depth: number }> {
  const out: Array<BudgetNode & { depth: number }> = [];
  const walk = (n: BudgetNode, depth: number) => {
    out.push({ ...n, depth });
    n.children.forEach((c) => walk(c, depth + 1));
  };
  if (root) walk(root, 0);
  return out;
}

export function findNode(root: BudgetNode | null | undefined, key: string | null): BudgetNode | null {
  if (!root || !key) return null;
  if (nodeKey(root) === key) return root;
  for (const c of root.children) {
    const hit = findNode(c, key);
    if (hit) return hit;
  }
  return null;
}

export function parentOf(root: BudgetNode, key: string): BudgetNode | null {
  for (const c of root.children) {
    if (nodeKey(c) === key) return root;
    const hit = parentOf(c, key);
    if (hit) return hit;
  }
  return null;
}

/**
 * Search by name or code. Returns the keys that match and the school keys that must be
 * expanded so matching departments are visible.
 */
export function searchTree(root: BudgetNode | null | undefined, query: string): { matches: Set<string>; expand: Set<string> } {
  const matches = new Set<string>();
  const expand = new Set<string>();
  const q = query.trim().toLowerCase();
  if (!root || !q) return { matches, expand };
  const hit = (n: BudgetNode) => n.name.toLowerCase().includes(q) || (n.code || '').toLowerCase().includes(q);
  if (hit(root)) matches.add(nodeKey(root));
  for (const s of root.children) {
    if (hit(s)) matches.add(nodeKey(s));
    for (const d of s.children) {
      if (hit(d)) {
        matches.add(nodeKey(d));
        expand.add(nodeKey(s));
      }
    }
  }
  return { matches, expand };
}

// ─── Organogram layout ──────────────────────────────────────────────────────

export const LAYOUT = {
  cardW: 236,
  cardH: 184,
  deptH: 184,
  hGap: 32,
  vGap: 64,
  deptGap: 14,
  deptIndent: 22,
} as const;

export interface LaidOutNode {
  key: string;
  node: BudgetNode;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

export interface LaidOutEdge {
  from: string;
  to: string;
  d: string;
}

/**
 * Org-chart layout: university centred on top, schools in a row, each school's departments
 * stacked below it (indented, joined by an elbow line). Collapsed schools hide their departments.
 */
export function layoutOrganogram(root: BudgetNode, expanded: Set<string>) {
  const L = LAYOUT;
  const nodes: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];
  const schools = root.children;
  const rowW = schools.length ? schools.length * L.cardW + (schools.length - 1) * L.hGap : L.cardW;
  const rootKey = nodeKey(root);
  const rootX = rowW / 2 - L.cardW / 2;
  nodes.push({ key: rootKey, node: root, x: rootX, y: 0, w: L.cardW, h: L.cardH, depth: 0 });

  const schoolY = L.cardH + L.vGap;
  const busY = L.cardH + L.vGap / 2;
  let height: number = L.cardH;
  schools.forEach((s, i) => {
    const sx = i * (L.cardW + L.hGap);
    const sKey = nodeKey(s);
    nodes.push({ key: sKey, node: s, x: sx, y: schoolY, w: L.cardW, h: L.cardH, depth: 1 });
    const rootMid = rootX + L.cardW / 2;
    const sMid = sx + L.cardW / 2;
    edges.push({ from: rootKey, to: sKey, d: `M${rootMid},${L.cardH} V${busY} H${sMid} V${schoolY}` });
    let bottom = schoolY + L.cardH;
    if (expanded.has(sKey)) {
      const spineX = sx + L.deptIndent / 2;
      s.children.forEach((d, j) => {
        const dy = schoolY + L.cardH + L.deptGap + j * (L.deptH + L.deptGap);
        const dKey = nodeKey(d);
        nodes.push({ key: dKey, node: d, x: sx + L.deptIndent, y: dy, w: L.cardW - L.deptIndent, h: L.deptH, depth: 2 });
        edges.push({ from: sKey, to: dKey, d: `M${spineX},${schoolY + L.cardH} V${dy + L.deptH / 2} H${sx + L.deptIndent}` });
        bottom = dy + L.deptH;
      });
    }
    height = Math.max(height, bottom);
  });
  return { nodes, edges, width: rowW, height };
}

/** Scale + offset that fits content of size (w, h) in a viewport, never zooming in past 1. */
export function fitTransform(content: { width: number; height: number }, viewport: { width: number; height: number }, pad = 24) {
  const sx = (viewport.width - pad * 2) / Math.max(1, content.width);
  const sy = (viewport.height - pad * 2) / Math.max(1, content.height);
  const scale = Math.max(0.3, Math.min(1, sx, sy));
  return {
    scale,
    x: (viewport.width - content.width * scale) / 2,
    y: pad,
  };
}

// ─── Validation (mirrors backend budgetMath) ────────────────────────────────

export const toPaise = (n: number) => Math.round((Number(n) || 0) * 100);
export const sumCategories = (cats: CategoryAllocations | undefined) =>
  Object.values(cats || {}).reduce((s, v) => s + toPaise(Number(v) || 0), 0) / 100;

/** Parse a user-typed amount ("1,50,000" or "150000.5"). null = empty, NaN = not a number. */
export function parseAmountInput(raw: string): number | null {
  const t = raw.replace(/[,\s₹]/g, '');
  if (!t) return null;
  if (!/^-?\d*(\.\d{0,2})?$/.test(t)) return Number.NaN;
  return Number(t);
}

export interface AllocationCheck {
  /** Amount being set. */
  amount: number | null;
  categories?: CategoryAllocations;
  /** The parent's amount (university total for a school, school allocation for a department). */
  parentAmount: number;
  /** Sum of the other children of the same parent. */
  siblingsTotal: number;
  /** Sum already allocated to this node's own children. */
  childrenTotal?: number;
  /** Does an allocation already exist (then a reason is needed for a change)? */
  existing?: { amount: number; categories?: CategoryAllocations } | null;
  reason?: string;
  labels?: { node?: string; parent?: string; children?: string };
}

export interface ValidationResult {
  ok: boolean;
  errors: Partial<Record<'amount' | 'categories' | 'reason', string>>;
  /** Most that can be allocated here given the parent and siblings. */
  maxAllowed: number;
  changed: boolean;
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function validateAllocation(c: AllocationCheck): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  const labels = { node: 'This allocation', parent: 'the parent', children: 'children', ...(c.labels || {}) };
  const maxAllowed = Math.max(0, toPaise(c.parentAmount) - toPaise(c.siblingsTotal)) / 100;
  const amount = c.amount;
  if (amount === null) errors.amount = 'Enter an amount (0 or more).';
  else if (Number.isNaN(amount)) errors.amount = 'Enter a number, e.g. 150000.';
  else if (amount < 0) errors.amount = 'Amount cannot be negative.';
  else if (toPaise(amount) > toPaise(maxAllowed)) errors.amount = `At most ${fmt(maxAllowed)} is left in ${labels.parent}.`;
  else if (c.childrenTotal && toPaise(amount) < toPaise(c.childrenTotal)) {
    errors.amount = `${labels.node} cannot be below the ${fmt(c.childrenTotal)} already given to its ${labels.children}.`;
  }

  const cats = c.categories || {};
  const badCat = Object.values(cats).some((v) => v !== undefined && (Number.isNaN(Number(v)) || Number(v) < 0));
  if (badCat) errors.categories = 'Category amounts must be 0 or more.';
  else if (amount !== null && !Number.isNaN(amount) && toPaise(sumCategories(cats)) > toPaise(amount)) {
    errors.categories = `Categories add up to ${fmt(sumCategories(cats))}, more than ${fmt(amount)}.`;
  }

  const sameCats = (a?: CategoryAllocations, b?: CategoryAllocations) =>
    BUDGET_CATEGORIES.every((k) => toPaise(Number(a?.[k] || 0)) === toPaise(Number(b?.[k] || 0)));
  const changed = !c.existing || toPaise(c.existing.amount) !== toPaise(amount || 0) || !sameCats(c.existing.categories, cats);
  if (c.existing && changed && (c.reason || '').trim().length < 3) errors.reason = 'Give a reason for the change (at least 3 characters).';

  return { ok: Object.keys(errors).length === 0, errors, maxAllowed, changed };
}

/** Distribute workflow: remainder of the parent after the drafted child amounts. */
export function distributionRemainder(parentAmount: number, drafts: Array<number | null>): number {
  const used = drafts.reduce<number>((s, v) => s + (v && !Number.isNaN(v) ? toPaise(v) : 0), 0);
  return (toPaise(parentAmount) - used) / 100;
}

/** Save order for a distribution: decreases first so the parent never goes over mid-way. */
export function orderDistributionWrites<T extends { amount: number; previous: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.amount - a.previous) - (b.amount - b.previous));
}
