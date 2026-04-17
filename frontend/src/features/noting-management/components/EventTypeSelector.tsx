'use client';

import React from 'react';

export type NotingEventType = 'venue' | 'stall' | 'festival';

interface EventTypeSelectorProps {
  value: NotingEventType | null;
  onChange: (type: NotingEventType) => void;
  disabled?: boolean;
}

const EVENT_TYPES: { id: NotingEventType; label: string; icon: string; tooltip: string }[] = [
  { id: 'venue',    label: 'Venue Event',       icon: '🏛️', tooltip: 'Standalone event — no stalls, no fest' },
  { id: 'stall',    label: 'Stall-Based Event', icon: '🪄', tooltip: 'Event type where stalls can be added inside' },
  { id: 'festival', label: 'Fest',               icon: '🎪', tooltip: 'Fest that contains multiple events (stall + venue), based on creator' },
];

export const EventTypeSelector: React.FC<EventTypeSelectorProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
        Event Structure <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        {EVENT_TYPES.map((type) => {
          const isSelected = value ===
   type.id;
          return (
            <button
              key={type.id}
              type="button"
              disabled={disabled}
              title={type.tooltip}
              onClick={() => !disabled && onChange(type.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium
                transition-colors duration-100
                ${isSelected
                  ? 'border-sgt-500 bg-sgt-50 dark:bg-sgt-900/20 text-sgt-700 dark:text-sgt-300'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-sgt-300 hover:text-sgt-600'
                }
                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className="text-sm leading-none">{type.icon}</span>
              {type.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
