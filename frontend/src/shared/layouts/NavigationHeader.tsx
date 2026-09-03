'use client';

import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Bell, ChevronDown, Search, Sun, Moon, HelpCircle, Menu, X, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/shared/providers/ThemeProvider';
 import Link from 'next/link';
import {
  useHasVolunteerAssignments,
  useStaffDashboardSummary,
  useUnreadNotificationCount,
} from '@/shared/hooks/useUserContextQueries';
import Wordmark from '@/shared/components/brand/Wordmark';

interface DepartmentPermission {
  category: string;
  permissions: string[];
}

interface SubMenuItem {
  name: string;
  href?: string;
  description?: string;
  prefetch?: boolean;
  children?: SubMenuItem[];
}

interface MenuItem {
  name: string;
  subItems?: SubMenuItem[];
}

const hasPermission = (permissions: DepartmentPermission[], permissionName: string): boolean => {
  const variants = [permissionName, `drd_${permissionName}`, permissionName.replace('drd_', '')];
  for (const dept of permissions) {
    if (dept.permissions.some(p => variants.some(v => p.toLowerCase().includes(v.toLowerCase())))) return true;
  }
  return false;
};

const hasDrdPermissions = (permissions: DepartmentPermission[]): boolean => {
  if (!permissions || permissions.length ===
   0) return false;

  const drdKeys = [
    'ipr_review', 'ipr_approve', 'ipr_assign_school', 'ipr_recommend',
    'research_review', 'research_approve', 'research_assign_school',
    'book_review', 'book_approve', 'book_assign_school',
    'applicant_analytics', 'drd_member_analytics',
    'ipr_applicant_analytics', 'research_applicant_analytics', 'book_applicant_analytics',
    'conference_applicant_analytics', 'grant_applicant_analytics',
    'drd_review', 'drd_approve', 'drd_recommend', 'drd_view_all',
    'view_all_ipr', 'review_ipr', 'approve_ipr', 'ipr'
  ];

  for (const dept of permissions) {
    const category = dept.category?.toLowerCase() || '';
    if (category.includes('drd') || category.includes('research') || category.includes('development') || category.includes('book')) {
      return true;
    }
    for (const perm of dept.permissions || []) {
      const permLower = perm.toLowerCase();
      if (drdKeys.some(k => permLower.includes(k.toLowerCase()))) {
        return true;
      }
    }
  }
  return false;
};

const hasFinancePermissions = (permissions: DepartmentPermission[]): boolean => {
  const keys = ['configure_fee_structure', 'print_loan_letter', 'finance_analytics', 'finance', 'incentive', 'payment'];
  for (const dept of permissions) {
    if (dept.permissions.some(p => keys.some(k => p.toLowerCase().includes(k)))) return true;
  }
  return false;
};

export default function NavigationHeader() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [activeSubmenu2, setActiveSubmenu2] = useState<string | null>(null); // Third level submenu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedMenu, setMobileExpandedMenu] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [mobileExpandedSubmenu, setMobileExpandedSubmenu] = useState<string | null>(null);
  const [activeSubmenu3, setActiveSubmenu3] = useState<string | null>(null); // Fourth level submenu
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string, href?: string, description?: string, prefetch?: boolean }>>([]);
  const [expandedMobileSection, setExpandedMobileSection] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const roleName = user?.role?.name || user?.userType || '';
  const isStudent = roleName ===
   'student';
  const isFaculty = roleName ===
   'faculty';
  const isStaff = roleName ===
   'staff';
  const isAdmin = roleName === 'admin' || roleName === 'superadmin';
  const isSuperadmin = roleName === 'superadmin';

  // PERF FIX: Use TanStack Query hook
  const { data: unreadCount = 0 } = useUnreadNotificationCount({ enabled: !!user });
  const { data: staffDashboardData, isLoading: isNavLoading } = useStaffDashboardSummary({ enabled: !!user });
  const { data: hasVolunteerAssignments = false } = useHasVolunteerAssignments({ enabled: !!user });
  const userPermissions = staffDashboardData?.permissions || [];

  const canFileIpr = isFaculty || isStudent || isAdmin || hasPermission(userPermissions, 'ipr_file_new');
  const canFileResearch = isFaculty || isStudent || isAdmin || hasPermission(userPermissions, 'research_file_new');
  const hasDrdAccess = hasDrdPermissions(userPermissions) || isAdmin;
  const hasFinanceAccess = hasFinancePermissions(userPermissions);

  const analyticsKeys = [
    'applicant_analytics', 'drd_member_analytics',
    'ipr_applicant_analytics', 'research_applicant_analytics',
    'book_applicant_analytics', 'conference_applicant_analytics',
    'grant_applicant_analytics',
  ];
  const hasAnalyticsAccess = isAdmin || userPermissions.some(dept =>
    (dept.permissions || []).some(p => analyticsKeys.some(k => p.toLowerCase().includes(k)))
  );

  // Review and Approval permissions
  const canReviewIpr = hasPermission(userPermissions, 'ipr_review') || hasPermission(userPermissions, 'review_ipr');
  const canApproveIpr = hasPermission(userPermissions, 'ipr_approve') || hasPermission(userPermissions, 'approve_ipr');
  const canReviewResearch = hasPermission(userPermissions, 'research_review') || hasPermission(userPermissions, 'research_paper_review');
  const canApproveResearch = hasPermission(userPermissions, 'research_approve') || hasPermission(userPermissions, 'research_paper_approve');
  const canReviewBook = hasPermission(userPermissions, 'book_review') || hasPermission(userPermissions, 'book_chapter_review');
  const canApproveBook = hasPermission(userPermissions, 'book_approve') || hasPermission(userPermissions, 'book_chapter_approve');
  const canReviewConference = hasPermission(userPermissions, 'conference_review') || hasPermission(userPermissions, 'conference_paper_review');
  const canApproveConference = hasPermission(userPermissions, 'conference_approve') || hasPermission(userPermissions, 'conference_paper_approve');
  const canReviewGrant = hasPermission(userPermissions, 'grant_review');
  const canApproveGrant = hasPermission(userPermissions, 'grant_approve');

  // fetchNotingAccess removed — now handled by useNotingPermissions hook above

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }

      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }

      // Check all dropdown refs
      const clickedInsideDropdown = Object.values(dropdownRefs.current).some(
        ref => ref && ref.contains(event.target as Node)
      );

      if (!clickedInsideDropdown) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Close mobile nav on route change so the drawer cannot linger over page content
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileExpandedMenu(null);
    setMobileExpandedSubmenu(null);
    setExpandedMobileSection(null);
  }, [pathname]);

  // Search through all menu items
  const searchMenuItems = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results: Array<{ name: string, href?: string, description?: string, prefetch?: boolean }> = [];
    const searchLower = query.toLowerCase();

    const searchInSubmenu = (items: SubMenuItem[]) => {
      items.forEach(item => {
        if (item.name.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower)) {
          results.push({
            name: item.name,
            href: item.href,
            description: item.description,
            prefetch: item.prefetch,
          });
        }
        if (item.children) {
          searchInSubmenu(item.children);
        }
      });
    };

    menuItems.forEach(menu => {
      if (menu.subItems) {
        searchInSubmenu(menu.subItems);
      }
    });

    setSearchResults(results);
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchMenuItems(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

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

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) return user.firstName;
    if (user?.employee?.displayName) return user.employee.displayName;
    if (user?.role?.displayName) return user.role.displayName;
    return user?.username || 'User';
  };

  const getLinkPrefetch = (href?: string, prefetch?: boolean) =>
    href?.startsWith('/') ? prefetch : undefined;

  const currentPath = pathname ?? '';

  // Build menu items based on permissions
  const menuItems: MenuItem[] = [];

  // =====================================
    // Build Submit & Track children - SIMPLIFIED 3 OPTIONS
  // 1. Monthly Progress Tracker
  // 2. My Research (view all submitted work)
  // 3. New Filing (file new work)
  // =====================================
    // Build Submit & Track children - 2 OPTIONS
  // 1. My Research (view all submitted work)
  // 2. New Filing (file new work)
  // =====================================
    const myResearchChildren: SubMenuItem[] = [
      { name: 'All Submissions', href: '/my-work', description: 'View all submissions at once' },
      ...(canFileResearch ? [{ name: 'Research Papers, Books, Chapters & Conference Papers', href: '/research/my-contributions', description: 'View research papers' }] : []),
      ...(canFileIpr ? [{ name: 'Patents / IPR', href: '/ipr/my-applications', description: 'View patent applications' }] : []),
    ];

    const submitTrackChildren: SubMenuItem[] = [
    // Option 3: New Filing - File new work (with sub-options)
    {
      name: 'New Filing',
      description: 'Submit new research work',
      children: [
        ...(canFileResearch ? [{ name: 'Research Paper', href: '/research/apply', description: 'Submit new research paper' }] : []),
        ...(canFileIpr ? [{ name: 'Patent / IPR', href: '/ipr/apply', description: 'File new patent or IPR' }] : []),
        { name: 'Book / Chapter', href: '/research/apply?type=book', description: 'Submit book or chapter' },
        { name: 'Conference Paper', href: '/research/apply?type=conference_paper', description: 'Submit conference paper' },
        { name: 'Grant Proposal', href: '/research/apply-grant', description: 'Apply for research grant' },
      ],
    },
  ];

  // Faculty Only - Mentor Approvals (add as 4th option)
  if (isFaculty) {
    submitTrackChildren.push({ name: 'Mentor Approvals', href: '/mentor-approvals', description: 'Review & approve student work' });
  }

  // =====================================
  // Build Review & Approval children - ORGANIZED
  // =====================================
  const reviewApprovalChildren: SubMenuItem[] = [];
  
  // Only show DRD Dashboard if user has any actual review/approve permissions
  const hasAnyReviewPermission = canReviewIpr || canApproveIpr || canReviewResearch || 
    canApproveResearch || canReviewBook || canApproveBook || canReviewConference || 
    canApproveConference || canReviewGrant || canApproveGrant;
  
  if (hasAnyReviewPermission && hasDrdAccess) {
    reviewApprovalChildren.push({ name: 'DRD Dashboard', href: '/drd', description: 'Research & Development overview' });
  }
  if (canReviewIpr || canApproveIpr) {
    reviewApprovalChildren.push({ name: 'Review Patents/IPR', href: '/drd/review', description: 'Pending patent applications' });
  }
  if (canReviewResearch || canApproveResearch) {
    reviewApprovalChildren.push({ name: 'Review Research Papers', href: '/drd/research?type=research', description: 'Pending research papers' });
  }
  if (canReviewBook || canApproveBook) {
    reviewApprovalChildren.push({ name: 'Review Books/Chapters', href: '/drd/research?type=book', description: 'Pending book submissions' });
  }
  if (canReviewConference || canApproveConference) {
    reviewApprovalChildren.push({ name: 'Review Conference Papers', href: '/drd/research?type=conference', description: 'Pending conference papers' });
  }
  if (canReviewGrant || canApproveGrant) {
    reviewApprovalChildren.push({ name: 'Review Grant Proposals', href: '/drd/research?type=grant_proposal', description: 'Pending grant applications' });
  }
  if (hasFinanceAccess) {
    reviewApprovalChildren.push({ name: 'Finance & Payments', href: '/finance/processing', description: 'Manage incentive payments' });
  }
  
  const hasReviewAccess = reviewApprovalChildren.length > 0;

  // =====================================
    // Build Research and Development sub-items
  // =====================================
    const rndSubItems: SubMenuItem[] = [];

  if (canFileIpr || canFileResearch) {
    rndSubItems.push({
      name: 'My Research',
      description: 'View all your submitted work',
      children: myResearchChildren,
    });
    rndSubItems.push({
      name: 'My Research Profile',
      href: '/research/my-profile',
      description: 'Open your research profile and manage sync settings',
    });
  }

  if (canFileIpr || canFileResearch) {
    rndSubItems.push({
      name: 'Submit & Track',
      description: 'File new work & view submissions',
      children: submitTrackChildren,
    });
  }

  // Add Monthly Progress Tracker as a separate option
  rndSubItems.push({
    name: 'Monthly Progress Tracker',
    href: '/research/progress-tracker',
    description: 'Track monthly research milestones',
  });

  if (hasReviewAccess && reviewApprovalChildren.length > 0) {
    rndSubItems.push({
      name: 'Review & Approve',
      description: 'Pending items for review',
      children: reviewApprovalChildren,
    });
  }

  // Analytics section — show for admins, users with analytics perms, or DRD reviewers
  if (hasAnalyticsAccess || hasDrdAccess) {
    rndSubItems.push({
      name: 'Analytics',
      description: 'Research & IPR analytics dashboards',
      children: [
        { name: 'Overview', href: '/drd/analytics/overview', description: 'High-level KPIs & trends' },
        { name: 'Applicant Analytics', href: '/drd/analytics/applicant', description: 'Submission trends by school & department' },
        { name: 'DRD Member Performance', href: '/drd/analytics/drd-member', description: 'Review turnaround & workload' },
      ],
    });
  }

  // Admin Only - R&D Configuration and Incentive Policies
  if (isAdmin) {
    rndSubItems.push({
      name: 'R&D Configuration',
      description: 'School assignments & routing',
      children: [
        { name: 'IPR Routing', href: '/admin/drd-school-assignment', description: 'Route IPR to schools' },
        { name: 'Research Routing', href: '/admin/research-school-assignment', description: 'Route research to schools' },
        { name: 'Book Routing', href: '/admin/book-school-assignment', description: 'Route books to schools' },
        { name: 'Conference Routing', href: '/admin/conference-school-assignment', description: 'Route conferences' },
        { name: 'Grant Routing', href: '/admin/grant-school-assignment', description: 'Route grants' },
      ],
    });

    rndSubItems.push({
      name: 'Incentive Policies',
      description: 'Configure payment policies',
      children: [
        { name: 'Patent/IPR Incentives', href: '/admin/incentive-policies', description: 'IPR payment rules' },
        { name: 'Research Incentives', href: '/admin/research-policies', description: 'Research payment rules' },
        { name: 'Book Incentives', href: '/admin/book-policies', description: 'Book payment rules' },
        { name: 'Chapter Incentives', href: '/admin/book-chapter-policies', description: 'Chapter payment rules' },
        { name: 'Conference Incentives', href: '/admin/conference-policies', description: 'Conference payment rules' },
        { name: 'Grant Incentives', href: '/admin/grant-policies', description: 'Grant payment rules' },
      ],
    });
  }

  // =====================================
    // NAVIGATION - Main navigation menu
  // Level 1: Academics, Research and Development
  // Level 2 (under R&D): Submit & Track, Review & Approve
  // =====================================
    const navigationSubItems: SubMenuItem[] = [];

  // Add Research and Development if there are sub-items
  if (rndSubItems.length > 0) {
    navigationSubItems.push({
      name: 'Research & Development',
      description: 'Research, Patents & Reviews',
      children: rndSubItems,
    });
  }

  // Workspace navigation - show it whenever there are actual items available for the user.
  if (navigationSubItems.length > 0) {
    menuItems.push({
      name: 'Workspace',
      subItems: navigationSubItems,
    });
  }

  // =====================================
  // ADMINISTRATION
  // =====================================
  if (isAdmin) {
    const administrationSubItems: SubMenuItem[] = [
      { name: 'Analytics Dashboard', href: '/admin/analytics', description: 'System statistics & reports' },
      { name: 'Audit Logs', href: '/admin/audit-logs', description: 'Track system activities' },
      { name: 'Bug Reports', href: '/admin/bug-reports', description: 'View and manage bug reports' },

      // Organization Management
      {
        name: 'Organization Structure',
        description: 'Schools, Departments & Programs',
        children: [
          { name: 'Schools', href: '/admin/schools', description: 'Manage university schools' },
          { name: 'Departments', href: '/admin/departments', description: 'Manage departments' },
          { name: 'Programs', href: '/admin/programs', description: 'Manage academic programs' },
          { name: 'Central Departments', href: '/admin/central-departments', description: 'Admin & support departments' },
        ],
      },

      // User Management
      {
        name: 'User Management',
        description: 'Employees, Students & Permissions',
        children: [
          { name: 'Employees', href: '/admin/employees', description: 'Manage faculty & staff' },
          { name: 'Students', href: '/admin/students', description: 'Manage student records' },
          { name: 'User & Role Management', href: '/admin/roles', description: 'Assign permissions & create role templates' },
          { name: ' Reporting Structure', href: '/admin/reporting-structure', description: 'Manage reporting hierarchy' },
          { name: '📤 Bulk Import', href: '/admin/bulk-upload', description: 'Import data in bulk' },
        ],
      }
    ];

    menuItems.push({
      name: 'Administration',
      subItems: administrationSubItems,
    });
  }

  // =====================================
  // MY ACCOUNT - For students only
  // =====================================
  if (isStudent) {
    menuItems.push({
      name: 'My Account',
      subItems: [
        { name: 'Settings', href: '/settings', description: 'Account preferences' },
        { name: 'Notifications', href: '/notifications', description: 'View all notifications' },
      ],
    });
  }

  // =====================================
  // SYSTEM & COMMUNICATION - Chat + Mail grouped
  // HIDDEN: Under development - not revealed to users yet
  // =====================================
  // menuItems.push({
  //   name: 'System & Communication',
  //   subItems: [
  //     { name: '💬 Chat', href: '/chat', description: 'Open the chat system' },
  //     { name: '📧 Mail', href: '/mail', description: 'Open the mail system' },
  //   ],
  // });

  // ── Active-route helper ──────────────────────────────────────────────────
  /** Returns true if this item or any descendant href matches the current path */
  const isItemActive = (item: SubMenuItem): boolean => {
    if (item.href && item.href !== '#' && currentPath.startsWith(item.href)) return true;
    if (item.children) return item.children.some(isItemActive);
    return false;
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-[#f0e2d2] dark:border-gray-800"
      style={{
        boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)'
      }}
    >
      {/* Clean header — no accent bar */}
      {/* Single Line Header */}
      <div className="h-20 sm:h-[5.5rem] px-2 sm:px-6 flex items-center justify-between gap-1 sm:gap-4 min-w-0">
        {/* Mobile Menu Button — hide once desktop nav is available (md+) */}
        <button
          onClick={() => { setMobileMenuOpen(!mobileMenuOpen); if (mobileMenuOpen) setExpandedMobileSection(null); }}
          className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-wine hover:bg-peach/40 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Wordmark */}
        <Link href={isSuperadmin ? '/superadmin/dashboard' : '/dashboard'} className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity flex-shrink-0" onClick={() => setMobileMenuOpen(false)}>
          <Wordmark heightClassName="h-[4.25rem] sm:h-[5rem]" className="drop-shadow-sm" />
        </Link>

        {/* Navigation Section — show from md so Dashboard / Profile / Workspace are not lost on typical laptop half-screens */}
        <nav className="hidden md:flex items-center gap-0.5 xl:gap-1 flex-1 justify-center min-w-0 overflow-visible">
          {/* Superadmin Nav Links */}
          {isSuperadmin && (
            <>
              <Link
                href="/superadmin/dashboard"
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  pathname === '/superadmin/dashboard'
                    ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-wine dark:hover:text-amber-400'
                }`}
              >
                SaaS Dashboard
              </Link>
              <Link
                href="/superadmin/universities"
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  pathname?.startsWith('/superadmin/universities')
                    ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-wine dark:hover:text-amber-400'
                }`}
              >
                Universities
              </Link>
              <Link
                href="/superadmin/billing"
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  pathname?.startsWith('/superadmin/billing')
                    ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-wine dark:hover:text-amber-400'
                }`}
              >
                Billing & Tiers
              </Link>
              <Link
                href="/superadmin/api-monitor"
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  pathname?.startsWith('/superadmin/api-monitor')
                    ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-wine dark:hover:text-amber-400'
                }`}
              >
                API Monitor
              </Link>
            </>
          )}

          {/* Regular user Dashboard and Profile Links */}
          {!isSuperadmin && (
            <Link
              href="/dashboard"
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${pathname === '/dashboard'
                ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-wine dark:hover:text-amber-400'
                }`}
            >
              Dashboard
            </Link>
          )}
          {!isSuperadmin && !isStudent && (
            <Link
              href="/research/my-profile"
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${pathname?.startsWith('/research/profile/') || pathname === '/research/my-profile'
                ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-wine dark:hover:text-amber-400'
                }`}
            >
              Profile
            </Link>
          )}

          {/* Skeleton shimmer while menu data loads */}
          {!isSuperadmin && isNavLoading && !!user && (
            <>
              {[80, 96, 72, 88, 80].map((w, i) => (
                <div
                  key={i}
                  className="h-8 rounded-lg animate-pulse bg-gray-100 dark:bg-gray-800"
                  style={{ width: `${w}px` }}
                />
              ))}
            </>
          )}

          {/* Dynamic Menu Items - hidden for superadmin */}
          {!isSuperadmin && !isNavLoading && menuItems.map((item) => (
            <div
              key={item.name}
              className="relative"
              ref={(el) => { dropdownRefs.current[item.name] = el; }}
            >
              <button
                onClick={() => {
                  if (activeDropdown ===
   item.name) {
                    setActiveDropdown(null);
                    setActiveSubmenu(null);
                    setActiveSubmenu2(null);
                  } else {
                    setActiveDropdown(item.name);
                    setActiveSubmenu(null);
                    setActiveSubmenu2(null);
                  }
                }}
                onMouseEnter={() => {
                  setActiveDropdown(item.name);
                  setActiveSubmenu(null);
                  setActiveSubmenu2(null);
                }}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${activeDropdown ===
   item.name
                  ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-wine dark:hover:text-amber-400'
                  }`}
              >
                {item.name}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown ===
   item.name ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu - Split-pane Absolute Flyout */}
              {activeDropdown ===
    item.name && item.subItems && (
                <div
                  className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 rounded-xl z-50 overflow-hidden flex w-[90vw] max-w-[620px] h-[380px]"
                  onMouseLeave={() => {
                    setActiveDropdown(null);
                    setHoveredCategory(null);
                  }}
                >
                  {/* Left Pane (Categories) */}
                  <div className="w-[230px] bg-gray-50/50 dark:bg-gray-800/10 border-r border-gray-100 dark:border-gray-800 p-2 overflow-y-auto rs-scrollbar flex flex-col gap-1 select-none">
                    {(() => {
                      const categories = item.name === 'Workspace'
                        ? (item.subItems.find(si => si.name.includes('Research & Development'))?.children || [])
                        : item.subItems;

                      const currentCategoryName = hoveredCategory || (categories[0] ? categories[0].name : null);

                      return categories.map((cat) => {
                        const isSelected = currentCategoryName === cat.name;
                        const isLeaf = !!cat.href;
                        
                        const handleMouseEnter = () => {
                          setHoveredCategory(cat.name);
                        };

                        const btnCls = `w-full flex flex-col text-left py-2 px-3 rounded-lg transition-all duration-150 ${
                          isSelected
                            ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400 font-semibold'
                            : 'text-gray-700 dark:bg-gray-200 hover:bg-gray-100/70 dark:hover:bg-gray-800/60'
                        }`;

                        return isLeaf ? (
                          <Link
                            key={cat.name}
                            href={cat.href!}
                            onMouseEnter={handleMouseEnter}
                            onClick={() => {
                              setActiveDropdown(null);
                              setHoveredCategory(null);
                            }}
                            className={btnCls}
                          >
                            <span className="text-xs font-semibold flex items-center gap-1">
                              {cat.name}
                            </span>
                            {cat.description && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[200px]">
                                {cat.description}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <button
                            key={cat.name}
                            onMouseEnter={handleMouseEnter}
                            className={btnCls}
                          >
                            <span className="text-xs font-semibold flex items-center justify-between">
                              {cat.name}
                              <ChevronRight className={`w-3 h-3 transition-transform ${isSelected ? 'translate-x-0.5' : ''}`} />
                            </span>
                            {cat.description && (
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[200px]">
                                {cat.description}
                              </span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  {/* Right Pane (Nested Items & Leaves) */}
                  <div className="flex-1 p-4 bg-white dark:bg-gray-900 overflow-y-auto rs-scrollbar">
                    {(() => {
                      const categories = item.name === 'Workspace'
                        ? (item.subItems.find(si => si.name.includes('Research & Development'))?.children || [])
                        : item.subItems;

                      const currentCategoryName = hoveredCategory || (categories[0] ? categories[0].name : null);
                      const activeCat = categories.find(cat => cat.name === currentCategoryName);

                      if (!activeCat) {
                        return (
                          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                            Hover over a section to view pages
                          </div>
                        );
                      }

                      if (activeCat.href) {
                        return (
                          <div className="h-full flex flex-col justify-center items-center text-center p-4">
                            <span className="text-3xl mb-2">🔗</span>
                            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1">
                              {activeCat.name}
                            </h4>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[220px] mb-3 leading-relaxed">
                              {activeCat.description || 'Open page directly'}
                            </p>
                            <Link
                              href={activeCat.href}
                              onClick={() => {
                                setActiveDropdown(null);
                                setHoveredCategory(null);
                              }}
                              className="px-3.5 py-1.5 bg-wine text-white dark:bg-amber-500 dark:text-gray-950 text-xs font-bold rounded-lg hover:bg-wine-700 dark:hover:bg-amber-400 transition-colors"
                            >
                              Go to Page
                            </Link>
                          </div>
                        );
                      }

                      if (activeCat.children) {
                        return (
                          <div className="flex flex-col gap-3">
                            <div className="border-b border-gray-100 dark:border-gray-800 pb-1.5">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-wine dark:text-amber-400">
                                {activeCat.name}
                              </h4>
                            </div>

                            <div className="flex flex-col gap-2">
                              {activeCat.children.map((child) => {
                                const hasNested = child.children && child.children.length > 0;

                                if (hasNested) {
                                  return (
                                    <div key={child.name} className="flex flex-col gap-1 border-b border-gray-50 dark:border-gray-800/40 pb-2 mb-1">
                                      <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
                                        {child.name}
                                      </span>
                                      <div className="grid grid-cols-1 gap-0.5">
                                        {child.children!.map((nestedChild) => (
                                          <Link
                                            key={nestedChild.name}
                                            href={nestedChild.href!}
                                            onClick={() => {
                                              setActiveDropdown(null);
                                              setHoveredCategory(null);
                                            }}
                                            className="group flex flex-col p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors text-left"
                                          >
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200 group-hover:text-wine dark:group-hover:text-amber-400">
                                              {nestedChild.name}
                                            </span>
                                            {nestedChild.description && (
                                              <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal">
                                                {nestedChild.description}
                                              </span>
                                            )}
                                          </Link>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <Link
                                    key={child.name}
                                    href={child.href!}
                                    onClick={() => {
                                      setActiveDropdown(null);
                                      setHoveredCategory(null);
                                    }}
                                    className="group flex flex-col p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors text-left border border-transparent hover:border-gray-100 dark:hover:border-gray-800"
                                  >
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 group-hover:text-wine dark:group-hover:text-amber-400">
                                      {child.name}
                                    </span>
                                    {child.description && (
                                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        {child.description}
                                      </span>
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 min-w-0">
          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 sm:p-2.5 text-gray-500 dark:text-gray-400 hover:text-wine dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {showSearch && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 pl-10 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      autoFocus
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {searchQuery && searchResults.length ===
   0 && (
                    <div className="p-6 text-center text-gray-500 text-sm">
                      No results found for &quot;{searchQuery}&quot;
                    </div>
                  )}
                  {searchResults.map((result, index) => {
                    if (!result.href) {
                      return (
                        <div
                          key={index}
                          className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 opacity-60"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-400 dark:text-gray-500">
                                {result.name}
                              </div>
                              {result.description && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {result.description}
                                </div>
                              )}
                            </div>
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                              Coming Soon
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={index}
                        href={result.href}
                        prefetch={getLinkPrefetch(result.href, result.prefetch)}
                        onClick={() => {
                          setShowSearch(false);
                          setSearchQuery('');
                        }}
                        className="block px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {result.name}
                        </div>
                        {result.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {result.description}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                  {!searchQuery && (
                    <div className="p-6 text-center text-gray-500 text-sm">
                      Type to search menu items...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>



          {/* Notifications */}
          <button
            onClick={() => router.push('/notifications')}
            className="relative p-2 sm:p-2.5 text-gray-500 dark:text-gray-400 hover:text-wine dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-wine rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div className="relative flex-shrink-0" ref={userMenuRef}>
            {!user ? (
              /* Skeleton shimmer for user avatar while auth loads */
              <div className="flex items-center gap-2 p-1 sm:p-1.5 pr-2 sm:pr-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
                <div className="hidden lg:block h-4 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            ) : (
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1 sm:gap-2 p-1 sm:p-1.5 pr-2 sm:pr-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-wine flex items-center justify-center text-white text-xs sm:text-sm font-semibold">
                {getUserInitials()}
              </div>
              <span className="text-gray-700 dark:text-gray-200 text-sm font-medium hidden lg:block">{getUserDisplayName()}</span>
              <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>
            )}

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-peach dark:from-gray-700 dark:to-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{getUserDisplayName()}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{user?.email}</p>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="w-4 h-4" />
                  Profile Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-x-0 bottom-0 bg-black/50 z-40 top-20 sm:top-[5.5rem]"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu Drawer — top aligned with fixed header (h-20 / 5.5rem), fully off-screen when closed */}
      <div 
        className={`md:hidden fixed left-0 top-20 sm:top-[5.5rem] bottom-0 w-[min(280px,85vw)] z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Primary links — always expose Dashboard + Profile for non-superadmin */}
        {isSuperadmin ? (
          <div className="px-2 mt-2 space-y-1">
            {[
              { label: 'SaaS Dashboard', href: '/superadmin/dashboard' },
              { label: 'Universities', href: '/superadmin/universities' },
              { label: 'Billing & Tiers', href: '/superadmin/billing' },
              { label: 'API Monitor', href: '/superadmin/api-monitor' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  pathname?.startsWith(href)
                    ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="font-medium">{label}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-2 mt-2 space-y-1">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                pathname === '/dashboard'
                  ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="font-medium">Dashboard</span>
            </Link>
            {!isStudent && (
              <Link
                href="/research/my-profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  pathname?.startsWith('/research/profile/') || pathname === '/research/my-profile'
                    ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="font-medium">Profile</span>
              </Link>
            )}
            <Link
              href="/my-work"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                pathname === '/my-work'
                  ? 'bg-peach/60 text-wine dark:bg-wine/20 dark:text-amber-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="font-medium">My Work</span>
            </Link>
          </div>
        )}

        {/* Mobile Menu Items */}
        {!isSuperadmin && menuItems.map((item) => (

          <div key={item.name} className="border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setMobileExpandedMenu(mobileExpandedMenu ===
   item.name ? null : item.name)}
              className="w-full flex items-center justify-between px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              <span className="font-medium text-sm">{item.name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileExpandedMenu ===
   item.name ? 'rotate-180' : ''}`} />
            </button>

            {mobileExpandedMenu ===
   item.name && item.subItems && (
              <div className="bg-gray-50 dark:bg-gray-800/60 pb-2">
                {item.subItems.map((subItem) => (
                  <div key={subItem.name}>
                    {subItem.href ? (
                      <Link
                        href={subItem.href}
                        prefetch={getLinkPrefetch(subItem.href, subItem.prefetch)}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-6 py-2.5 text-gray-600 dark:text-gray-300 hover:text-wine dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-all"
                      >
                        {subItem.name}
                      </Link>
                    ) : subItem.children ? (
                      <>
                        <button
                          onClick={() => setMobileExpandedSubmenu(mobileExpandedSubmenu ===
   subItem.name ? null : subItem.name)}
                          className="w-full flex items-center justify-between px-6 py-2.5 text-gray-600 dark:text-gray-300 hover:text-wine dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition-all"
                        >
                          <span>{subItem.name}</span>
                          <ChevronRight className={`w-4 h-4 transition-transform ${mobileExpandedSubmenu ===
   subItem.name ? 'rotate-90' : ''}`} />
                        </button>
                        {mobileExpandedSubmenu ===
   subItem.name && (
                          <div className="bg-gray-100 dark:bg-gray-800">
                            {subItem.children.map((child) => (
                              child.href ? (
                                <Link
                                  key={child.name}
                                  href={child.href}
                                  prefetch={getLinkPrefetch(child.href, child.prefetch)}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className="flex items-center gap-2 px-8 py-2 text-gray-500 dark:text-gray-400 hover:text-wine dark:hover:text-amber-400 hover:bg-gray-200/60 dark:hover:bg-gray-700 text-xs transition-all"
                                >
                                  {child.name}
                                </Link>
                              ) : child.children ? (
                                <div key={child.name}>
                                  <div className="px-8 py-2 text-gray-400 dark:text-gray-500 text-xs font-medium">{child.name}</div>
                                  {child.children.map((grandChild) => (
                                    grandChild.href && (
                                      <Link
                                        key={grandChild.name}
                                        href={grandChild.href}
                                        prefetch={getLinkPrefetch(grandChild.href, grandChild.prefetch)}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-2 px-10 py-2 text-gray-500 dark:text-gray-400 hover:text-wine dark:hover:text-amber-400 hover:bg-gray-200/60 dark:hover:bg-gray-700 text-xs transition-all"
                                      >
                                        {grandChild.name}
                                      </Link>
                                    )
                                  ))}
                                </div>
                              ) : null
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Mobile Quick Actions */}
        <div className="border-t border-gray-100 dark:border-gray-800 mt-4 pt-4 px-4 space-y-2">
          <Link
            href="/notifications"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-300 hover:text-wine dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm transition-all"
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-wine text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </Link>
          <Link
            href="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-gray-600 dark:text-gray-300 hover:text-wine dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-sm transition-all"
          >
            <User className="w-4 h-4" />
            <span>Profile Settings</span>
          </Link>
          <button
            onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
