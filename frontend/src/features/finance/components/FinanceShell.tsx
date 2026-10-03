'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { AnalyticsHero, AnalyticsShell } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { useFinancePermissions } from '../hooks/useFinancePermissions';
import { AccessDenied, BlockSkeleton } from './FinanceStates';
import { financialYearOptions } from '../utils/format';

const NAV = [
  { href: '/finance', label: 'Dashboard' },
  { href: '/finance/payouts', label: 'Verification queue' },
  { href: '/finance/batches', label: 'Payment batches' },
  { href: '/finance/budgets', label: 'Research budget' },
];

function FinanceSubnav() {
  const pathname = usePathname() || '';
  return (
    <nav aria-label="Finance sections" className="border-b border-stone-200 bg-white/80 px-4 backdrop-blur dark:border-gray-700 dark:bg-gray-900/80 sm:px-6 lg:px-8">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {NAV.map((item) => {
          const active = item.href === '/finance' ? pathname === '/finance' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 ${
                  active
                    ? 'border-wine text-wine dark:border-amber dark:text-amber'
                    : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface ShellProps {
  title: string;
  description: string;
  eyebrow?: string;
  chips?: Array<{ label: string; value: string }>;
  actions?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  /** Set when a query came back 403: the backend is the authority on access. */
  forbidden?: boolean;
  /**
   * Hide the page unless the user holds a finance permission (default). Pages that also serve
   * read-only viewers (research budget: DRD analytics holders) pass false and rely on `forbidden`.
   */
  gate?: boolean;
  children: React.ReactNode;
}

/** Finance page frame: permission gate, branded hero, section tabs, content gutter. */
export function FinancePageShell({ title, description, eyebrow = 'Research incentive payouts', chips, actions, onBack, backLabel, forbidden, gate = true, children }: ShellProps) {
  const perms = useFinancePermissions();

  if (gate && perms.isLoading) {
    return (
      <AnalyticsShell>
        <div className="space-y-4 p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading">
          <BlockSkeleton className="h-40" />
          <BlockSkeleton className="h-72" />
        </div>
      </AnalyticsShell>
    );
  }
  if ((gate && !perms.canView) || forbidden) return <AccessDenied />;

  return (
    <AnalyticsShell>
      <AnalyticsHero
        title={title}
        description={description}
        eyebrow={eyebrow}
        icon={<Landmark className="h-3.5 w-3.5" aria-hidden="true" />}
        actions={actions}
        chips={chips}
        onBack={onBack}
        backLabel={backLabel}
      />
      {perms.canView && <FinanceSubnav />}
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </AnalyticsShell>
  );
}

/** FY picker: current Indian financial year plus the four before it. */
export function FinancialYearSelect({
  value, onChange, tone = 'default', allowAll = false, label = 'Financial year',
}: {
  value: string;
  onChange: (fy: string) => void;
  tone?: 'default' | 'hero';
  allowAll?: boolean;
  label?: string;
}) {
  const id = useId();
  const options = financialYearOptions();
  const heroCls =
    'h-9 rounded-lg border border-white/30 bg-white/10 px-3 text-sm font-medium text-white outline-none backdrop-blur-sm transition focus:ring-2 focus:ring-white/40 [&>option]:text-stone-900';
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={tone === 'hero' ? 'text-xs font-medium text-white/80' : 'text-xs font-medium text-stone-600 dark:text-gray-300'}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={tone === 'hero' ? heroCls : ui.input}>
        {allowAll && <option value="">All years</option>}
        {options.map((fy) => (
          <option key={fy} value={fy}>FY {fy}</option>
        ))}
      </select>
    </div>
  );
}
