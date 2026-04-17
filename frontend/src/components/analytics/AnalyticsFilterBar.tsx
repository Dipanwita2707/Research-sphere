'use client';

import React from 'react';
import { CalendarDays, RotateCcw, SlidersHorizontal } from 'lucide-react';

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

const INPUT_CLS =
  'h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-700 px-3 text-sm text-slate-700 dark:text-gray-200 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:focus:ring-slate-700';
const SELECT_CLS =
  'h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-700 pl-3 pr-7 text-sm text-slate-700 dark:text-gray-200 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 dark:focus:ring-slate-700 appearance-none';

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
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 px-6 py-3 sm:px-8 lg:px-12 xl:px-16">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Filter icon label */}
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </span>

        {/* Quick filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {quickFilters.map((qf) => (
            <button
              key={qf.label}
              onClick={() => {
                onFromDateChange(qf.from);
                onToDateChange(qf.to);
                setTimeout(onApply, 0);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                fromDate ===
   qf.from && toDate ===
   qf.to
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-gray-700 text-slate-600 dark:text-gray-300 hover:border-slate-300 hover:bg-white dark:hover:bg-gray-600'
              }`}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden h-5 w-px bg-slate-200 sm:block" />

        {/* Date range */}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className={INPUT_CLS}
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className={INPUT_CLS}
          />
        </div>

        {/* Category */}
        {categoryOptions && onCategoryChange && (
          <select
            value={category || 'all'}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="all">All categories</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {/* School */}
        {schoolOptions && onSchoolChange && (
          <select
            value={schoolId || ''}
            onChange={(e) => onSchoolChange(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All schools</option>
            {schoolOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {/* Department */}
        {departmentOptions && onDepartmentChange && (
          <select
            value={departmentId || ''}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All departments</option>
            {departmentOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-700 px-3.5 text-xs font-medium text-slate-500 dark:text-gray-400 transition-colors hover:bg-slate-50 dark:hover:bg-gray-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            onClick={onApply}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Apply
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
