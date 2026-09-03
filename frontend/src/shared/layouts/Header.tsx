'use client';

import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter } from 'next/navigation';
import { LogOut, User, Settings, Bell, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationService } from '@/shared/services/notification.service';
import logger from '@/shared/utils/logger';
import Wordmark from '@/shared/components/brand/Wordmark';

interface HeaderProps {
  onMobileMenuClick?: () => void;
}

export default function Header({ onMobileMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      logger.error('Failed to fetch notification count:', error);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user?.firstName) return user.firstName.substring(0, 2).toUpperCase();
    return user?.username?.substring(0, 2).toUpperCase() || 'U';
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 h-14"
      style={{ 
        background: 'linear-gradient(90deg, #232323 0%, #4A0F26 100%)',
        boxShadow: '0 2px 12px rgba(132,28,67,0.18)'
      }}
    >
      <div className="h-full px-2 sm:px-4 flex items-center justify-between">
        {/* Left: Wordmark */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="flex items-center">
            <Wordmark sizeClassName="text-lg" researchColor="white" sphereColor="amber" />
          </div>
        </div>

        {/* Right: Notifications + User Profile */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {/* Notifications Bell - White on dark like LMS */}
          <button 
            onClick={() => router.push('/notifications')}
            className="relative p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white px-0.5 sm:px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Avatar - Colored circle like LMS */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1 sm:gap-2 p-0.5 sm:p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold shadow-md border-2 border-white/30">
                {getUserInitials()}
              </div>
              <ChevronDown className={`w-4 h-4 text-white/70 transition-transform duration-200 hidden sm:block ${showMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl py-1 z-50 border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* User Info Header */}
                <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <p className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate">
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user?.email}</p>
                </div>
                
                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => { router.push('/profile'); setShowMenu(false); }}
                    className="flex items-center w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-gray-400 dark:text-gray-500" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { router.push('/settings'); setShowMenu(false); }}
                    className="flex items-center w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-3 text-gray-400 dark:text-gray-500" />
                    Settings
                  </button>
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-3" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
