// ── Shared Design-System Constants for Management Tabs ──────────

export const CARD =
  'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';

export const CARD_HEADER = 'px-5 py-3.5 border-b border-gray-100 dark:border-gray-700';

export const METRIC_CARD = `${CARD} p-5 hover:shadow-sgt-lg hover:-translate-y-0.5 transition-all duration-200`;

export const STATUS_COLORS = {
  confirmed: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    chart: '#10b981',
  },
  pending: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
    chart: '#f59e0b',
  },
  cancelled: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    chart: '#ef4444',
  },
  waitlisted: {
    bg: 'bg-gray-50 dark:bg-gray-700/30',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-500',
    chart: '#6b7280',
  },
} as const;

export const CHART_COLORS = ['#0F2573', '#266CA9', '#4BBAF2', '#ADE1FB', '#041D56'];
