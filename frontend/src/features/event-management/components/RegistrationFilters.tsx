'use client';

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react';
import {
  Filter, X, ChevronDown, ChevronUp, Search,
  Users, GraduationCap, Building2, BookOpen, Calendar,
  Hash, Briefcase, Loader2,
} from 'lucide-react';
import type {
  RegistrationFilterParams,
  RegistrationFilterOptions,
} from '../types/registrationFilter.types';
import { ROLE_LABELS } from '../types/registrationFilter.types';

// ── Design Tokens ────────────────────────────────────────────────
const PANEL_BG = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';
const SECTION_HEADER = 'flex items-center justify-between cursor-pointer select-none py-2.5';
const BADGE = 'inline-flex items-center justify-center rounded-full bg-sgt-100 dark:bg-sgt-900/40 text-sgt-700 dark:text-sgt-300 text-[10px] font-bold min-w-[18px] h-[18px] px-1';
const CONNECTOR = 'flex items-center justify-center py-1';
const CONNECTOR_PILL = 'px-3 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-semibold border border-amber-200 dark:border-amber-800/40';
const INPUT_BASE = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all';
const SELECT_BASE = `${INPUT_BASE} appearance-none cursor-pointer`;
const CHECKBOX_BASE = 'w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-sgt-600 focus:ring-sgt-500 cursor-pointer';

// ── Collapsible Filter Section ────────────────────────────────
const FilterSection = memo(({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" className={SECTION_HEADER} onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</span>
          {count !== undefined && count > 0 && <span className={BADGE}>{count}</span>}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
});
FilterSection.displayName = 'FilterSection';

// ── AND connector badge ────────────────────────────────────────
const AndConnector = () => (
  <div className={CONNECTOR}>
    <span className={CONNECTOR_PILL}>AND</span>
  </div>
);

// ── Props ─────────────────────────────────────────────────────
interface RegistrationFiltersProps {
  filters: RegistrationFilterParams;
  options: RegistrationFilterOptions | null;
  optionsLoading: boolean;
  onFilterChange: (filters: RegistrationFilterParams) => void;
  onClose: () => void;
}

// ── Main Component ────────────────────────────────────────────
const RegistrationFilters: React.FC<RegistrationFiltersProps> = ({
  filters,
  options,
  optionsLoading,
  onFilterChange,
  onClose,
}) => {
  // Local state mirrors props; committed on change
  const [local, setLocal] = useState<RegistrationFilterParams>(filters);

  // Sync when external filters change (e.g. reset)
  useEffect(() => {
    setLocal(filters);
  }, [filters]);

  const update = useCallback(
    (patch: Partial<RegistrationFilterParams>) => {
      const next = { ...local, ...patch, page: 1 }; // reset page on filter change
      setLocal(next);
      onFilterChange(next);
    },
    [local, onFilterChange],
  );

  // Count active filters
  const activeCount = useMemo(() => {
    let c = 0;
    if (local.role) c++;
    if (local.gender) c++;
    if (local.schoolId) c++;
    if (local.departmentId) c++;
    if (local.programId) c++;
    if (local.passOutYear) c++;
    if (local.uid) c++;
    if (local.empId) c++;
    if (local.status && local.status !== 'all') c++;
    return c;
  }, [local]);

  const handleClearAll = useCallback(() => {
    const cleared: RegistrationFilterParams = { page: 1, limit: local.limit };
    setLocal(cleared);
    onFilterChange(cleared);
  }, [local.limit, onFilterChange]);

  // Show UID or EMPID field based on selected role
  const showUidField = !local.role || local.role === 'student';
  const showEmpIdField = !local.role || ['faculty', 'staff', 'admin'].includes(local.role);

  if (optionsLoading) {
    return (
      <div className={`${PANEL_BG} p-6`}>
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="w-5 h-5 animate-spin text-sgt-600" />
          <span className="text-sm text-gray-500">Loading filter options...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${PANEL_BG} overflow-hidden`}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filter</h3>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sgt-500 text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-sgt-600 dark:text-sgt-400 hover:underline font-medium"
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Filter Sections ───────────────────────────────────── */}
      <div className="px-4 py-2 space-y-0 max-h-[calc(100vh-280px)] overflow-y-auto">
        {/* Status */}
        <FilterSection icon={Filter} title="Status" count={local.status && local.status !== 'all' ? 1 : 0}>
          <div className="flex flex-wrap gap-2">
            {['all', 'confirmed', 'pending', 'cancelled', 'waitlisted'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => update({ status: s === 'all' ? undefined : s })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  (local.status || 'all') === s
                    ? 'bg-sgt-50 dark:bg-sgt-900/30 border-sgt-500 text-sgt-700 dark:text-sgt-300'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </FilterSection>

        <AndConnector />

        {/* Role */}
        {options && options.roles.length > 0 && (
          <>
            <FilterSection icon={Users} title="Role" count={local.role ? 1 : 0}>
              <div className="flex flex-wrap gap-2">
                {options.roles.map((r) => (
                  <label key={r} className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className={CHECKBOX_BASE}
                      checked={local.role === r}
                      onChange={() => update({ role: local.role === r ? undefined : r, uid: undefined, empId: undefined })}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {ROLE_LABELS[r] || r}
                    </span>
                  </label>
                ))}
              </div>
            </FilterSection>
            <AndConnector />
          </>
        )}

        {/* UID / REGNO (students) */}
        {showUidField && (
          <>
            <FilterSection icon={Hash} title="UID / Reg No" count={local.uid ? 1 : 0}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={local.uid || ''}
                  onChange={(e) => update({ uid: e.target.value || undefined })}
                  placeholder="Search by UID or Registration No..."
                  className={`${INPUT_BASE} pl-9`}
                />
              </div>
            </FilterSection>
            <AndConnector />
          </>
        )}

        {/* EMPID (employees) */}
        {showEmpIdField && (
          <>
            <FilterSection icon={Briefcase} title="Employee ID" count={local.empId ? 1 : 0}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={local.empId || ''}
                  onChange={(e) => update({ empId: e.target.value || undefined })}
                  placeholder="Search by EMPID..."
                  className={`${INPUT_BASE} pl-9`}
                />
              </div>
            </FilterSection>
            <AndConnector />
          </>
        )}

        {/* Gender */}
        {options && options.genders.length > 0 && (
          <>
            <FilterSection icon={Users} title="Gender" count={local.gender ? 1 : 0}>
              <div className="flex flex-wrap gap-2">
                {options.genders.map((g) => (
                  <label key={g} className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className={CHECKBOX_BASE}
                      checked={local.gender === g}
                      onChange={() => update({ gender: local.gender === g ? undefined : g })}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{g}</span>
                  </label>
                ))}
              </div>
            </FilterSection>
            <AndConnector />
          </>
        )}

        {/* School */}
        {options && options.schools.length > 0 && (
          <>
            <FilterSection icon={Building2} title="School" count={local.schoolId ? 1 : 0}>
              <select
                value={local.schoolId || ''}
                onChange={(e) => update({ schoolId: e.target.value || undefined })}
                className={SELECT_BASE}
              >
                <option value="">All Schools</option>
                {options.schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FilterSection>
            <AndConnector />
          </>
        )}

        {/* Department */}
        {options && options.departments.length > 0 && (
          <>
            <FilterSection icon={Building2} title="Department" count={local.departmentId ? 1 : 0}>
              <select
                value={local.departmentId || ''}
                onChange={(e) => update({ departmentId: e.target.value || undefined })}
                className={SELECT_BASE}
              >
                <option value="">All Departments</option>
                {options.departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </FilterSection>
            <AndConnector />
          </>
        )}

        {/* Program */}
        {options && options.programs.length > 0 && (
          <>
            <FilterSection icon={BookOpen} title="Program" count={local.programId ? 1 : 0}>
              <select
                value={local.programId || ''}
                onChange={(e) => update({ programId: e.target.value || undefined })}
                className={SELECT_BASE}
              >
                <option value="">All Programs</option>
                {options.programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FilterSection>
            <AndConnector />
          </>
        )}

        {/* Pass Out Year */}
        {options && options.passOutYears.length > 0 && (
          <FilterSection icon={Calendar} title="Pass Out Year" count={local.passOutYear ? 1 : 0}>
            <select
              value={local.passOutYear || ''}
              onChange={(e) => update({ passOutYear: e.target.value ? parseInt(e.target.value) : undefined })}
              className={SELECT_BASE}
            >
              <option value="">All Years</option>
              {options.passOutYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </FilterSection>
        )}
      </div>
    </div>
  );
};

export default memo(RegistrationFilters);
