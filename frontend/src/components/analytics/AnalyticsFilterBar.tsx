'use client';

import React from 'react';
import { CalendarDays, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ui } from './theme';

interface FilterOption {
  value: string;
  label: string;
}

export interface AnalyticsFilterBarProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (v: string) => void;
  onToDateChange: (v: string) => void;
  category?: string;
  onCategoryChange?: (v: string) => void;
  categoryOptions?: FilterOption[];
  schoolId?: string;
  onSchoolChange?: (v: string) => void;
  schoolOptions?: FilterOption[];
  departmentId?: string;
  onDepartmentChange?: (v: string) => void;
  departmentOptions?: FilterOption[];
  onApply: () => void;
  onReset?: () => void;
  quickFilters?: { label: string; from: string; to: string }[];
  children?: React.ReactNode;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DEFAULT_QUICK_FILTERS = [
  { label: '30 days', from: isoDate(new Date(Date.now() - 30 * 86400e3)), to: isoDate(new Date()) },
  { label: '90 days', from: isoDate(new Date(Date.now() - 90 * 86400e3)), to: isoDate(new Date()) },
  { label: 'YTD', from: `${new Date().getFullYear()}-01-01`, to: isoDate(new Date()) },
  { label: 'Last year', from: `${new Date().getFullYear() - 1}-01-01`, to: `${new Date().getFullYear() - 1}-12-31` },
];

const INPUT_CLS = ui.input;
const SELECT_CLS = `${ui.input} appearance-none pr-8 bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_0.6rem_center] bg-no-repeat`;

export default function AnalyticsFilterBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  category,
  onCategoryChange,
  categoryOptions,
  schoolId,
  onSchoolChange,
  schoolOptions,
  departmentId,
  onDepartmentChange,
  departmentOptions,
  onApply,
  onReset,
  quickFilters = DEFAULT_QUICK_FILTERS,
  children,
}: AnalyticsFilterBarProps) {
  const activeQuick = quickFilters.find((qf) => qf.from === fromDate && qf.to === toDate)?.label;
  return (
    <div className="sticky top-20 sm:top-[5.5rem] z-30 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:border-gray-700 dark:bg-gray-800/90 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-gray-400">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Period
        </span>

        {/* Quick ranges — segmented control */}
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50" role="group" aria-label="Quick date ranges">
          {quickFilters.map((qf) => {
            const active = activeQuick === qf.label;
            return (
              <button
                key={qf.label}
                aria-pressed={active}
                onClick={() => {
                  onFromDateChange(qf.from);
                  onToDateChange(qf.to);
                  setTimeout(onApply, 0);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber'
                    : 'text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                {qf.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-stone-400" />
          <input type="date" aria-label="From date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} className={INPUT_CLS} />
          <span className="text-xs text-stone-400">to</span>
          <input type="date" aria-label="To date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} className={INPUT_CLS} />
        </div>

        {categoryOptions && onCategoryChange && (
          <select aria-label="Category" value={category || 'all'} onChange={(e) => onCategoryChange(e.target.value)} className={SELECT_CLS}>
            <option value="all">All categories</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {schoolOptions && onSchoolChange && (
          <select aria-label="School" value={schoolId || ''} onChange={(e) => onSchoolChange(e.target.value)} className={SELECT_CLS}>
            <option value="">All schools</option>
            {schoolOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {departmentOptions && onDepartmentChange && (
          <select aria-label="Department" value={departmentId || ''} onChange={(e) => onDepartmentChange(e.target.value)} className={SELECT_CLS}>
            <option value="">All departments</option>
            {departmentOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          {onReset && (
            <button onClick={onReset} className={ui.btnSecondary}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button onClick={onApply} className={ui.btnPrimary}>
            Apply
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
