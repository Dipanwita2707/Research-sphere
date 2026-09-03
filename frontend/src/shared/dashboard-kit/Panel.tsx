'use client';

import { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  padding?: 'none' | 'sm' | 'default';
  noBorder?: boolean;
}

export default function Panel({
  title,
  subtitle,
  action,
  icon,
  children,
  className,
  bodyClassName,
  padding = 'default',
  noBorder = false,
  ...rest
}: PanelProps) {
  const paddingClass = padding === 'none' ? '' : padding === 'sm' ? 'p-4 sm:p-5' : 'p-5 sm:p-6';

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl',
        !noBorder && 'border border-gray-100 dark:border-gray-800',
        'shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.03)]',
        'hover:shadow-[0_2px_8px_rgba(0,0,0,0.07),0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-300',
        className
      )}
      {...rest}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-peach to-peach/30 dark:from-wine/25 dark:to-wine/5 flex items-center justify-center text-wine dark:text-amber-400 shadow-sm">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
              )}
              {subtitle && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {(title || action) && <div className="h-px bg-gray-50 dark:bg-gray-800 mx-5 sm:mx-6" />}
      <div className={cn(!title && !action ? paddingClass : `px-5 sm:px-6 py-4 sm:py-5`, bodyClassName)}>
        {children}
      </div>
    </div>
  );
}