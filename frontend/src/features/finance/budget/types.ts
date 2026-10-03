/** Research budget allocation: shapes returned by /api/v1/finance/budgets (budget.service.js, incentiveCycle.service.js). */

/** The period incentive policies and the research budget share (default April–March). */
export interface IncentiveCycle {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  notes: string | null;
  isCurrent: boolean;
  /** On list responses; read-only viewers get only the id. */
  budget?: { id: string; totalAmount?: number } | null;
  createdAt?: string;
  updatedAt?: string;
}

/** What a budget view needs to know about its cycle. */
export type CycleRef = Pick<IncentiveCycle, 'id' | 'name' | 'startDate' | 'endDate'>;

export interface CycleList {
  access: { canEdit: boolean; scoped: boolean };
  cycles: IncentiveCycle[];
  /** Prefill for "New cycle". */
  suggestion: { name: string; startDate: string; endDate: string };
}

export interface CycleInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  notes?: string | null;
}

export type PolicyType = 'research_paper' | 'book' | 'book_chapter' | 'conference_paper' | 'ipr' | 'grant';

export interface CyclePolicy {
  id: string;
  type: PolicyType;
  typeLabel: string;
  href: string;
  name: string;
  key: string | null;
  amount: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /** False for a (legacy) policy that runs outside the cycle's dates. */
  fitsCycle: boolean;
}

export interface CyclePolicies {
  cycle: CycleRef;
  items: CyclePolicy[];
  byType: Array<{ type: PolicyType; label: string; href: string; count: number }>;
}

export type BudgetCategory = 'research_paper' | 'book' | 'book_chapter' | 'conference_paper' | 'ipr' | 'grant';
export type BudgetNodeType = 'university' | 'school' | 'department' | 'unassigned';
export type BudgetStatus = 'healthy' | 'warning' | 'over' | 'unallocated' | 'unattributed';
export type CategoryAllocations = Partial<Record<BudgetCategory, number>>;

export interface BudgetFigures {
  allocated: number;
  committed: number;
  utilised: number;
  pending: number;
  consumed: number;
  available: number;
  utilisationPct: number | null;
  lines: number;
  status: BudgetStatus;
}

export interface CategoryRow {
  category: BudgetCategory | 'other';
  label: string;
  allocated: number;
  committed: number;
  utilised: number;
  pending: number;
  consumed: number;
  lines: number;
}

export interface BudgetNode extends BudgetFigures {
  nodeType: BudgetNodeType;
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  allocationId: string | null;
  hasAllocation: boolean;
  categoryAllocations: CategoryAllocations;
  categories: CategoryRow[];
  externalFunding: { amount: number; count: number };
  updatedAt: string | null;
  children: BudgetNode[];
  /** University and schools: sum of the children's allocations. */
  childrenAllocated?: number;
  unallocated?: number;
  /** Schools: lines attributed to the school but to no department. */
  withoutDepartment?: BudgetFigures | null;
  scoped?: boolean;
}

export interface ResearchBudget {
  id: string;
  cycleId: string;
  totalAmount: number;
  categoryAllocations: CategoryAllocations;
  notes: string | null;
  enforceLimit: boolean;
  warnThresholdPct: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSummary {
  total: number;
  allocatedToSchools: number;
  unallocated: number;
  committed: number;
  utilised: number;
  pending: number;
  consumed: number;
  available: number;
  utilisationPct: number | null;
  status: BudgetStatus;
  externalFunding: { amount: number; count: number };
  warnThresholdPct: number;
}

export interface BudgetTreeResponse {
  cycle: IncentiveCycle;
  budget: ResearchBudget | null;
  tree: BudgetNode;
  summary: BudgetSummary;
  access: { canEdit: boolean; scoped: boolean };
}

export interface MonthPoint {
  month: string;
  utilised: number;
  committed: number;
  cumulativeUtilised: number;
}

export interface BurnRate {
  monthsElapsed: number;
  totalMonths: number;
  avgMonthly: number;
  projectedCycleEnd: number;
  projectedPct: number | null;
}

export interface BudgetEvent {
  id: string;
  cycleId: string;
  nodeType: BudgetNodeType;
  nodeId: string;
  nodeName: string | null;
  action: string;
  oldAmount: number | null;
  newAmount: number | null;
  oldCategories: CategoryAllocations | null;
  newCategories: CategoryAllocations | null;
  details: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
  actor: { uid?: string; employeeDetails?: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null } | null;
}

export interface NodeLine {
  id: string;
  title: string;
  payeeName: string;
  payeeEmployeeId: string | null;
  workType: string;
  sourceType: string;
  status: string;
  approvedAmount: number;
  referenceNumber: string | null;
  paidAt: string | null;
  category: BudgetCategory | 'other';
}

export interface FundReceipt {
  id: string;
  amount: number;
  receivedDate: string;
  reference: string | null;
  grantId: string | null;
  grantTitle: string | null;
  applicationNumber: string | null;
  agency: string | null;
}

export interface NodeDetail {
  cycle: IncentiveCycle;
  node: BudgetNode;
  monthly: MonthPoint[];
  burnRate: BurnRate;
  lines: { total: number; items: NodeLine[] };
  externalFunding: { amount: number; count: number; receipts: FundReceipt[] };
  history: BudgetEvent[];
}

export interface AnalyticsNode extends Omit<BudgetFigures, 'lines'> {
  nodeType: BudgetNodeType;
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  externalFunding: number;
}

export interface BudgetAnalytics {
  cycle: IncentiveCycle;
  hasBudget: boolean;
  summary: BudgetSummary;
  byNode: AnalyticsNode[];
  bySchool: AnalyticsNode[];
  unassigned: AnalyticsNode | null;
  byCategory: CategoryRow[];
  monthly: MonthPoint[];
  burnRate: BurnRate;
  topOver: AnalyticsNode[];
  topUnder: AnalyticsNode[];
}

export interface BudgetInput {
  totalAmount: number;
  categoryAllocations?: CategoryAllocations;
  notes?: string | null;
  enforceLimit?: boolean;
  warnThresholdPct?: number;
  reason?: string;
}

export interface AllocationInput {
  nodeType: 'school' | 'department';
  nodeId: string;
  amount: number;
  categoryAllocations?: CategoryAllocations;
  reason?: string;
}

/** Over-budget warning returned by recommend / batch approval. */
export interface BudgetWarning {
  cycleId: string;
  cycleName: string;
  nodeType: BudgetNodeType;
  nodeId: string;
  nodeName: string;
  allocated: number;
  consumed: number;
  over: number;
  message: string;
}
