/**
 * Club status badge component - shared across club list and detail views
 */

import { CLUB_STATUS_CONFIG } from '../constants';

interface ClubStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function ClubStatusBadge({ status, size = 'sm' }: ClubStatusBadgeProps) {
  const config = CLUB_STATUS_CONFIG[status] || CLUB_STATUS_CONFIG.active;
  const sizeClass = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${config.className}`}
    >
      {config.label}
    </span>
  );
}
