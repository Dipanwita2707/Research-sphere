'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  Settings, Users, GraduationCap, BookOpen, Layers,
  ChevronDown, ChevronRight, Check, AlertTriangle,
  Shield, School, UserCog, Loader2, Building2, Eye,
} from 'lucide-react';
import { useHierarchyData } from '../hooks/useEventSettings';
import { ALL_ROLES, ROLE_LABELS } from '../types/eventSettings.types';
import type { VisibleRole, StudentFilterType } from '../types/eventSettings.types';

// ── Types ────────────────────────────────────────────────────────
export interface EventVisibilityFormData {
  visibleToRoles: VisibleRole[];
  studentFilterType: StudentFilterType;
  allowedSchoolIds: string[];
  allowedDepartmentIds: string[];
  allowedProgramIds: string[];
  allowedBatchYears: number[];
  allowedSectionIds: string[];
  allowExtraPasses: boolean;
  maxExtraPassesPerUser: number;
}

export const defaultEventVisibilityForm: EventVisibilityFormData = {
  visibleToRoles: [],
  studentFilterType: 'all',
  allowedSchoolIds: [],
  allowedDepartmentIds: [],
  allowedProgramIds: [],
  allowedBatchYears: [],
  allowedSectionIds: [],
  allowExtraPasses: false,
  maxExtraPassesPerUser: 0,
};

// ── Design System ────────────────────────────────────────────────
const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-[#b3cde0] dark:border-ev-700 shadow-ev';
const CARD_HEADER = 'px-5 py-3.5 border-b border-[#b3cde0]/30 dark:border-gray-700';
const TOGGLE_ON = 'bg-emerald-500';
const TOGGLE_OFF = 'bg-gray-300 dark:bg-gray-600';

// ── Toggle Switch (exported for reuse in EventSettings) ──────────
export const ToggleSwitch = memo(({
  enabled,
  onToggle,
  disabled = false,
  size = 'md',
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const dims = size === 'lg' ? 'w-14 h-7' : size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const dot = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const translate = enabled
    ? size === 'lg' ? 'translate-x-7' : size === 'sm' ? 'translate-x-4' : 'translate-x-5'
    : 'translate-x-0.5';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ev-700 ${dims} ${enabled ? TOGGLE_ON : TOGGLE_OFF} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block ${dot} rounded-full bg-white shadow transform transition-transform duration-200 ${translate}`} />
    </button>
  );
});
ToggleSwitch.displayName = 'ToggleSwitch';

// ── Role Chip ────────────────────────────────────────────────────
const RoleChip = memo(({
  role,
  selected,
  onToggle,
  disabled = false,
}: {
  role: VisibleRole;
  selected: boolean;
  onToggle: (role: VisibleRole) => void;
  disabled?: boolean;
}) => {
  const icons: Record<VisibleRole, React.ElementType> = {
    student: GraduationCap,
    faculty: BookOpen,
    staff: UserCog,
    admin: Shield,
    parent: Users,
    superadmin: Shield,
  };
  const Icon = icons[role];

  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(role)}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all duration-200
        ${selected
          ? 'bg-ev-50 dark:bg-ev-900/30 border-ev-700 text-ev-800 dark:text-ev-200 shadow-ev'
          : 'bg-gray-50 dark:bg-gray-700/50 border-[#b3cde0] dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`
      }
    >
      <Icon className="w-4 h-4" />
      {ROLE_LABELS[role]}
      {selected && <Check className="w-3.5 h-3.5 text-ev-700 dark:text-ev-400" />}
    </button>
  );
});
RoleChip.displayName = 'RoleChip';

// ── Collapsible Section ──────────────────────────────────────────
const CollapsibleSection = memo(({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#b3cde0] dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
          {badge !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-ev-50 dark:bg-ev-900/30 text-ev-800 dark:text-ev-200 font-medium">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
});
CollapsibleSection.displayName = 'CollapsibleSection';

// ── Multi-Select Checkbox List ───────────────────────────────────
const CheckboxList = memo(({
  items,
  selectedIds,
  onToggle,
  labelKey,
  codeKey,
  emptyMessage = 'No items available',
  disabled = false,
}: {
  items: Array<{ id: string } & Record<string, any>>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  labelKey: string;
  codeKey?: string;
  emptyMessage?: string;
  disabled?: boolean;
}) => {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 italic py-2">{emptyMessage}</p>;
  }

  return (
    <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        return (
          <label
            key={item.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
              ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              ${isSelected
                ? 'bg-ev-50 dark:bg-ev-900/20'
                : disabled ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => !disabled && onToggle(item.id)}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-ev-700 focus:ring-ev-700"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">
                {item[labelKey]}
              </span>
              {codeKey && item[codeKey] && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{item[codeKey]}</span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
});
CheckboxList.displayName = 'CheckboxList';

// ── Batch Year Selector ──────────────────────────────────────────
const BatchYearSelector = memo(({
  batchYears,
  selected,
  onToggle,
  disabled = false,
}: {
  batchYears: number[];
  selected: number[];
  onToggle: (year: number) => void;
  disabled?: boolean;
}) => {
  if (batchYears.length === 0) {
    return <p className="text-sm text-gray-400 italic py-2">No batch years available</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {batchYears.map((year) => {
        const isSelected = selected.includes(year);
        return (
          <button
            key={year}
            type="button"
            onClick={() => !disabled && onToggle(year)}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all
              ${isSelected
                ? 'bg-ev-50 dark:bg-ev-900/30 border-ev-700 text-ev-800 dark:text-ev-200'
                : 'bg-gray-50 dark:bg-gray-700/50 border-[#b3cde0] dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
});
BatchYearSelector.displayName = 'BatchYearSelector';

// ── Main EventSettingsForm Component ─────────────────────────────
interface EventSettingsFormProps {
  data: EventVisibilityFormData;
  onChange: (data: EventVisibilityFormData) => void;
  disabled?: boolean;
}

export const EventSettingsForm: React.FC<EventSettingsFormProps> = ({ data, onChange, disabled = false }) => {
  const { data: hierarchy, isLoading: hierarchyLoading } = useHierarchyData(true);

  // ── Handlers ────────────────────────────────────────────────
  const handleRoleToggle = useCallback((role: VisibleRole) => {
    const newRoles = data.visibleToRoles.includes(role)
      ? data.visibleToRoles.filter((r) => r !== role)
      : [...data.visibleToRoles, role];
    if (newRoles.length === 0) return;
    onChange({ ...data, visibleToRoles: newRoles });
  }, [data, onChange]);

  const handleFilterTypeChange = useCallback((type: StudentFilterType) => {
    onChange({ ...data, studentFilterType: type });
  }, [data, onChange]);

  const handleSchoolToggle = useCallback((id: string) => {
    const newIds = data.allowedSchoolIds.includes(id)
      ? data.allowedSchoolIds.filter((s) => s !== id)
      : [...data.allowedSchoolIds, id];
    onChange({ ...data, allowedSchoolIds: newIds });
  }, [data, onChange]);

  const handleDeptToggle = useCallback((id: string) => {
    const newIds = data.allowedDepartmentIds.includes(id)
      ? data.allowedDepartmentIds.filter((d) => d !== id)
      : [...data.allowedDepartmentIds, id];
    onChange({ ...data, allowedDepartmentIds: newIds });
  }, [data, onChange]);

  const handleProgramToggle = useCallback((id: string) => {
    const newIds = data.allowedProgramIds.includes(id)
      ? data.allowedProgramIds.filter((p) => p !== id)
      : [...data.allowedProgramIds, id];
    onChange({ ...data, allowedProgramIds: newIds });
  }, [data, onChange]);

  const handleBatchYearToggle = useCallback((year: number) => {
    const newYears = data.allowedBatchYears.includes(year)
      ? data.allowedBatchYears.filter((y) => y !== year)
      : [...data.allowedBatchYears, year];
    onChange({ ...data, allowedBatchYears: newYears });
  }, [data, onChange]);

  const handleSectionToggle = useCallback((id: string) => {
    const newIds = data.allowedSectionIds.includes(id)
      ? data.allowedSectionIds.filter((s) => s !== id)
      : [...data.allowedSectionIds, id];
    onChange({ ...data, allowedSectionIds: newIds });
  }, [data, onChange]);

  const handleToggleExtraPasses = useCallback(() => {
    const next = !data.allowExtraPasses;
    onChange({ ...data, allowExtraPasses: next, maxExtraPassesPerUser: next ? (data.maxExtraPassesPerUser || 1) : 0 });
  }, [data, onChange]);

  const handleMaxExtraPassesChange = useCallback((val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0 && n <= 20) {
      onChange({ ...data, maxExtraPassesPerUser: n });
    }
  }, [data, onChange]);

  // ── Filtered hierarchy ──────────────────────────────────────
  const filteredDepartments = useMemo(() => {
    if (!hierarchy?.departments) return [];
    if (data.allowedSchoolIds.length === 0) return hierarchy.departments;
    return hierarchy.departments.filter((d: any) => data.allowedSchoolIds.includes(d.facultyId));
  }, [hierarchy?.departments, data.allowedSchoolIds]);

  const filteredPrograms = useMemo(() => {
    if (!hierarchy?.programs) return [];
    if (data.allowedDepartmentIds.length === 0 && data.allowedSchoolIds.length === 0) return hierarchy.programs;
    if (data.allowedDepartmentIds.length > 0)
      return hierarchy.programs.filter((p: any) => data.allowedDepartmentIds.includes(p.departmentId));
    return hierarchy.programs;
  }, [hierarchy?.programs, data.allowedDepartmentIds, data.allowedSchoolIds]);

  const filteredSections = useMemo(() => {
    if (!hierarchy?.sections) return [];
    let result = hierarchy.sections;
    if (data.allowedProgramIds.length > 0)
      result = result.filter((s: any) => data.allowedProgramIds.includes(s.programId));
    if (data.allowedBatchYears.length > 0)
      result = result.filter((s: any) => data.allowedBatchYears.includes(s.batchYear));
    return result;
  }, [hierarchy?.sections, data.allowedProgramIds, data.allowedBatchYears]);

  const isStudentEnabled = data.visibleToRoles.includes('student');

  return (
    <>
      {/* ── Extra Pass Settings ───────────────────────────────── */}
      <div className={CARD}>
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-ev-700 dark:text-ev-400" />
            <h3 className="text-base font-semibold text-ev-900 dark:text-white">
              Extra Pass Settings
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Control whether registered users can add guests and how many guests are allowed per registration.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ev-900 dark:text-white">Allow Extra Passes</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Users can add guest details under the same QR code.</p>
            </div>
            <ToggleSwitch enabled={data.allowExtraPasses} onToggle={handleToggleExtraPasses} disabled={disabled} />
          </div>

          {data.allowExtraPasses && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Extra Passes Per User
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={Math.max(1, data.maxExtraPassesPerUser)}
                onChange={(e) => handleMaxExtraPassesChange(e.target.value)}
                disabled={disabled}
                className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-ev-900 dark:text-gray-100 disabled:opacity-60"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Example: If set to 3, each registration can add up to 3 guest passes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Audience Visibility ────────────────────────────────── */}
      <div className={`${CARD} ${data.visibleToRoles.length === 0 ? 'border-red-300 dark:border-red-700/50' : ''}`}>
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-ev-700 dark:text-ev-400" />
            <h3 className="text-base font-semibold text-ev-900 dark:text-white">
              Audience Visibility
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Select which user roles can see this event.
          </p>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-3">
            {ALL_ROLES.map((role) => (
              <RoleChip
                key={role}
                role={role}
                selected={data.visibleToRoles.includes(role)}
                onToggle={handleRoleToggle}
                disabled={disabled}
              />
            ))}
          </div>

          {data.visibleToRoles.length === 0 && (
            <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-xs font-medium">At least one role must be selected</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Student Visibility Configuration ───────────────────── */}
      {isStudentEnabled && (
        <div className={CARD}>
          <div className={CARD_HEADER}>
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-ev-700 dark:text-ev-400" />
              <h3 className="text-base font-semibold text-ev-900 dark:text-white">
                Student Visibility Configuration
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Optionally restrict which students can see this event based on School, Department, Program, Batch, or Section.
            </p>
          </div>
          <div className="p-5 space-y-5">
            {/* Filter Type Toggle */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleFilterTypeChange('all')}
                disabled={disabled}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium text-center transition-all
                  ${data.studentFilterType === 'all'
                    ? 'bg-ev-50 dark:bg-ev-900/30 border-ev-700 text-ev-800 dark:text-ev-200'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-[#b3cde0] dark:border-gray-600 text-gray-500 hover:border-gray-300'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Users className="w-4 h-4 mx-auto mb-1" />
                Entire University
              </button>
              <button
                type="button"
                onClick={() => handleFilterTypeChange('custom')}
                disabled={disabled}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium text-center transition-all
                  ${data.studentFilterType === 'custom'
                    ? 'bg-ev-50 dark:bg-ev-900/30 border-ev-700 text-ev-800 dark:text-ev-200'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-[#b3cde0] dark:border-gray-600 text-gray-500 hover:border-gray-300'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Settings className="w-4 h-4 mx-auto mb-1" />
                Custom Selection
              </button>
            </div>

            {data.studentFilterType === 'all' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">All students across the university can see this event.</p>
              </div>
            )}

            {/* Custom Filter Hierarchy */}
            {data.studentFilterType === 'custom' && (
              <div className="space-y-3">
                {hierarchyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-ev-700" />
                    <span className="ml-2 text-sm text-gray-500">Loading hierarchy...</span>
                  </div>
                ) : (
                  <>
                    <CollapsibleSection
                      title="Schools"
                      icon={School}
                      defaultOpen
                      badge={data.allowedSchoolIds.length > 0 ? data.allowedSchoolIds.length : undefined}
                    >
                      <CheckboxList
                        items={hierarchy?.schools ?? []}
                        selectedIds={data.allowedSchoolIds}
                        onToggle={handleSchoolToggle}
                        labelKey="facultyName"
                        codeKey="facultyCode"
                        emptyMessage="No schools found"
                        disabled={disabled}
                      />
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Departments"
                      icon={Building2}
                      badge={data.allowedDepartmentIds.length > 0 ? data.allowedDepartmentIds.length : undefined}
                    >
                      <CheckboxList
                        items={filteredDepartments}
                        selectedIds={data.allowedDepartmentIds}
                        onToggle={handleDeptToggle}
                        labelKey="departmentName"
                        codeKey="departmentCode"
                        emptyMessage={data.allowedSchoolIds.length > 0 ? 'No departments in selected schools' : 'No departments found'}
                        disabled={disabled}
                      />
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Programs"
                      icon={BookOpen}
                      badge={data.allowedProgramIds.length > 0 ? data.allowedProgramIds.length : undefined}
                    >
                      <CheckboxList
                        items={filteredPrograms}
                        selectedIds={data.allowedProgramIds}
                        onToggle={handleProgramToggle}
                        labelKey="programName"
                        codeKey="programCode"
                        emptyMessage="No programs available"
                        disabled={disabled}
                      />
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Batch Years"
                      icon={Layers}
                      badge={data.allowedBatchYears.length > 0 ? data.allowedBatchYears.length : undefined}
                    >
                      <BatchYearSelector
                        batchYears={hierarchy?.batchYears ?? []}
                        selected={data.allowedBatchYears}
                        onToggle={handleBatchYearToggle}
                        disabled={disabled}
                      />
                    </CollapsibleSection>

                    <CollapsibleSection
                      title="Sections"
                      icon={Layers}
                      badge={data.allowedSectionIds.length > 0 ? data.allowedSectionIds.length : undefined}
                    >
                      <CheckboxList
                        items={filteredSections}
                        selectedIds={data.allowedSectionIds}
                        onToggle={handleSectionToggle}
                        labelKey="sectionName"
                        codeKey="sectionCode"
                        emptyMessage="No sections available"
                        disabled={disabled}
                      />
                    </CollapsibleSection>

                    {data.allowedSchoolIds.length === 0 && data.allowedDepartmentIds.length === 0 &&
                     data.allowedProgramIds.length === 0 && data.allowedBatchYears.length === 0 &&
                     data.allowedSectionIds.length === 0 && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          No specific filters selected — all students will be able to see this event.
                          Select Schools, Departments, Programs, Batches, or Sections to restrict access.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
