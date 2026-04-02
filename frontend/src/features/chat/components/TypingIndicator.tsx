/**
 * Typing Indicator Component
 */
'use client';

import React from 'react';
import type { TypingUser } from '../types';

interface TypingIndicatorProps {
  users: TypingUser[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length ===
   0) return null;

  const getTypingText = () => {
    if (users.length ===
   1) {
      const name = users[0].user?.firstName || 'Someone';
      return `${name} is typing`;
    }
    if (users.length ===
   2) {
      const names = users.map(u => u.user?.firstName || 'Someone');
      return `${names[0]} and ${names[1]} are typing`;
    }
    return `${users.length} people are typing`;
  };

  return (
    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm py-2">
      {/* Animated dots */}
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}
