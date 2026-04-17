/**
 * Online Status Component
 * Shows online/offline indicator
 */
'use client';

import React from 'react';
import { useIsOnline } from '../store/chatStore';

interface OnlineStatusProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function OnlineStatus({ userId, size = 'md', showLabel = false }: OnlineStatusProps) {
  const isOnline = useIsOnline(userId);

  const sizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const positionClasses = {
    sm: '-bottom-0 -right-0',
    md: '-bottom-0.5 -right-0.5',
    lg: '-bottom-1 -right-1',
  };

  return (
    <>
      <span
        className={`absolute ${positionClasses[size]} ${sizeClasses[size]} rounded-full border-2 border-white dark:border-gray-800 ${
          isOnline ? 'bg-green-500' : 'bg-gray-400'
        }`}
      />
      {showLabel && (
        <span className={`text-xs ${isOnline ? 'text-green-500' : 'text-gray-500'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </>
  );
}
