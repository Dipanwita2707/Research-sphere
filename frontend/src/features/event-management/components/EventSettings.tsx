'use client';

import React, { useState, useCallback } from 'react';
import {
  Power, EyeOff, Check, Loader2, AlertTriangle, Shield,
} from 'lucide-react';
import {
  useEventSettings,
  useUpdateEventSettings,
  useToggleEventActive,
} from '../hooks/useEventSettings';
import type {
  EventVisibilityUpdate,
} from '../types/eventSettings.types';
import { EventSettingsForm, ToggleSwitch } from './EventSettingsForm';
import type { EventVisibilityFormData } from './EventSettingsForm';

// ── Design System ────────────────────────────────────────────────
const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-[#b3cde0] dark:border-ev-700 shadow-ev';

// ── Main EventSettings Component ─────────────────────────────────
interface EventSettingsProps {
  eventId: string;
  onToast: (opts: { type: 'success' | 'error'; message: string }) => void;
  /** When true, all settings except Registration Status are locked (event created via approved noting) */
  isFromNoting?: boolean;
}

const EventSettings: React.FC<EventSettingsProps> = ({ eventId, onToast, isFromNoting = false }) => {
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useEventSettings(eventId);
  const updateMutation = useUpdateEventSettings(eventId);
  const toggleMutation = useToggleEventActive(eventId);

  // Local form state (synced from server, tracked for changes)
  const [localFormData, setLocalFormData] = useState<EventVisibilityFormData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Effective form data: local overrides server
  const formData: EventVisibilityFormData = localFormData ?? {
    visibleToRoles: settings?.visibleToRoles ?? [],
    studentFilterType: settings?.studentFilterType ?? 'all',
    allowedSchoolIds: settings?.allowedSchoolIds ?? [],
    allowedDepartmentIds: settings?.allowedDepartmentIds ?? [],
    allowedProgramIds: settings?.allowedProgramIds ?? [],
    allowedBatchYears: settings?.allowedBatchYears ?? [],
    allowedSectionIds: settings?.allowedSectionIds ?? [],
    allowExtraPasses: settings?.allowExtraPasses ?? false,
    maxExtraPassesPerUser: settings?.maxExtraPassesPerUser ?? 0,
  };

  // ── Handlers ─────────────────────────────────────────────────
  const handleFormChange = useCallback((newData: EventVisibilityFormData) => {
    setLocalFormData(newData);
    setHasChanges(true);
  }, []);

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

  const handleSave = useCallback(async () => {
    const payload: EventVisibilityUpdate = {
      ...formData,
      maxExtraPassesPerUser: formData.allowExtraPasses ? Math.max(1, formData.maxExtraPassesPerUser) : 0,
    };

    try {
      await updateMutation.mutateAsync(payload);
      setHasChanges(false);
      setLocalFormData(null);
      onToast({ type: 'success', message: 'Event settings saved successfully' });
    } catch (err: any) {
      onToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save event settings' });
    }
  }, [formData, updateMutation, onToast]);

  const handleReset = useCallback(() => {
    setLocalFormData(null);
    setHasChanges(false);
  }, []);

  // ── Loading / Error States ─────────────────────────────────────
  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-ev-700" />
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
      {/* Noting-locked banner */}
      {isFromNoting && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Settings Locked by Noting Approval</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              This event was created through an approved noting. All settings except Registration Status are read-only.
            </p>
          </div>
        </div>
      )}
      {/* ── Registration Open/Close Toggle ───────────────────────── */}
      <div className={`${CARD} overflow-hidden`}>
        <div className={`px-5 py-4 flex items-center justify-between ${isActive ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10' : 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              <Power className={`w-6 h-6 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ev-900 dark:text-white">
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
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-ev-100 text-ev-800 dark:bg-ev-900/30 dark:text-ev-400">
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

      {/* ── Settings Form (Extra Pass, Visibility, Student Filters) ── */}
      <EventSettingsForm data={formData} onChange={handleFormChange} disabled={isFromNoting} />

      {/* ── Save / Reset Bar ──────────────────────────────────────── */}
      {hasChanges && !isFromNoting && (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between px-5 py-3 bg-ev-700 rounded-lg shadow-lg">
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
                className="inline-flex items-center gap-2 px-5 py-2 bg-white text-ev-800 text-sm font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
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
