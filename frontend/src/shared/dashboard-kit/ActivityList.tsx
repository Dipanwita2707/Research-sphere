'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActivityItem {
  id: string | number;
  title: string;
  meta?: string;
  timestamp?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  href?: string;
  onClick?: () => void;
}

interface ActivityListProps {
  items: ActivityItem[];
  emptyLabel?: string;
  renderItem?: (item: ActivityItem) => ReactNode;
}

const toneClasses: Record<string, string> = {
  default: 'bg-peach/60 dark:bg-wine/20 text-wine dark:text-amber-400',
  success: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  warning: 'bg-amber/10 dark:bg-amber-900/30 text-amber dark:text-amber-400',
  danger: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

export default function ActivityList({ items, emptyLabel = 'Nothing to show yet.', renderItem }: ActivityListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {items.map((item) => {
        if (renderItem) {
          return <li key={item.id}>{renderItem(item)}</li>;
        }
        const Icon = item.icon;
        const Wrapper = item.href ? 'a' : 'div';
        return (
          <li key={item.id}>
            <Wrapper
              href={item.href}
              onClick={item.onClick}
              className={cn(
                'flex items-center gap-3 py-2.5 first:pt-0 last:pb-0',
                (item.href || item.onClick) && 'cursor-pointer hover:opacity-80'
              )}
            >
              {Icon && (
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', toneClasses[item.tone || 'default'])}>
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.title}</p>
                {item.meta && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.meta}</p>}
              </div>
              {item.timestamp && (
                <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">{item.timestamp}</span>
              )}
            </Wrapper>
          </li>
        );
      })}
    </ul>
  );
}
