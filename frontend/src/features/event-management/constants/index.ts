/**
 * Event Management Constants
 */

export const EVENT_TYPE_LABELS: Record<string, string> = {
  seminar: 'Seminar',
  workshop: 'Workshop',
  fest: 'Fest',
  conference: 'Conference',
  competition: 'Competition',
  cultural: 'Cultural',
  technical: 'Technical',
  sports: 'Sports',
  other: 'Other',
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    dot: 'bg-gray-400',
  },
  published: {
    label: 'Published',
    color: 'bg-sgt-50 text-sgt-700 dark:bg-sgt-900/20 dark:text-sgt-300',
    dot: 'bg-sgt-500',
  },
  ongoing: {
    label: 'Live Now',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  completed: {
    label: 'Completed',
    color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    dot: 'bg-red-500',
  },
};
