import {
  computeStatus, distributionRemainder, findNode, fitTransform, flatten, layoutOrganogram, LAYOUT, nodeKey, orderDistributionWrites,
  parentOf, parseAmountInput, searchTree, statusMeta, utilisationSplit, validateAllocation,
} from '../budget/budgetTree';
import type { BudgetNode } from '../budget/types';

const node = (over: Partial<BudgetNode>): BudgetNode => ({
  nodeType: 'school', id: 'x', name: 'X', code: null, parentId: null, isActive: true, allocationId: null, hasAllocation: true,
  categoryAllocations: {}, categories: [], externalFunding: { amount: 0, count: 0 }, updatedAt: null, children: [],
  allocated: 0, committed: 0, utilised: 0, pending: 0, consumed: 0, available: 0, utilisationPct: null, lines: 0, status: 'healthy',
  ...over,
});

const tree = node({
  nodeType: 'university', id: 'u', name: 'Test University', allocated: 1000,
  children: [
    node({ id: 'sA', name: 'School of Engineering', code: 'SOE', allocated: 600, children: [
      node({ nodeType: 'department', id: 'dA1', name: 'Computer Science', code: 'CSE', allocated: 300 }),
      node({ nodeType: 'department', id: 'dA2', name: 'Mechanical', code: 'ME', allocated: 200 }),
    ] }),
    node({ id: 'sB', name: 'School of Law', allocated: 200, children: [node({ nodeType: 'department', id: 'dB1', name: 'Corporate Law' })] }),
    node({ nodeType: 'unassigned', id: 'unassigned', name: 'Unassigned' }),
  ],
});

describe('status helpers', () => {
  it('mirrors the backend status rule', () => {
    expect(computeStatus(1000, 799)).toBe('healthy');
    expect(computeStatus(1000, 800)).toBe('warning');
    expect(computeStatus(1000, 1001)).toBe('over');
    expect(computeStatus(0, 0)).toBe('unallocated');
    expect(computeStatus(0, 5)).toBe('over');
    expect(computeStatus(1000, 900, 95)).toBe('healthy');
  });

  it('every status has a label and an icon, not only a colour', () => {
    for (const s of ['healthy', 'warning', 'over', 'unallocated', 'unattributed'] as const) {
      const m = statusMeta(s, 80);
      expect(m.label).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.color).toMatch(/^var\(--viz-/);
    }
    expect(statusMeta('warning', 75).label).toBe('≥75% used');
  });

  it('utilisation bar splits paid then committed and caps at 100%', () => {
    expect(utilisationSplit({ allocated: 1000, utilised: 250, committed: 250 })).toEqual({ utilised: 25, committed: 25, overflow: false });
    expect(utilisationSplit({ allocated: 100, utilised: 80, committed: 50 })).toEqual({ utilised: 80, committed: 20, overflow: true });
    expect(utilisationSplit({ allocated: 0, utilised: 10, committed: 0 }).overflow).toBe(true);
  });
});

describe('tree helpers', () => {
  it('flattens depth-first with depth and finds nodes and parents by key', () => {
    expect(flatten(tree).map((n) => `${n.depth}:${n.id}`)).toEqual(['0:u', '1:sA', '2:dA1', '2:dA2', '1:sB', '2:dB1', '1:unassigned']);
    expect(findNode(tree, 'department:dA2')?.name).toBe('Mechanical');
    expect(parentOf(tree, 'department:dA2')?.id).toBe('sA');
    expect(parentOf(tree, 'school:sA')?.id).toBe('u');
    expect(nodeKey(tree)).toBe('university:u');
  });

  it('search matches names and codes and expands schools holding a matching department', () => {
    const r = searchTree(tree, 'cse');
    expect([...r.matches]).toEqual(['department:dA1']);
    expect([...r.expand]).toEqual(['school:sA']);
    expect(searchTree(tree, 'school').matches.size).toBe(2);
    expect(searchTree(tree, '  ').matches.size).toBe(0);
  });
});

describe('organogram layout', () => {
  it('puts the university above a row of schools with departments stacked under expanded schools', () => {
    const { nodes, edges, width, height } = layoutOrganogram(tree, new Set(['school:sA']));
    const at = (k: string) => nodes.find((n) => n.key === k)!;
    expect(width).toBe(3 * LAYOUT.cardW + 2 * LAYOUT.hGap);
    expect(at('university:u').y).toBe(0);
    expect(at('university:u').x + LAYOUT.cardW / 2).toBe(width / 2);
    expect(at('school:sA').y).toBe(at('school:sB').y);
    expect(at('school:sB').x).toBeGreaterThan(at('school:sA').x);
    expect(at('department:dA2').y).toBeGreaterThan(at('department:dA1').y);
    expect(at('department:dA1').x).toBe(at('school:sA').x + LAYOUT.deptIndent);
    expect(nodes.some((n) => n.key === 'department:dB1')).toBe(false); // collapsed
    expect(edges.filter((e) => e.from === 'university:u')).toHaveLength(3);
    expect(edges.filter((e) => e.from === 'school:sA')).toHaveLength(2);
    expect(height).toBe(at('department:dA2').y + LAYOUT.deptH);
  });

  it('fit scales down to the viewport but never zooms in past 100%', () => {
    expect(fitTransform({ width: 400, height: 300 }, { width: 1200, height: 800 }).scale).toBe(1);
    const t = fitTransform({ width: 2400, height: 600 }, { width: 1248, height: 800 });
    expect(t.scale).toBeCloseTo(0.5);
    expect(t.x).toBeCloseTo((1248 - 2400 * t.scale) / 2);
  });
});

describe('allocation validation (editor mirrors the backend)', () => {
  it('parses typed amounts', () => {
    expect(parseAmountInput('1,50,000')).toBe(150000);
    expect(parseAmountInput('₹ 99.5')).toBe(99.5);
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('12.345')).toBeNaN();
    expect(parseAmountInput('abc')).toBeNaN();
  });

  it('amount must be ≥ 0 and fit what the parent has left', () => {
    const base = { parentAmount: 1000, siblingsTotal: 700 };
    expect(validateAllocation({ ...base, amount: null }).errors.amount).toMatch(/Enter an amount/);
    expect(validateAllocation({ ...base, amount: -1 }).errors.amount).toMatch(/negative/);
    const over = validateAllocation({ ...base, amount: 301 });
    expect(over.ok).toBe(false);
    expect(over.maxAllowed).toBe(300);
    expect(over.errors.amount).toMatch(/At most ₹300/);
    expect(validateAllocation({ ...base, amount: 300 }).ok).toBe(true);
  });

  it('cannot drop below what children hold', () => {
    const r = validateAllocation({ amount: 100, parentAmount: 1000, siblingsTotal: 0, childrenTotal: 150, labels: { children: 'departments' } });
    expect(r.errors.amount).toMatch(/already given to its departments/);
  });

  it('category split must fit the amount', () => {
    const r = validateAllocation({ amount: 100, parentAmount: 1000, siblingsTotal: 0, categories: { book: 60, ipr: 50 } });
    expect(r.errors.categories).toMatch(/more than ₹100/);
    expect(validateAllocation({ amount: 100, parentAmount: 1000, siblingsTotal: 0, categories: { book: 60, ipr: 40 } }).ok).toBe(true);
  });

  it('changing an existing allocation needs a reason; unchanged is not a change', () => {
    const existing = { amount: 500, categories: { book: 100 } };
    const same = validateAllocation({ amount: 500, categories: { book: 100 }, parentAmount: 1000, siblingsTotal: 0, existing });
    expect(same).toMatchObject({ ok: true, changed: false });
    const changed = validateAllocation({ amount: 600, parentAmount: 1000, siblingsTotal: 0, existing, categories: { book: 100 } });
    expect(changed.errors.reason).toMatch(/reason/);
    expect(validateAllocation({ amount: 600, parentAmount: 1000, siblingsTotal: 0, existing, categories: { book: 100 }, reason: 'Revised' }).ok).toBe(true);
  });

  it('distribution: remainder and decreases-first save order', () => {
    expect(distributionRemainder(1000, [300, null, 250.5])).toBe(449.5);
    expect(distributionRemainder(100, [80, 30])).toBe(-10);
    const order = orderDistributionWrites([
      { id: 'up', amount: 500, previous: 100 },
      { id: 'down', amount: 0, previous: 400 },
      { id: 'new', amount: 50, previous: 0 },
    ]);
    expect(order.map((r) => r.id)).toEqual(['down', 'new', 'up']);
  });
});
