/** Research incentive payouts: shapes returned by /api/v1/finance (incentivePayout.service.js). */

export type PayoutStatus =
  | 'pending_verification'
  | 'recommended'
  | 'on_hold'
  | 'approved'
  | 'paid'
  | 'cancelled';

export type BatchStatus = 'draft' | 'approved' | 'paid' | 'cancelled';

export type PayoutSourceType = 'research_contribution' | 'grant' | 'ipr';

export type WorkType =
  | 'research_paper'
  | 'book'
  | 'book_chapter'
  | 'conference_paper'
  | 'grant'
  | 'patent'
  | 'copyright'
  | 'trademark'
  | 'design';

export interface AmountCount {
  count: number;
  amount: number;
}

export interface BatchRef {
  id: string;
  batchNumber: string;
  status: BatchStatus;
}

export interface PayoutLine {
  id: string;
  sourceType: PayoutSourceType;
  sourceId: string;
  researchContributionId: string | null;
  workType: WorkType | string;
  title: string;
  referenceNumber: string | null;
  payeeUserId?: string;
  payeeName: string;
  payeeEmployeeId: string | null;
  payeeRole: string | null;
  calculatedAmount: number;
  approvedAmount: number;
  points: number;
  adjustmentReason: string | null;
  status: PayoutStatus;
  holdReason: string | null;
  financialYear: string;
  sourceApprovedAt: string | null;
  recommendedById: string | null;
  recommendedAt: string | null;
  batchId: string | null;
  batch?: BatchRef | null;
  tdsAmount: number | null;
  netAmount: number | null;
  paymentReference: string | null;
  paidAt: string | null;
  createdAt?: string;
  schoolId?: string | null;
  departmentId?: string | null;
  school?: { id: string; facultyName: string; facultyCode: string } | null;
  department?: { id: string; departmentName: string; departmentCode: string } | null;
}

export interface PayoutEventActor {
  uid?: string | null;
  employeeDetails?: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null;
}

export interface PayoutEvent {
  id?: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  amount: number | string | null;
  comments: string | null;
  createdAt: string;
  actorId?: string | null;
  actor?: PayoutEventActor | null;
}

export interface PayoutDetail extends PayoutLine {
  events: PayoutEvent[];
}

/** Per-university finance rules (GET/PUT /finance/settings). */
export interface FinanceSettings {
  /** The batch preparer / recommenders may approve it, giving a reason. Off = a second person approves. */
  allowSelfApproval: boolean;
  updatedAt: string | null;
  updatedBy: PersonRef | null;
}

export interface PayoutListParams {
  status?: PayoutStatus[];
  financialYear?: string;
  /** Incentive cycle the lines are charged to (research budget), or "none". */
  cycleId?: string;
  workType?: string;
  search?: string;
  batchId?: string;
  /** School id, or "unassigned" for lines with no school. */
  schoolId?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
  /** Also return per-status totals for the same filters (queue tab badges). */
  withStatusCounts?: boolean;
}

export interface PayoutPage {
  items: PayoutLine[];
  total: number;
  page: number;
  limit: number;
  totalAmount: number;
  /** Present when requested with withStatusCounts; statuses with no lines are absent. */
  statusCounts?: Partial<Record<PayoutStatus, { count: number; amount: number }>>;
}

/** A person as returned by the API (createdBy / approvedBy / paidBy / event actor). */
export interface PersonRef {
  id?: string;
  uid?: string;
  employeeDetails?: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null;
}

export interface PayoutBatch {
  id: string;
  batchNumber: string;
  title: string | null;
  financialYear: string;
  status: BatchStatus;
  totalAmount: number;
  lineCount: number;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  approvalComments?: string | null;
  /** Approved by someone who prepared it or recommended its lines (university allows self-approval). */
  selfApproved?: boolean;
  cancelledReason?: string | null;
  paidAt: string | null;
  paymentDate: string | null;
  paymentReference: string | null;
  createdAt: string;
  createdBy?: PersonRef | null;
  approvedBy?: PersonRef | null;
  paidBy?: PersonRef | null;
}

export interface PayoutBatchDetail extends PayoutBatch {
  payouts: PayoutLine[];
  events: PayoutEvent[];
}

export interface FinanceDashboard {
  financialYear: string;
  totals: {
    liability: number;
    awaitingVerification: AmountCount;
    recommended: AmountCount;
    onHold: AmountCount;
    approved: AmountCount;
    paid: AmountCount;
  };
  byWorkType: Array<{ workType: string; count: number; amount: number }>;
  paidByMonth: Array<{ month: string; amount: number }>;
  topPayees: Array<{ userId: string; name: string; employeeId: string | null; count: number; amount: number }>;
  batches: Partial<Record<BatchStatus, AmountCount>>;
}

export interface MyIncentiveLine {
  id: string;
  sourceType: PayoutLine['sourceType'];
  sourceId: string;
  researchContributionId: string | null;
  workType: string;
  title: string;
  referenceNumber: string | null;
  approvedAmount: number;
  points: number;
  status: PayoutStatus;
  financialYear: string;
  sourceApprovedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  tdsAmount: number | null;
  netAmount: number | null;
  holdReason: string | null;
}

export interface MyIncentives {
  items: MyIncentiveLine[];
  summary: { paid: number; inProcess: number; onHold: number; points: number };
}

/** Over-budget warning returned with recommend / batch approval (see budget/types BudgetWarning). */
export type { BudgetWarning } from './budget/types';

export interface RecordPaymentInput {
  paymentReference: string;
  paymentDate: string;
  tds?: Record<string, number>;
}
