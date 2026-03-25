'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Bell, ChevronDown, Search, Sun, Moon, Menu, X } from 'lucide-react';
import { notificationService } from '@/shared/services/notification.service';
import { useTheme } from '@/shared/providers/ThemeProvider';
import api from '@/shared/api/api';
import Link from 'next/link';
import logger from '@/shared/utils/logger';
import { useNotingPermissions } from '@/features/noting-management/hooks/useNoting';
import { useMyClubs } from '@/features/dsw/hooks';
import { hasPermission, hasDrdPermissions, hasFinancePermissions, hasAnalyticsPermissions } from './nav/permissions';
import { useMenuItems } from './nav/useMenuItems';
import { NavDropdown } from './nav/NavDropdown';
import { MobileMenu } from './nav/MobileMenu';
import { NavPermissions } from './nav/types';

export default function NavigationHeader() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userPermissions, setUserPermissions] = useState<{ category: string; permissions: string[] }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; href?: string; description?: string }>>([]);
  const [hasVolunteerAssignments, setHasVolunteerAssignments] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const isStudent = user?.role?.name === 'student' || user?.userType === 'student';
  const isFaculty = user?.role?.name === 'faculty' || user?.userType === 'faculty';
  const isStaff = user?.role?.name === 'staff' || user?.userType === 'staff';
  const isAdmin = user?.role?.name === 'admin' || user?.userType === 'admin';

  const { data: notingPermsData } = useNotingPermissions({ enabled: !!isStudent });
  const { data: myClubsData } = useMyClubs();
  const isClubChairperson = !!(notingPermsData?.isClubChairperson) ||
    !!(isStudent && user?.id && myClubsData?.data?.some((c: { chairpersonId: string; status: string }) => c.chairpersonId === user.id && c.status === 'active'));

  const userDesignation = (user?.employee?.designation || user?.employeeDetails?.designation?.name || '').toLowerCase();
  const isGuard = userDesignation.includes('guard') || userDesignation.includes('security');
  const hasFullGateEntryAccess = isAdmin || isGuard || isStaff;

  const perms: NavPermissions = {
    userPermissions,
    isStudent, isFaculty, isStaff, isAdmin, isGuard, hasFullGateEntryAccess,
    canFileIpr: isFaculty || isStudent || isAdmin || hasPermission(userPermissions, 'ipr_file_new'),
    canFileResearch: isFaculty || isStudent || isAdmin || hasPermission(userPermissions, 'research_file_new'),
    hasDrdAccess: hasDrdPermissions(userPermissions) || isAdmin,
    hasFinanceAccess: hasFinancePermissions(userPermissions),
    hasReviewAccess: false, // computed below
    canReviewIpr: hasPermission(userPermissions, 'ipr_review') || hasPermission(userPermissions, 'review_ipr'),
    canApproveIpr: hasPermission(userPermissions, 'ipr_approve') || hasPermission(userPermissions, 'approve_ipr'),
    canReviewResearch: hasPermission(userPermissions, 'research_review') || hasPermission(userPermissions, 'research_paper_review'),
    canApproveResearch: hasPermission(userPermissions, 'research_approve') || hasPermission(userPermissions, 'research_paper_approve'),
    canReviewBook: hasPermission(userPermissions, 'book_review') || hasPermission(userPermissions, 'book_chapter_review'),
    canApproveBook: hasPermission(userPermissions, 'book_approve') || hasPermission(userPermissions, 'book_chapter_approve'),
    canReviewConference: hasPermission(userPermissions, 'conference_review') || hasPermission(userPermissions, 'conference_paper_review'),
    canApproveConference: hasPermission(userPermissions, 'conference_approve') || hasPermission(userPermissions, 'conference_paper_approve'),
    canReviewGrant: hasPermission(userPermissions, 'grant_review'),
    canApproveGrant: hasPermission(userPermissions, 'grant_approve'),
    hasAnalyticsAccess: hasAnalyticsPermissions(userPermissions) || isAdmin,
    isClubChairperson,
    hasVolunteerAssignments,
  };
  perms.hasReviewAccess = perms.hasDrdAccess || perms.canReviewIpr || perms.canApproveIpr ||
    perms.canReviewResearch || perms.canApproveResearch || perms.canReviewBook || perms.canApproveBook ||
    perms.canReviewConference || perms.canApproveConference || perms.canReviewGrant || perms.canApproveGrant || perms.hasFinanceAccess;

  const menuItems = useMenuItems(perms, hasVolunteerAssignments);

  const fetchUnreadCount = useCallback(async () => {
    try { setUnreadCount(await notificationService.getUnreadCount()); } catch (e) { logger.error('Failed to fetch notification count:', e); }
  }, []);

  useEffect(() => {
    if (!user) return;
    const defer = (fn: () => void) => typeof requestIdleCallback !== 'undefined' ? requestIdleCallback(() => fn(), { timeout: 100 }) : setTimeout(fn, 0);
    defer(() => fetchUnreadCount());
    defer(async () => {
      try {
        const res = await api.get('/dashboard/staff');
        if (res.data.success) setUserPermissions(res.data.data.permissions || []);
      } catch (e) { logger.error('Error fetching permissions:', e); }
    });
    defer(async () => {
      try {
        const res = await api.get('/events/volunteers/my');
        if (Array.isArray(res.data?.data) && res.data.data.length > 0) setHasVolunteerAssignments(true);
      } catch (e) { logger.error('Error fetching volunteer flag:', e); }
    });
  }, [user, fetchUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
      const inside = Object.values(dropdownRefs.current).some(ref => ref?.contains(e.target as Node));
      if (!inside) setActiveDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!searchQuery.trim()) { setSearchResults([]); return; }
      const results: typeof searchResults = [];
      const q = searchQuery.toLowerCase();
      const search = (items: typeof searchResults) => items.forEach(i => {
        if (i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)) results.push(i);
      });
      menuItems.forEach(m => m.subItems && search(m.subItems as typeof searchResults));
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, menuItems]);

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    if (user?.firstName) return user.firstName.substring(0, 2).toUpperCase();
    return user?.username?.substring(0, 2).toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
    if (user?.firstName) return user.firstName;
    return user?.employee?.displayName || user?.role?.displayName || user?.username || 'User';
  };

  const handleLogout = async () => { await logout(); router.push('/login'); };

  return (
    <header className="fixed top-0 left-0 right-0 z-50" style={{ background: 'linear-gradient(135deg, #005b96 0%, #004a80 50%, #003d6b 100%)', boxShadow: '0 4px 20px rgba(0,91,150,0.15)' }}>
      <div className="h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        {/* Mobile toggle */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-colors" aria-label="Toggle menu">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity flex-shrink-0" onClick={() => setMobileMenuOpen(false)}>
          <img src="/images/new-header-logo.png" alt="SGT University" className="h-10 sm:h-12 object-contain brightness-0 invert" />
          <div className="hidden sm:block">
            <div className="text-white font-bold text-xs sm:text-sm leading-tight">UNIVERSITY</div>
            <div className="text-white/70 text-[10px] sm:text-xs leading-tight">MANAGEMENT SYSTEM</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-2 flex-1 justify-center">
          <Link href="/dashboard" className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${pathname === '/dashboard' ? 'bg-white/20 text-white shadow-lg' : 'text-white/90 hover:bg-white/15 hover:text-white'}`}>
            Dashboard
          </Link>
          {menuItems.map(item => (
            <div key={item.name} className="relative" ref={el => { dropdownRefs.current[item.name] = el; }}>
              <button
                onClick={() => setActiveDropdown(activeDropdown === item.name ? null : item.name)}
                onMouseEnter={() => setActiveDropdown(item.name)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${activeDropdown === item.name ? 'bg-white/20 text-white shadow-lg' : 'text-white/90 hover:bg-white/15 hover:text-white'}`}
              >
                {item.name}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === item.name ? 'rotate-180' : ''}`} />
              </button>
              {activeDropdown === item.name && item.subItems && (
                <NavDropdown item={item} onClose={() => setActiveDropdown(null)} />
              )}
            </div>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button onClick={() => setShowSearch(!showSearch)} className="p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-all duration-200">
              <Search className="w-5 h-5" />
            </button>
            {showSearch && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                <div className="p-3 border-b border-gray-200">
                  <div className="relative">
                    <input type="text" placeholder="Search menu items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-4 py-2 pl-10 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" autoFocus />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {searchQuery && searchResults.length === 0 && <div className="p-6 text-center text-gray-500 text-sm">No results found for &quot;{searchQuery}&quot;</div>}
                  {searchResults.map((r, i) => r.href ? (
                    <Link key={i} href={r.href} onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="block px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors">
                      <div className="text-sm font-medium text-gray-900">{r.name}</div>
                      {r.description && <div className="text-xs text-gray-500 mt-0.5">{r.description}</div>}
                    </Link>
                  ) : (
                    <div key={i} className="px-4 py-3 border-b border-gray-100 last:border-0 opacity-60">
                      <div className="text-sm font-medium text-gray-400">{r.name}</div>
                    </div>
                  ))}
                  {!searchQuery && <div className="p-6 text-center text-gray-500 text-sm">Type to search menu items...</div>}
                </div>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="relative">
            <button onClick={() => setActiveDropdown(activeDropdown === 'quicklinks' ? null : 'quicklinks')} onMouseEnter={() => setActiveDropdown('quicklinks')} className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <span className="text-sm font-medium hidden lg:block">Quick Links</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'quicklinks' ? 'rotate-180' : ''}`} />
            </button>
            {activeDropdown === 'quicklinks' && (
              <div className="absolute top-full right-0 mt-2 w-64 shadow-2xl border-t border-gray-200 z-50 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }} onMouseLeave={() => setActiveDropdown(null)}>
                <div className="py-2">
                  {[
                    { label: '🎓 LMS', href: 'http://13.235.188.79', external: true },
                    { label: '📝 File Research', href: '/research/apply' },
                    { label: '💡 File IPR', href: '/ipr/apply' },
                    { label: '📊 My Submissions', href: '/my-work' },
                    { label: '🌐 University Website', href: 'https://sgtuniversity.ac.in', external: true },
                    { label: '📰 SGT Times', href: 'https://sgttimes.com', external: true },
                  ].map(l => (
                    <Link key={l.href} href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : { onClick: () => setActiveDropdown(null) })} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#005b96]/10 transition-colors">
                      <span className="text-sm font-semibold text-[#005b96]">{l.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme} className="p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-all duration-200">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <button onClick={() => router.push('/notifications')} className="relative p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-all duration-200">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-lg">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-1.5 pr-3 hover:bg-white/15 rounded-lg transition-all duration-200">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold shadow-lg border-2 border-white/30">{getUserInitials()}</div>
              <span className="text-white text-sm font-medium hidden lg:block">{getUserDisplayName()}</span>
              <ChevronDown className={`w-4 h-4 text-white/80 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                  <p className="text-sm font-semibold text-gray-900">{getUserDisplayName()}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{user?.email}</p>
                </div>
                <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-gray-700 text-sm transition-colors" onClick={() => setShowUserMenu(false)}>
                  <User className="w-4 h-4" /> Profile Settings
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-red-600 text-sm transition-colors">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <MobileMenu
          menuItems={menuItems}
          unreadCount={unreadCount}
          pathname={pathname}
          onClose={() => setMobileMenuOpen(false)}
          onLogout={handleLogout}
        />
      )}
    </header>
  );
}
