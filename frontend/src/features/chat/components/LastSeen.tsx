/**
 * Last Seen Component
 * Shows last seen time for users
 */
'use client';

import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useIsOnline } from '../store/chatStore';
import * as chatService from '../services/chat.service';

interface LastSeenProps {
  userId: string;
  className?: string;
}

export function LastSeen({ userId, className = '' }: LastSeenProps) {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isOnline = useIsOnline(userId);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await chatService.getUserStatus(userId);
        if (status.lastSeenVisible && status.lastSeenAt) {
          setLastSeen(status.lastSeenAt);
        }
      } catch (error) {
        console.error('Failed to fetch user status:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!isOnline) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [userId, isOnline]);

  if (loading) {
    return (
      <span className={`text-xs text-gray-500 dark:text-gray-400 ${className}`}>
        ...
      </span>
    );
  }

  if (isOnline) {
    return (
      <span className={`text-xs text-green-500 ${className}`}>
        Online
      </span>
    );
  }

  if (lastSeen) {
    return (
      <span className={`text-xs text-gray-500 dark:text-gray-400 ${className}`}>
        Last seen {formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}
      </span>
    );
  }

  return (
    <span className={`text-xs text-gray-500 dark:text-gray-400 ${className}`}>
      Offline
    </span>
  );
}
