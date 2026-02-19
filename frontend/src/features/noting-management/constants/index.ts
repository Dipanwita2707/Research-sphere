/**
 * Noting Management Constants
 */

import type { LucideIcon } from 'lucide-react';
import { FileText, Clock, CheckCircle, XCircle, Send, RotateCcw } from 'lucide-react';

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600 border border-gray-200', icon: FileText },
  pending: { label: 'In Review', color: 'bg-amber-50 text-amber-700 border border-amber-200', icon: Clock },
  approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle },
  reverted: { label: 'Reverted', color: 'bg-orange-50 text-orange-700 border border-orange-200', icon: RotateCcw },
};

export const MY_ACTION_CONFIG: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  approved: { label: 'Approved by you', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircle },
  rejected: { label: 'Rejected by you', color: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle },
  forwarded: { label: 'Forwarded by you', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: Send },
  reverted: { label: 'Reverted by you', color: 'bg-orange-50 text-orange-700 border border-orange-200', icon: RotateCcw },
};

export const PAGE_SIZE = 20;
