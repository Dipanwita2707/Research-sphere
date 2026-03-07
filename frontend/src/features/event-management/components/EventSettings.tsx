'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  Settings, Power, Eye, EyeOff, Users, GraduationCap,
  Building2, BookOpen, Layers, ChevronDown, ChevronRight,
  Check, X, Loader2, AlertTriangle, Shield,
  School, UserCog,
} from 'lucide-react';
import {
  useEventSettings,
  useHierarchyData,
  useUpdateEventSettings,
  useToggleEventActive,
} from '../hooks/useEventSettings';
import type {
  VisibleRole,
  StudentFilterType,
  EventVisibilityUpdate,
  SchoolItem,
  DepartmentItem,
  ProgramItem,
} from '../types/eventSettings.types';
import { ALL_ROLES, ROLE_LABELS } from '../types/eventSettings.types';

// ── Design System ────────────────────────────────────────────────
const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';
const CARD_HEADER = 'px-5 py-3.5 border-b border-gray-100 dark:border-gray-700';
const TOGGLE_ON = 'bg-emerald-500';
const TOGGLE_OFF = 'bg-gray-300 dark:bg-gray-600';

// ── Toggle Switch ────────────────────────────────────────────────
const ToggleSwitch = memo(({
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
      className={`relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sgt-500 ${dims} ${enabled ? TOGGLE_ON : TOGGLE_OFF} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
          ? 'bg-sgt-50 dark:bg-sgt-900/30 border-sgt-500 text-sgt-700 dark:text-sgt-300 shadow-sm'
          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`
      }
    >
      <Icon className="w-4 h-4" />
      {ROLE_LABELS[role]}
      {selected && <Check className="w-3.5 h-3.5 text-sgt-600 dark:text-sgt-400" />}
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
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
          {badge !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-sgt-100 dark:bg-sgt-900/30 text-sgt-700 dark:text-sgt-300 font-medium">
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
}: {
  items: Array<{ id: string } & Record<string, any>>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  labelKey: string;
  codeKey?: string;
  emptyMessage?: string;
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
            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors
              ${isSelected
                ? 'bg-sgt-50 dark:bg-sgt-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(item.id)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-sgt-600 focus:ring-sgt-500"
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
}: {
  batchYears: number[];
  selected: number[];
  onToggle: (year: number) => void;
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
            onClick={() => onToggle(year)}
            className={`px-3 py-1.5 text-sm rounded-lg border-2 font-medium transition-all
              ${isSelected
                ? 'bg-sgt-50 dark:bg-sgt-900/30 border-sgt-500 text-sgt-700 dark:text-sgt-300'
                : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
              }`}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
});
BatchYearSelector.displayName = 'BatchYearSelector';

// ── Main EventSettings Component ─────────────────────────────────
interface EventSettingsProps {
  eventId: string;
  onToast: (opts: { type: 'success' | 'error'; message: string }) => void;
}

const EventSettings: React.FC<EventSettingsProps> = ({ eventId, onToast }) => {
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useEventSettings(eventId);
  const { data: hierarchy, isLoading: hierarchyLoading } = useHierarchyData(!!settings);
  const updateMutation = useUpdateEventSettings(eventId);
  const toggleMutation = useToggleEventActive(eventId);

  // Local state for form (synced from server)
  const [localRoles, setLocalRoles] = useState<VisibleRole[] | null>(null);
  const [localFilterType, setLocalFilterType] = useState<StudentFilterType | null>(null);
  const [localSchools, setLocalSchools] = useState<string[] | null>(null);
  const [localDepts, setLocalDepts] = useState<string[] | null>(null);
  const [localPrograms, setLocalPrograms] = useState<string[] | null>(null);
  const [localBatchYears, setLocalBatchYears] = useState<number[] | null>(null);
  const [localSections, setLocalSections] = useState<string[] | null>(null);
  const [localAllowExtraPasses, setLocalAllowExtraPasses] = useState<boolean | null>(null);
  const [localMaxExtraPassesPerUser, setLocalMaxExtraPassesPerUser] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Effective values (local overrides server)
  const roles = localRoles ?? settings?.visibleToRoles ?? [];
  const filterType = localFilterType ?? settings?.studentFilterType ?? 'all';
  const selectedSchools = localSchools ?? settings?.allowedSchoolIds ?? [];
  const selectedDepts = localDepts ?? settings?.allowedDepartmentIds ?? [];
  const selectedPrograms = localPrograms ?? settings?.allowedProgramIds ?? [];
  const selectedBatchYears = localBatchYears ?? settings?.allowedBatchYears ?? [];
  const selectedSections = localSections ?? settings?.allowedSectionIds ?? [];
  const allowExtraPasses = localAllowExtraPasses ?? settings?.allowExtraPasses ?? false;
  const maxExtraPassesPerUser = localMaxExtraPassesPerUser ?? settings?.maxExtraPassesPerUser ?? 0;

  const isStudentEnabled = roles.includes('student');

  // ── Filtered hierarchy items (cascade: school → dept → program → section) ──
  const filteredDepartments = useMemo(() => {
    if (!hierarchy?.departments) return [];
    if (selectedSchools.length === 0) return hierarchy.departments;
    return hierarchy.departments.filter((d: DepartmentItem) => selectedSchools.includes(d.facultyId));
  }, [hierarchy?.departments, selectedSchools]);

  const filteredPrograms = useMemo(() => {
    if (!hierarchy?.programs) return [];
    const deptIds = selectedDepts.length > 0 ? selectedDepts : filteredDepartments.map((d: DepartmentItem) => d.id);
    if (selectedSchools.length === 0 && selectedDepts.length === 0) return hierarchy.programs;
    return hierarchy.programs.filter((p: ProgramItem) => deptIds.includes(p.departmentId));
  }, [hierarchy?.programs, selectedDepts, selectedSchools, filteredDepartments]);

  const filteredSections = useMemo(() => {
    if (!hierarchy?.sections) return [];
    const progIds = selectedPrograms.length > 0 ? selectedPrograms : filteredPrograms.map((p: ProgramItem) => p.id);
    if (selectedSchools.length === 0 && selectedDepts.length === 0 && selectedPrograms.length === 0) return hierarchy.sections;
    return hierarchy.sections.filter((s: { programId: string }) => progIds.includes(s.programId));
  }, [hierarchy?.sections, selectedPrograms, selectedSchools, selectedDepts, filteredPrograms]);

  // ── Handlers ─────────────────────────────────────────────────
  const markChanged = useCallback(() => setHasChanges(true), []);

  const handleRoleToggle = useCallback((role: VisibleRole) => {
    setLocalRoles((prev) => {
      const current = prev ?? settings?.visibleToRoles ?? [];
      const newRoles = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      return newRoles.length > 0 ? newRoles : current; // prevent empty
    });
    markChanged();
  }, [settings?.visibleToRoles, markChanged]);

  const handleFilterTypeChange = useCallback((type: StudentFilterType) => {
    setLocalFilterType(type);
    markChanged();
  }, [markChanged]);

  const toggleArrayItem = useCallback(<T extends string | number>(
    arr: T[],
    item: T,
    setter: React.Dispatch<React.SetStateAction<T[] | null>>,
    serverArr: T[],
  ) => {
    const current = arr;
    const newArr = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    setter(newArr);
    markChanged();
  }, [markChanged]);

  const handleSchoolToggle = useCallback((id: string) => {
    toggleArrayItem(selectedSchools, id, setLocalSchools as any, settings?.allowedSchoolIds ?? []);
  }, [selectedSchools, settings?.allowedSchoolIds, toggleArrayItem]);

  const handleDeptToggle = useCallback((id: string) => {
    toggleArrayItem(selectedDepts, id, setLocalDepts as any, settings?.allowedDepartmentIds ?? []);
  }, [selectedDepts, settings?.allowedDepartmentIds, toggleArrayItem]);

  const handleProgramToggle = useCallback((id: string) => {
    toggleArrayItem(selectedPrograms, id, setLocalPrograms as any, settings?.allowedProgramIds ?? []);
  }, [selectedPrograms, settings?.allowedProgramIds, toggleArrayItem]);

  const handleBatchYearToggle = useCallback((year: number) => {
    toggleArrayItem(selectedBatchYears, year, setLocalBatchYears as any, settings?.allowedBatchYears ?? []);
  }, [selectedBatchYears, settings?.allowedBatchYears, toggleArrayItem]);

  const handleSectionToggle = useCallback((id: string) => {
    toggleArrayItem(selectedSections, id, setLocalSections as any, settings?.allowedSectionIds ?? []);
  }, [selectedSections, settings?.allowedSectionIds, toggleArrayItem]);

  const handleToggleActive = useCallback(async () => {
    try {
      const result = await toggleMutation.mutateAsync();
      onToast({
        type: 'success',
        message: result.isActive ? 'Registration is now OPEN' : 'Registration is now CLOSED',
      });
    } catch (err: any) {
      onToast({ type: 'error', message: err?.response?.data?.message || 'Failed to toggle registration status' });
    }
  }, [toggleMutation, onToast]);

  const handleToggleExtraPasses = useCallback(() => {
    setLocalAllowExtraPasses((prev) => {
      const current = prev ?? settings?.allowExtraPasses ?? false;
      return !current;
    });
    if (!allowExtraPasses) {
      setLocalMaxExtraPassesPerUser((prev) => prev ?? Math.max(1, settings?.maxExtraPassesPerUser ?? 1));
    } else {
      setLocalMaxExtraPassesPerUser(0);
    }
    markChanged();
  }, [allowExtraPasses, settings?.allowExtraPasses, settings?.maxExtraPassesPerUser, markChanged]);

  const handleMaxExtraPassesChange = useCallback((value: string) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setLocalMaxExtraPassesPerUser(Math.max(0, Math.min(20, Math.floor(numeric))));
    markChanged();
  }, [markChanged]);

  const handleSave = useCallback(async () => {
    const payload: EventVisibilityUpdate = {
      visibleToRoles: roles,
      studentFilterType: filterType,
      allowedSchoolIds: selectedSchools,
      allowedDepartmentIds: selectedDepts,
      allowedProgramIds: selectedPrograms,
      allowedBatchYears: selectedBatchYears,
      allowedSectionIds: selectedSections,
      allowExtraPasses,
      maxExtraPassesPerUser: allowExtraPasses ? Math.max(1, maxExtraPassesPerUser) : 0,
    };

    try {
      await updateMutation.mutateAsync(payload);
      setHasChanges(false);
      // Reset local state to let server state take over
      setLocalRoles(null);
      setLocalFilterType(null);
      setLocalSchools(null);
      setLocalDepts(null);
      setLocalPrograms(null);
      setLocalBatchYears(null);
      setLocalSections(null);
      setLocalAllowExtraPasses(null);
      setLocalMaxExtraPassesPerUser(null);
      onToast({ type: 'success', message: 'Event settings saved successfully' });
    } catch (err: any) {
      onToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save event settings' });
    }
  }, [
    roles, filterType, selectedSchools, selectedDepts, selectedPrograms,
    selectedBatchYears, selectedSections, allowExtraPasses, maxExtraPassesPerUser,
    updateMutation, onToast,
  ]);

  const handleReset = useCallback(() => {
    setLocalRoles(null);
    setLocalFilterType(null);
    setLocalSchools(null);
    setLocalDepts(null);
    setLocalPrograms(null);
    setLocalBatchYears(null);
    setLocalSections(null);
    setLocalAllowExtraPasses(null);
    setLocalMaxExtraPassesPerUser(null);
    setHasChanges(false);
  }, []);

  // ── Loading / Error States ─────────────────────────────────────
  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-sgt-600" />
        <span className="ml-3 text-sm text-gray-500">Loading event settings...</span>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className={`${CARD} p-6`}>
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm">Failed to load event settings. Please try again.</p>
        </div>
      </div>
    );
  }

  const isActive = settings?.isActive ?? true;
  const autoClosed = settings?.autoClosed ?? false;
  const manuallyOverridden = settings?.manuallyOverridden ?? false;

  return (
    <div className="space-y-6">
      {/* ── Registration Open/Close Toggle ───────────────────────── */}
      <div className={`${CARD} overflow-hidden`}>
        <div className={`px-5 py-4 flex items-center justify-between ${isActive ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10' : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              <Power className={`w-6 h-6 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Registration Status
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isActive
                  ? 'Registration is OPEN — users can register for this event'
                  : 'Registration is CLOSED — event is visible but no new registrations allowed'}
              </p>
              {/* Auto-close indicator */}
              {autoClosed && !manuallyOverridden && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Auto-closed (registration end date passed)
                </span>
              )}
              {/* Manual override indicator */}
              {manuallyOverridden && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Admin override active
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {isActive ? 'OPEN' : 'CLOSED'}
            </span>
            {/* Toggle is ALWAYS enabled — admin can override regardless of date */}
            <ToggleSwitch
              enabled={isActive}
              onToggle={handleToggleActive}
              disabled={toggleMutation.isPending}
              size="lg"
            />
          </div>
        </div>
        {!isActive && (
          <div className="px-5 py-3 bg-amber-50/50 dark:bg-amber-900/5 border-t border-amber-100 dark:border-amber-900/20">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <EyeOff className="w-4 h-4" />
              <p className="text-xs font-medium">
                {autoClosed && !manuallyOverridden
                  ? 'Registration was automatically closed because the end date passed. You can still re-enable it manually using the toggle above.'
                  : 'Registration is closed. Users can still see the event but cannot register or join.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className={CARD}>
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-sgt-600 dark:text-sgt-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
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
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Allow Extra Passes</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Users can add guest details under the same QR code.</p>
            </div>
            <ToggleSwitch enabled={allowExtraPasses} onToggle={handleToggleExtraPasses} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Maximum Extra Passes Per User
            </label>
            <input
              type="number"
              min={allowExtraPasses ? 1 : 0}
              max={20}
              value={allowExtraPasses ? Math.max(1, maxExtraPassesPerUser) : 0}
              onChange={(e) => handleMaxExtraPassesChange(e.target.value)}
              disabled={!allowExtraPasses}
              className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Example: If set to 3, each registration can add up to 3 guest passes.
            </p>
          </div>
        </div>
      </div>

      {/* ── Visibility Configuration ──────────────────────────────── */}
      <div className={CARD}>
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-sgt-600 dark:text-sgt-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Audience Visibility
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Select which user roles can see this event. Unselected roles will not be able to see or access this event anywhere.
          </p>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-3">
            {ALL_ROLES.map((role) => (
              <RoleChip
                key={role}
                role={role}
                selected={roles.includes(role)}
                onToggle={handleRoleToggle}
              />
            ))}
          </div>

          {roles.length === 0 && (
            <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-xs">At least one role must be selected</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Student-Level Configuration ───────────────────────────── */}
      {isStudentEnabled && (
        <div className={CARD}>
          <div className={CARD_HEADER}>
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-sgt-600 dark:text-sgt-400" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
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
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium text-center transition-all
                  ${filterType === 'all'
                    ? 'bg-sgt-50 dark:bg-sgt-900/30 border-sgt-500 text-sgt-700 dark:text-sgt-300'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                  }`}
              >
                <Users className="w-4 h-4 mx-auto mb-1" />
                Entire University
              </button>
              <button
                type="button"
                onClick={() => handleFilterTypeChange('custom')}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium text-center transition-all
                  ${filterType === 'custom'
                    ? 'bg-sgt-50 dark:bg-sgt-900/30 border-sgt-500 text-sgt-700 dark:text-sgt-300'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                  }`}
              >
                <Settings className="w-4 h-4 mx-auto mb-1" />
                Custom Selection
              </button>
            </div>

            {filterType === 'all' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">All students across the university can see this event.</p>
              </div>
            )}

            {/* Custom Filter Hierarchy */}
            {filterType === 'custom' && (
              <div className="space-y-3">
                {hierarchyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-sgt-600" />
                    <span className="ml-2 text-sm text-gray-500">Loading hierarchy...</span>
                  </div>
                ) : (
                  <>
                    {/* Schools */}
                    <CollapsibleSection
                      title="Schools"
                      icon={School}
                      defaultOpen
                      badge={selectedSchools.length > 0 ? selectedSchools.length : undefined}
                    >
                      <CheckboxList
                        items={hierarchy?.schools ?? []}
                        selectedIds={selectedSchools}
                        onToggle={handleSchoolToggle}
                        labelKey="facultyName"
                        codeKey="facultyCode"
                        emptyMessage="No schools found"
                      />
                    </CollapsibleSection>

                    {/* Departments */}
                    <CollapsibleSection
                      title="Departments"
                      icon={Building2}
                      badge={selectedDepts.length > 0 ? selectedDepts.length : undefined}
                    >
                      <CheckboxList
                        items={filteredDepartments}
                        selectedIds={selectedDepts}
                        onToggle={handleDeptToggle}
                        labelKey="departmentName"
                        codeKey="departmentCode"
                        emptyMessage={selectedSchools.length > 0 ? 'No departments in selected schools' : 'No departments found'}
                      />
                    </CollapsibleSection>

                    {/* Programs */}
                    <CollapsibleSection
                      title="Programs"
                      icon={BookOpen}
                      badge={selectedPrograms.length > 0 ? selectedPrograms.length : undefined}
                    >
                      <CheckboxList
                        items={filteredPrograms}
                        selectedIds={selectedPrograms}
                        onToggle={handleProgramToggle}
                        labelKey="programName"
                        codeKey="programCode"
                        emptyMessage="No programs available"
                      />
                    </CollapsibleSection>

                    {/* Batch Years */}
                    <CollapsibleSection
                      title="Batch Years"
                      icon={Layers}
                      badge={selectedBatchYears.length > 0 ? selectedBatchYears.length : undefined}
                    >
                      <BatchYearSelector
                        batchYears={hierarchy?.batchYears ?? []}
                        selected={selectedBatchYears}
                        onToggle={handleBatchYearToggle}
                      />
                    </CollapsibleSection>

                    {/* Sections */}
                    <CollapsibleSection
                      title="Sections"
                      icon={Layers}
                      badge={selectedSections.length > 0 ? selectedSections.length : undefined}
                    >
                      <CheckboxList
                        items={filteredSections}
                        selectedIds={selectedSections}
                        onToggle={handleSectionToggle}
                        labelKey="sectionName"
                        codeKey="sectionCode"
                        emptyMessage="No sections available"
                      />
                    </CollapsibleSection>

                    {/* Info when no filters applied */}
                    {selectedSchools.length === 0 && selectedDepts.length === 0 &&
                     selectedPrograms.length === 0 && selectedBatchYears.length === 0 &&
                     selectedSections.length === 0 && (
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

      {/* ── Save / Reset Bar ──────────────────────────────────────── */}
      {hasChanges && (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between px-5 py-3 bg-sgt-600 rounded-lg shadow-lg">
            <div className="flex items-center gap-2 text-white">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">You have unsaved changes</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-white text-sgt-700 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventSettings;
