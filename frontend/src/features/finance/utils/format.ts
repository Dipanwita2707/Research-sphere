import { isAxiosError } from '@/shared/api/api';
import type { BatchStatus, BudgetWarning, PayoutSourceType, PayoutStatus } from '../types';

// ─── Money and dates (en-IN) ────────────────────────────────────────────────

const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,23,456 — paise shown only when present. */
export function formatINR(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(Math.round(n * 100) / 100) ? inrWhole.format(n) : inrExact.format(n);
}

/** Headline figures: ₹12.4 L, ₹1.25 Cr; below one lakh, the full amount. */
export function formatINRCompact(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
  return inrWhole.format(n);
}

export function formatNumber(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('en-IN');
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

/** "2026-05" → "May 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Today's date in IST as YYYY-MM-DD (for date inputs). */
export function todayIST(): string {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10);
}

// ─── Financial years (April–March, IST) ─────────────────────────────────────

/** Indian financial year containing `date`, e.g. 2 Oct 2026 → "2026-27". Mirrors the backend. */
export function financialYearOf(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Current FY and the four before it, newest first. */
export function financialYearOptions(count = 5, now: Date = new Date()): string[] {
  const start = Number(financialYearOf(now).slice(0, 4));
  return Array.from({ length: count }, (_, i) => {
    const s = start - i;
    return `${s}-${String((s + 1) % 100).padStart(2, '0')}`;
  });
}

/** The twelve months of an FY as "YYYY-MM", April first. */
export function monthsOfFinancialYear(fy: string): string[] {
  const start = Number(fy.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const m = (3 + i) % 12;
    const y = i < 9 ? start : start + 1;
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  });
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export const WORK_TYPE_LABELS: Record<string, string> = {
  research_paper: 'Research paper',
  book: 'Book',
  book_chapter: 'Book chapter',
  conference_paper: 'Conference paper',
  grant: 'Grant',
  patent: 'Patent',
  copyright: 'Copyright',
  trademark: 'Trademark',
  design: 'Design',
};

export const workTypeLabel = (t: string | null | undefined) =>
  (t && WORK_TYPE_LABELS[t]) || (t ? t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');

export const PAYOUT_STATUS_META: Record<PayoutStatus, { label: string; tone: Tone }> = {
  pending_verification: { label: 'Awaiting verification', tone: 'amber' },
  recommended: { label: 'Recommended', tone: 'sky' },
  on_hold: { label: 'On hold', tone: 'rose' },
  approved: { label: 'Approved', tone: 'violet' },
  paid: { label: 'Paid', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'stone' },
};

export const BATCH_STATUS_META: Record<BatchStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved — awaiting payment', tone: 'violet' },
  paid: { label: 'Paid', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'stone' },
};

export type Tone = 'amber' | 'sky' | 'rose' | 'violet' | 'emerald' | 'stone' | 'wine';

export const TONE_CLASSES: Record<Tone, string> = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-400/20',
  sky: 'bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-900/30 dark:text-sky-200 dark:ring-sky-400/20',
  rose: 'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-400/20',
  violet: 'bg-violet-50 text-violet-800 ring-violet-600/20 dark:bg-violet-900/30 dark:text-violet-200 dark:ring-violet-400/20',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-400/20',
  stone: 'bg-stone-100 text-stone-700 ring-stone-500/20 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-500/30',
  wine: 'bg-rose-50 text-wine ring-wine/20 dark:bg-wine/30 dark:text-rose-100 dark:ring-rose-300/20',
};

export const EVENT_LABELS: Record<string, string> = {
  recommended: 'Recommended for payment',
  held: 'Put on hold',
  adjusted: 'Amount adjusted',
  cancelled: 'Cancelled',
  duplicate_skipped: 'Duplicate skipped',
  batch_created: 'Batch prepared',
  batch_approved: 'Batch approved',
  batch_paid: 'Payment recorded',
  batch_cancelled: 'Batch cancelled',
  created: 'Line created',
};

export const eventLabel = (action: string) =>
  EVENT_LABELS[action] || action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Display name for a person reference from the API (createdBy / approvedBy / paidBy / actor). */
export function personName(p?: { uid?: string; employeeDetails?: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null } | null): string | null {
  if (!p) return null;
  const e = p.employeeDetails;
  return e?.displayName || [e?.firstName, e?.lastName].filter(Boolean).join(' ') || p.uid || null;
}

/** Link to the record a payout line was raised from, or null when there is no page for it. */
export function sourceHref(line: { sourceType: PayoutSourceType | string; sourceId: string; researchContributionId: string | null }): string | null {
  if (line.sourceType === 'research_contribution') {
    const id = line.researchContributionId || line.sourceId;
    return id ? `/research/contribution/${id}` : null;
  }
  if (line.sourceType === 'ipr') return line.sourceId ? `/ipr/applications/${line.sourceId}` : null;
  if (line.sourceType === 'grant') return line.sourceId ? `/research/grant/${line.sourceId}` : null;
  return null;
}

export const SOURCE_LABELS: Record<string, string> = {
  research_contribution: 'Research contribution',
  ipr: 'IPR application',
  grant: 'Grant application',
};

// ─── Errors ─────────────────────────────────────────────────────────────────

export interface FinanceApiError {
  status?: number;
  code?: string;
  message: string;
}

export function toFinanceError(err: unknown, fallback = 'Something went wrong. Please try again.'): FinanceApiError {
  if (isAxiosError(err)) {
    const data = (err.response?.data ?? {}) as { code?: string; message?: string };
    const status = err.response?.status;
    if (!err.response) return { message: 'Could not reach the server. Check your connection and try again.' };
    if (status === 403 && !data.code) {
      return { status, code: 'FORBIDDEN', message: data.message || 'You do not have permission to do this.' };
    }
    return { status, code: data.code, message: data.message || fallback };
  }
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return { message: (err as { message: string }).message };
  }
  return { message: fallback };
}

export const isForbidden = (err: unknown) => isAxiosError(err) && err.response?.status === 403;

export const SEPARATION_OF_DUTIES_MESSAGE =
  'You prepared this batch or recommended one of its lines. Payment batches need a second person: someone who neither prepared nor recommended it must approve.';

/** One-line toast text for over-budget warnings returned by recommend / batch approval; null when none. */
export function budgetWarningText(warnings: BudgetWarning[] | undefined | null): string | null {
  if (!warnings || !warnings.length) return null;
  const first = warnings[0];
  const over = `${first.nodeName} is ${formatINR(first.over)} over its ${first.cycleName} research budget (${formatINR(first.consumed)} committed or paid of ${formatINR(first.allocated)}).`;
  return warnings.length === 1 ? over : `${over} ${warnings.length - 1} more unit${warnings.length === 2 ? ' is' : 's are'} over budget. See Finance → Research budget.`;
}
