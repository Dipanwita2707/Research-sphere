'use client';

import React from 'react';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

export interface CreatorStall {
  name: string;
  description: string;
  capacity: number;
}

export interface StallConfig {
  enableStudentApplied: boolean;
  maxStudentStalls?: number;
  stallFee?: number;
  applicationDeadline?: string;
  enableCreatorMade: boolean;
  creatorStalls: CreatorStall[];
}

export const defaultStallConfig: StallConfig = {
  enableStudentApplied: false,
  maxStudentStalls: 20,
  stallFee: 0,
  enableCreatorMade: false,
  creatorStalls: [],
};

interface StallConfigSectionProps {
  config: StallConfig;
  onChange: (config: StallConfig) => void;
  disabled?: boolean;
}

export const StallConfigSection: React.FC<StallConfigSectionProps> = ({ config, onChange, disabled }) => {
  return (
    <section className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Stall Configuration</h3>

      {/* Student-Applied Stalls */}
      <div className="mb-5">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={disabled}
            checked={config.enableStudentApplied}
            onChange={(e) => onChange({ ...config, enableStudentApplied: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Student-Applied Stalls</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 mt-1">
          Students can apply for stalls — you will approve/reject each application.
        </p>

        {config.enableStudentApplied && (
          <div className="ml-7 mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Max Student Stalls
              </label>
              <input
                type="number"
                min={1}
                disabled={disabled}
                value={config.maxStudentStalls || ''}
                onChange={(e) => onChange({ ...config, maxStudentStalls: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. 20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Stall Fee (₹)
              </label>
              <input
                type="number"
                min={0}
                disabled={disabled}
                value={config.stallFee ?? ''}
                onChange={(e) => onChange({ ...config, stallFee: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Application Deadline
              </label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                  disabled={disabled}
                  value={config.applicationDeadline ? dayjs(config.applicationDeadline) : null}
                  onChange={(val) => onChange({ ...config, applicationDeadline: val ? val.toISOString() : '' })}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          '& fieldset': { borderColor: 'rgb(229 231 235)' },
                          '&:hover fieldset': { borderColor: 'rgb(156 163 175)' },
                          '&.Mui-focused fieldset': { borderColor: 'rgb(99 102 241)', borderWidth: '2px' },
                        },
                        '& .MuiInputBase-input': { padding: '0.5rem 0.75rem', color: 'inherit' },
                      },
                    },
                  }}
                />
              </LocalizationProvider>
            </div>
          </div>
        )}
      </div>

      {/* Event Main Stall — always shown */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
        <span className="text-base">✅</span>
        <span className="font-medium">Event Main Stall</span>
        <span className="text-blue-500 dark:text-blue-400 text-xs">— auto-created on approval</span>
      </div>
    </section>
  );
};
