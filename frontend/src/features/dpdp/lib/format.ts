import type { BreachStatus, RequestStatus, RequestType } from '../types';

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  access: 'Access my data',
  correction: 'Correct my data',
  erasure: 'Erase my data',
  grievance: 'Grievance / complaint',
  consent_withdrawal: 'Withdraw consent',
  nomination: 'Nominee update',
};

export const REQUEST_TYPE_HELP: Record<RequestType, string> = {
  access: 'Get a summary of the personal data we process about you and who it has been shared with.',
  correction: 'Ask us to correct, complete or update inaccurate or outdated personal data.',
  erasure:
    'Ask us to erase personal data that is no longer needed. Data we are legally required to keep (e.g. academic and financial records) will be retained.',
  grievance: 'Raise a complaint about how your personal data has been handled.',
  consent_withdrawal: 'Ask for help withdrawing a consent you gave earlier.',
  nomination: 'Register or change the person who may exercise your rights on your behalf.',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  completed: 'Completed',
  rejected: 'Rejected',
};

export const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  submitted: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
  in_review: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  completed: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800',
  rejected: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800',
};

export const BREACH_STATUS_LABELS: Record<BreachStatus, string> = {
  detected: 'Detected',
  contained: 'Contained',
  board_notified: 'Board notified',
  principals_notified: 'Principals notified',
  closed: 'Closed',
};

export const BREACH_STATUS_STYLES: Record<BreachStatus, string> = {
  detected: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800',
  contained: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  board_notified: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
  principals_notified:
    'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800',
  closed: 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
};

export const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
  high: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800',
  critical: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800',
};

export function formatDate(value?: string | null, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** Human "in 5h 12m" / "overdue by 3h" text. */
export function formatCountdown(target?: string | null, now = Date.now()): { text: string; overdue: boolean; ms: number } {
  if (!target) return { text: '—', overdue: false, ms: 0 };
  const ms = new Date(target).getTime() - now;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const parts = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return ms >= 0 ? { text: `${parts} left`, overdue: false, ms } : { text: `overdue by ${parts}`, overdue: true, ms };
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = error as { response?: { data?: { message?: unknown; error?: unknown } }; message?: unknown } | null;
  const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? null;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof e?.message === 'string' && e.message && !/status code/i.test(e.message)) return e.message;
  return fallback;
}

export function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

export function humanise(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
