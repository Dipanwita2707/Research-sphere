import { Ticket, Clock, AlertTriangle, CheckCircle, XCircle, ArrowUpCircle } from 'lucide-react';
import type { TmsTicketStatus, TmsPriority, TmsMessageType, TmsEscalationLevel } from '../types/tms.types';

export const PAGE_SIZE = 20;

export const STATUS_CONFIG: Record<TmsTicketStatus, { label: string; color: string; bgColor: string; icon: typeof Ticket }> = {
  open: {
    label: 'Open',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    icon: Ticket,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    icon: Clock,
  },
  escalated: {
    label: 'Escalated',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    icon: ArrowUpCircle,
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    icon: CheckCircle,
  },
  closed: {
    label: 'Closed',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700',
    icon: XCircle,
  },
};

export const PRIORITY_CONFIG: Record<TmsPriority, { label: string; color: string; bgColor: string }> = {
  low: {
    label: 'Low',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  medium: {
    label: 'Medium',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
  },
  high: {
    label: 'High',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/40',
  },
  urgent: {
    label: 'Urgent',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/40',
  },
};

export const MESSAGE_TYPE_CONFIG: Record<TmsMessageType, { label: string; color: string; bgColor: string }> = {
  grievance: {
    label: 'Grievance',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
  },
  assistance: {
    label: 'Assistance',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
  },
  enquiry: {
    label: 'Enquiry',
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
  },
  feedback: {
    label: 'Feedback',
    color: 'text-teal-700 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/30',
  },
};

export const ESCALATION_LEVEL_LABELS: Record<TmsEscalationLevel, string> = {
  sub_category: 'Sub-Category Handler',
  category: 'Category Handler',
  master_category: 'Master Category Handler',
  registrar: 'Registrar',
  dean_academics: 'Dean Academics',
  vice_chancellor: 'Vice Chancellor',
};
