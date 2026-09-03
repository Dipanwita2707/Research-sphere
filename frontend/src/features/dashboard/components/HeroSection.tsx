'use client';

import { useState, useEffect } from 'react';

interface HeroSectionProps {
  userName: string;
  userType: string;
  userImage?: string;
}

export default function HeroSection({ userName, userType }: HeroSectionProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getEmoji = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const getUserInitials = () =>
    userName.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-wine to-[#4A0F26] flex items-center justify-center shadow-lg shadow-wine/20">
            <span className="text-sm font-bold text-white tracking-wide">{getUserInitials()}</span>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-0.5">
            {getGreeting()} &bull; {getEmoji()}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight truncate tracking-tight">
            {userName}
          </h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
            {userType} &middot;{' '}
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 px-3 py-1.5 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          Active &bull; {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </span>
    </div>
  );
}