'use client';

import { useAuthStore } from '@/shared/auth/authStore';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, Bell, ChevronDown, Search, Sun, Moon, HelpCircle } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationService } from '@/shared/services/notification.service';
import { useTheme } from '@/shared/providers/ThemeProvider';
import api from '@/shared/api/api';
import Link from 'next/link';
import logger from '@/shared/utils/logger';

interface DepartmentPermission {
  category: string;
  permissions: string[];
}

interface SubMenuItem {
  name: string;
  href?: string;
  description?: string;
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
  if (!permissions || permissions.length === 0) return false;
  
  const drdKeys = [
    'ipr_review', 'ipr_approve', 'ipr_assign_school', 'ipr_recommend',
    'research_review', 'research_approve', 'research_assign_school',
    'book_review', 'book_approve', 'book_assign_school',
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
  const keys = ['finance', 'incentive', 'payment'];
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
  const [activeSubmenu3, setActiveSubmenu3] = useState<string | null>(null); // Fourth level submenu
  const [unreadCount, setUnreadCount] = useState(0);
  const [userPermissions, setUserPermissions] = useState<DepartmentPermission[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{name: string, href?: string, description?: string}>>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const isStudent = user?.role?.name === 'student' || user?.userType === 'student';
  const isFaculty = user?.role?.name === 'faculty' || user?.userType === 'faculty';
  const isAdmin = user?.role?.name === 'admin' || user?.userType === 'admin';

  const canFileIpr = isFaculty || isStudent || isAdmin || hasPermission(userPermissions, 'ipr_file_new');
  const canFileResearch = isFaculty || isStudent || isAdmin || hasPermission(userPermissions, 'research_file_new');
  const hasDrdAccess = hasDrdPermissions(userPermissions) || isAdmin;
  const hasFinanceAccess = hasFinancePermissions(userPermissions);
  
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

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      fetchUserPermissions();
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      logger.error('Failed to fetch notification count:', error);
    }
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const response = await api.get('/dashboard/staff');
      if (response.data.success) {
        setUserPermissions(response.data.data.permissions || []);
      }
    } catch (error) {
      logger.error('Error fetching permissions:', error);
    }
  };

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

  // Search through all menu items
  const searchMenuItems = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results: Array<{name: string, href?: string, description?: string}> = [];
    const searchLower = query.toLowerCase();

    const searchInSubmenu = (items: SubMenuItem[]) => {
      items.forEach(item => {
        if (item.name.toLowerCase().includes(searchLower) || 
            item.description?.toLowerCase().includes(searchLower)) {
          results.push({
            name: item.name,
            href: item.href,
            description: item.description
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
    await logout();
    router.push('/login');
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

    // Build menu items based on permissions
  const menuItems: MenuItem[] = [];

  // ============================================
  // Build Submit & Track children - SIMPLIFIED 3 OPTIONS
  // 1. Monthly Progress Tracker
  // 2. My Research (view all submitted work)
  // 3. New Filing (file new work)
  // ============================================
  // Build Submit & Track children - 2 OPTIONS
  // 1. My Research (view all submitted work)
  // 2. New Filing (file new work)
  // ============================================
  const submitTrackChildren: SubMenuItem[] = [
    // Option 1: My Research - View all submitted work (with sub-options)
    {
      name: 'My Research',
      description: 'View all your submitted work',
      children: [
        { name: 'All Submissions', href: '/my-work', description: 'View all submissions at once' },
        ...(canFileResearch ? [{ name: 'Research Papers, Books, Chapters & Conference Papers', href: '/research/my-contributions', description: 'View research papers' }] : []),
        ...(canFileIpr ? [{ name: 'Patents / IPR', href: '/ipr/my-applications', description: 'View patent applications' }] : []),
      ],
    },
    
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

  // ============================================
  // Build Review & Approval children - ORGANIZED
  // ============================================
  const hasReviewAccess = hasDrdAccess || canReviewIpr || canApproveIpr || canReviewResearch || 
    canApproveResearch || canReviewBook || canApproveBook || canReviewConference || 
    canApproveConference || canReviewGrant || canApproveGrant || hasFinanceAccess;

  const reviewApprovalChildren: SubMenuItem[] = [];
  if (hasDrdAccess) {
    reviewApprovalChildren.push({ name: '📊 DRD Dashboard', href: '/drd', description: 'Research & Development overview' });
  }
  if (canReviewIpr || canApproveIpr) {
    reviewApprovalChildren.push({ name: '💡 Review Patents/IPR', href: '/drd/review', description: 'Pending patent applications' });
  }
  if (canReviewResearch || canApproveResearch) {
    reviewApprovalChildren.push({ name: '📝 Review Research Papers', href: '/drd/research?type=research', description: 'Pending research papers' });
  }
  if (canReviewBook || canApproveBook) {
    reviewApprovalChildren.push({ name: '📚 Review Books/Chapters', href: '/drd/research?type=book', description: 'Pending book submissions' });
  }
  if (canReviewConference || canApproveConference) {
    reviewApprovalChildren.push({ name: '🎤 Review Conference Papers', href: '/drd/research?type=conference', description: 'Pending conference papers' });
  }
  if (canReviewGrant || canApproveGrant) {
    reviewApprovalChildren.push({ name: '💰 Review Grant Proposals', href: '/drd/research?type=grant_proposal', description: 'Pending grant applications' });
  }
  if (hasFinanceAccess) {
    reviewApprovalChildren.push({ name: '🏦 Finance & Payments', href: '/finance/dashboard', description: 'Manage incentive payments' });
  }

  // ============================================
  // Build Research and Development sub-items
  // ============================================
  const rndSubItems: SubMenuItem[] = [];
  
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

  // Admin Only - R&D Configuration and Incentive Policies
  if (isAdmin) {
    rndSubItems.push({
      name: '⚙️ R&D Configuration',
      description: 'School assignments & routing',
      children: [
        { name: '💡 IPR Routing', href: '/admin/drd-school-assignment', description: 'Route IPR to schools' },
        { name: '📝 Research Routing', href: '/admin/research-school-assignment', description: 'Route research to schools' },
        { name: '📚 Book Routing', href: '/admin/book-school-assignment', description: 'Route books to schools' },
        { name: '🎤 Conference Routing', href: '/admin/conference-school-assignment', description: 'Route conferences' },
        { name: '💰 Grant Routing', href: '/admin/grant-school-assignment', description: 'Route grants' },
      ],
    });

    rndSubItems.push({
      name: '📜 Incentive Policies',
      description: 'Configure payment policies',
      children: [
        { name: '💡 Patent/IPR Incentives', href: '/admin/incentive-policies', description: 'IPR payment rules' },
        { name: '📝 Research Incentives', href: '/admin/research-policies', description: 'Research payment rules' },
        { name: '📚 Book Incentives', href: '/admin/book-policies', description: 'Book payment rules' },
        { name: '📖 Chapter Incentives', href: '/admin/book-chapter-policies', description: 'Chapter payment rules' },
        { name: '🎤 Conference Incentives', href: '/admin/conference-policies', description: 'Conference payment rules' },
        { name: '💰 Grant Incentives', href: '/admin/grant-policies', description: 'Grant payment rules' },
      ],
    });
  }

  // ============================================
  // NAVIGATION - Main navigation menu
  // Level 1: Academics, Research and Development
  // Level 2 (under R&D): Submit & Track, Review & Approve
  // ============================================
  const navigationSubItems: SubMenuItem[] = [
    // Academics
    {
      name: '📚 Academics',
      description: 'Academic resources and tools',
      children: [
        { name: '🎓 LMS', href: 'http://13.235.188.79', description: 'Learning Management System' },
        { name: '� Event Management', href: 'https://sgt-event.vercel.app/student', description: 'Campus event management' },
        { name: '�📖 Courses', href: '#', description: 'Course management (Coming Soon)' },
        { name: '📅 Timetable', href: '#', description: 'Class schedules (Coming Soon)' },
        { name: '📝 Examinations', href: '#', description: 'Exam management (Coming Soon)' },
        { name: '🏆 Results', href: '#', description: 'Academic results (Coming Soon)' },
        { name: '✅ Attendance', href: '#', description: 'Attendance tracking (Coming Soon)' },
      ],
    },
  ];

  // Add Research and Development if there are sub-items
  if (rndSubItems.length > 0) {
    navigationSubItems.push({
      name: '🔬 Research & Development',
      description: 'Research, Patents & Reviews',
      children: rndSubItems,
    });
  }

  // Add Admissions
  navigationSubItems.push({
    name: '📝 Admissions',
    href: 'http://localhost:3000/',
    description: 'Student admissions portal',
  });

  // Add Noting approval with Event Management
  navigationSubItems.push({
    name: '📝 Noting approval',
    description: 'Event management and approvals',
    children: [
      { name: '📅 Event Management', href: 'https://sgt-event.vercel.app/student', description: 'Campus event management' },
    ],
  });

  // Add RFID
  navigationSubItems.push({
    name: '🔐 RFID',
    href: 'https://192.168.7.20:3000',
    description: 'RFID access system',
  });

  // Add Navigation menu
  menuItems.push({
    name: 'UMS Navigation',
    subItems: navigationSubItems,
  });

  // ============================================
  // ADMINISTRATION - For system admins only
  // ============================================
  if (isAdmin) {
    menuItems.push({
      name: 'Administration',
      subItems: [
        // Analytics & Reports
        { name: '📊 Analytics Dashboard', href: '/admin/analytics', description: 'System statistics & reports' },
        { name: '📋 Audit Logs', href: '/admin/audit-logs', description: 'Track system activities' },
        
        // Organization Management
        {
          name: '🏛️ Organization Structure',
          description: 'Schools, Departments & Programs',
          children: [
            { name: '🏫 Schools', href: '/admin/schools', description: 'Manage university schools' },
            { name: '🏢 Departments', href: '/admin/departments', description: 'Manage departments' },
            { name: '📚 Programs', href: '/admin/programs', description: 'Manage academic programs' },
            { name: '🏛️ Central Departments', href: '/admin/central-departments', description: 'Admin & support departments' },
          ],
        },
        
        // User Management
        {
          name: '👥 User Management',
          description: 'Employees, Students & Permissions',
          children: [
            { name: '👨‍🏫 Employees', href: '/admin/employees', description: 'Manage faculty & staff' },
            { name: '👨‍🎓 Students', href: '/admin/students', description: 'Manage student records' },
            { name: '🔐 Role Permissions', href: '/admin/permissions', description: 'Configure access rights' },
            { name: '📤 Bulk Import', href: '/admin/bulk-upload', description: 'Import data in bulk' },
          ],
        },
      ],
    });
  }

  // ============================================
  // MY ACCOUNT - For students only
  // ============================================
  if (isStudent) {
    menuItems.push({
      name: 'My Account',
      subItems: [
        { name: '⚙️ Settings', href: '/settings', description: 'Account preferences' },
        { name: '🔔 Notifications', href: '/notifications', description: 'View all notifications' },
      ],
    });
  }

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50"
      style={{ 
        background: 'linear-gradient(135deg, #005b96 0%, #004a80 50%, #003d6b 100%)',
        boxShadow: '0 4px 20px rgba(0,91,150,0.15)'
      }}
    >
      {/* Single Line Header */}
      <div className="h-16 px-6 flex items-center justify-between gap-8">
        {/* Logo Section */}
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity flex-shrink-0">
          <img 
            src="/images/new-header-logo.png" 
            alt="SGT University" 
            className="h-12 object-contain brightness-0 invert"
          />
          <div className="hidden xl:block">
            <div className="text-white font-bold text-sm leading-tight">UNIVERSITY</div>
            <div className="text-white/70 text-xs leading-tight">MANAGEMENT SYSTEM</div>
          </div>
        </Link>

        {/* Navigation Section - Center */}
        <nav className="flex items-center gap-2 flex-1 justify-center">
          {/* Dashboard Link */}
          <Link
            href="/dashboard"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              pathname === '/dashboard'
                ? 'bg-white/20 text-white shadow-lg'
                : 'text-white/90 hover:bg-white/15 hover:text-white'
            }`}
          >
            Dashboard
          </Link>

          {/* Dynamic Menu Items */}
          {menuItems.map((item) => (
            <div 
              key={item.name}
              className="relative"
              ref={(el) => { dropdownRefs.current[item.name] = el; }}
            >
              <button
                onClick={() => {
                  if (activeDropdown === item.name) {
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
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                  activeDropdown === item.name
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-white/90 hover:bg-white/15 hover:text-white'
                }`}
              >
                {item.name}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === item.name ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown - Blue Glassmorphism Effect Full Width */}
              {activeDropdown === item.name && item.subItems && (
                <div 
                  className="fixed left-0 right-0 mt-2 shadow-2xl border-t border-gray-200 z-50 max-h-[80vh] overflow-y-auto"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.92) 100%)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: '0 8px 32px 0 rgba(0, 69, 120, 0.15)',
                  }}
                  onMouseLeave={() => {
                    setActiveDropdown(null);
                    setActiveSubmenu(null);
                    setActiveSubmenu2(null);
                  }}
                >
                  <div className="max-w-7xl mx-auto px-6 py-4 relative">
                    {/* Main Menu */}
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 transition-all duration-300 ${
                      activeSubmenu ? 'hidden' : 'block'
                    }`}>
                      {item.subItems.map((subItem) => (
                        subItem.href ? (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={() => {
                              setActiveDropdown(null);
                              setActiveSubmenu(null);
                            }}
                            className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">
                                {subItem.name}
                              </div>
                              {subItem.description && (
                                <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{subItem.description}</div>
                              )}
                            </div>
                            <div className="ml-3 flex-shrink-0">
                              <svg 
                                className="w-4 h-4 text-[#005b96]/60 group-hover:text-[#005b96] group-hover:translate-x-1 transition-all" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </Link>
                        ) : subItem.children ? (
                          <button
                            key={subItem.name}
                            onClick={() => setActiveSubmenu(subItem.name)}
                            className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10 text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">
                                {subItem.name}
                              </div>
                              {subItem.description && (
                                <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{subItem.description}</div>
                              )}
                            </div>
                            <div className="ml-3 flex-shrink-0">
                              <svg 
                                className="w-4 h-4 text-[#005b96]/60 group-hover:text-[#005b96] group-hover:translate-x-1 transition-all" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        ) : null
                      ))}
                    </div>
                    
                    {/* Nested Submenu Slide - Level 2 */}
                    {activeSubmenu && !activeSubmenu2 && (
                      <div className="transition-all duration-300">
                        {/* Back Button */}
                        <div className="mb-3">
                          <button
                            onClick={() => setActiveSubmenu(null)}
                            className="flex items-center gap-2 text-[#005b96] hover:text-[#003d66] font-medium transition-colors text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {item.subItems.find(si => si.name === activeSubmenu)?.children?.map((child) => {
                            const isComingSoon = child.href === '#' || child.description?.includes('Coming Soon');
                            const hasNestedChildren = child.children && child.children.length > 0;
                            
                            // Coming Soon items
                            if (isComingSoon && !hasNestedChildren) {
                              return (
                                <div
                                  key={child.name}
                                  className="group flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 cursor-not-allowed opacity-60"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-400 truncate flex items-center gap-2">
                                      {child.name}
                                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                        Coming Soon
                                      </span>
                                    </div>
                                    {child.description && (
                                      <div className="text-xs text-gray-400 mt-0.5 truncate">{child.description}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            
                            // Items with nested children (like Research & IPR, Review & Approval)
                            if (hasNestedChildren) {
                              return (
                                <button
                                  key={child.name}
                                  onClick={() => setActiveSubmenu2(child.name)}
                                  className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10 text-left"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">
                                      {child.name}
                                    </div>
                                    {child.description && (
                                      <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{child.description}</div>
                                    )}
                                  </div>
                                  <div className="ml-3 flex-shrink-0">
                                    <svg 
                                      className="w-4 h-4 text-[#005b96]/60 group-hover:text-[#005b96] group-hover:translate-x-1 transition-all" 
                                      fill="none" 
                                      viewBox="0 0 24 24" 
                                      stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </button>
                              );
                            }
                            
                            // Regular link items
                            return (
                              <Link
                                key={child.href || child.name}
                                href={child.href!}
                                onClick={() => {
                                  setActiveSubmenu(null);
                                  setActiveDropdown(null);
                                }}
                                className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">
                                    {child.name}
                                  </div>
                                  {child.description && (
                                    <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{child.description}</div>
                                  )}
                                </div>
                                <div className="ml-3 flex-shrink-0">
                                  <svg 
                                    className="w-4 h-4 text-[#005b96]/60 group-hover:text-[#005b96] group-hover:translate-x-1 transition-all" 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Nested Submenu Slide - Level 3 (Third level) */}
                    {activeSubmenu && activeSubmenu2 && !activeSubmenu3 && (
                      <div className="transition-all duration-300">
                        {/* Back Button */}
                        <div className="mb-3">
                          <button
                            onClick={() => setActiveSubmenu2(null)}
                            className="flex items-center gap-2 text-[#005b96] hover:text-[#003d66] font-medium transition-colors text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to {activeSubmenu}
                          </button>
                        </div>
                        
                        {/* Submenu title */}
                        <div className="mb-3 pb-2 border-b border-gray-200">
                          <h3 className="text-lg font-bold text-[#005b96]">{activeSubmenu2}</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {item.subItems
                            .find(si => si.name === activeSubmenu)?.children
                            ?.find(c => c.name === activeSubmenu2)?.children
                            ?.map((grandChild) => {
                              const isComingSoon = grandChild.href === '#' || grandChild.description?.includes('Coming Soon');
                              const hasNestedChildren = grandChild.children && grandChild.children.length > 0;
                              
                              if (isComingSoon && !hasNestedChildren) {
                                return (
                                  <div
                                    key={grandChild.name}
                                    className="group flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 cursor-not-allowed opacity-60"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-gray-400 truncate flex items-center gap-2">
                                        {grandChild.name}
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                          Coming Soon
                                        </span>
                                      </div>
                                      {grandChild.description && (
                                        <div className="text-xs text-gray-400 mt-0.5 truncate">{grandChild.description}</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Items with nested children - go to Level 4
                              if (hasNestedChildren) {
                                return (
                                  <button
                                    key={grandChild.name}
                                    onClick={() => setActiveSubmenu3(grandChild.name)}
                                    className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10 text-left"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">
                                        {grandChild.name}
                                      </div>
                                      {grandChild.description && (
                                        <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{grandChild.description}</div>
                                      )}
                                    </div>
                                    <div className="ml-3 flex-shrink-0">
                                      <svg 
                                        className="w-4 h-4 text-[#005b96]/60 group-hover:text-[#005b96] group-hover:translate-x-1 transition-all" 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </button>
                                );
                              }
                              
                              // Regular link items
                              if (!grandChild.href) return null;
                              
                              return (
                                <Link
                                  key={grandChild.href || grandChild.name}
                                  href={grandChild.href}
                                  onClick={() => {
                                    setActiveSubmenu2(null);
                                    setActiveSubmenu(null);
                                    setActiveDropdown(null);
                                  }}
                                  className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">
                                      {grandChild.name}
                                    </div>
                                    {grandChild.description && (
                                      <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{grandChild.description}</div>
                                    )}
                                  </div>
                                  <div className="ml-3 flex-shrink-0">
                                    <svg 
                                      className="w-4 h-4 text-[#005b96]/60 group-hover:text-[#005b96] group-hover:translate-x-1 transition-all" 
                                      fill="none" 
                                      viewBox="0 0 24 24" 
                                      stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </Link>
                              );
                            })}
                        </div>
                      </div>
                    )}
                    
                    {/* Nested Submenu Slide - Level 4 (Fourth level) */}
                    {activeSubmenu && activeSubmenu2 && activeSubmenu3 && (
                      <div className="transition-all duration-300">
                        {/* Back Button */}
                        <div className="mb-3">
                          <button
                            onClick={() => setActiveSubmenu3(null)}
                            className="flex items-center gap-2 text-[#005b96] hover:text-[#003d66] font-medium transition-colors text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to {activeSubmenu2}
                          </button>
                        </div>
                        
                        {/* Submenu title */}
                        <div className="mb-3 pb-2 border-b border-gray-200">
                          <h3 className="text-lg font-bold text-[#005b96]">{activeSubmenu3}</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {item.subItems
                            .find(si => si.name === activeSubmenu)?.children
                            ?.find(c => c.name === activeSubmenu2)?.children
                            ?.find(gc => gc.name === activeSubmenu3)?.children
                            ?.map((greatGrandChild) => {
                              const isComingSoon = greatGrandChild.href === '#' || greatGrandChild.description?.includes('Coming Soon');
                              
                              if (isComingSoon) {
                                return (
                                  <div
                                    key={greatGrandChild.name}
                                    className="group flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 cursor-not-allowed opacity-60"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-semibold text-gray-400 truncate flex items-center gap-2">
                                        {greatGrandChild.name}
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                          Coming Soon
                                        </span>
                                      </div>
                                      {greatGrandChild.description && (
                                        <div className="text-xs text-gray-400 mt-0.5 truncate">{greatGrandChild.description}</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              
                              if (!greatGrandChild.href) return null;
                              
                              return (
                                <Link
                                  key={greatGrandChild.href || greatGrandChild.name}
                                  href={greatGrandChild.href}
                                  onClick={() => {
                                    setActiveSubmenu3(null);
                                    setActiveSubmenu2(null);
                                    setActiveSubmenu(null);
                                    setActiveDropdown(null);
                                  }}
                                  className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">
                                      {greatGrandChild.name}
                                    </div>
                                    {greatGrandChild.description && (
                                      <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{greatGrandChild.description}</div>
                                    )}
                                  </div>
                                  <div className="ml-3 flex-shrink-0">
                                    <svg 
                                      className="w-4 h-4 text-[#005b96]/60 group-hover:text-[#005b96] group-hover:translate-x-1 transition-all" 
                                      fill="none" 
                                      viewBox="0 0 24 24" 
                                      stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </Link>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className="p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-all duration-200"
            >
              <Search className="w-5 h-5" />
            </button>

            {showSearch && (
              <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
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
                  {searchQuery && searchResults.length === 0 && (
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

          {/* Quick Links Dropdown */}
          <div className="relative">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'quicklinks' ? null : 'quicklinks')}
              onMouseEnter={() => setActiveDropdown('quicklinks')}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 group"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-sm font-medium hidden lg:block">Quick Links</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'quicklinks' ? 'rotate-180' : ''}`} />
            </button>

            {/* Quick Links Dropdown Menu */}
            {activeDropdown === 'quicklinks' && (
              <div
                className="absolute top-full right-0 mt-2 w-64 shadow-2xl border-t border-gray-200 z-50 rounded-lg overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.92) 100%)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 8px 32px 0 rgba(0, 69, 120, 0.15)',
                }}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <div className="py-2">
                  <a
                    href="http://13.235.188.79"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#005b96]/10 transition-colors"
                  >
                    <span className="text-sm font-semibold text-[#005b96]">🎓 LMS</span>
                  </a>
                  <Link
                    href="/research/apply"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#005b96]/10 transition-colors"
                    onClick={() => setActiveDropdown(null)}
                  >
                    <span className="text-sm font-semibold text-[#005b96]">📝 File Research</span>
                  </Link>
                  <Link
                    href="/ipr/apply"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#005b96]/10 transition-colors"
                    onClick={() => setActiveDropdown(null)}
                  >
                    <span className="text-sm font-semibold text-[#005b96]">💡 File IPR</span>
                  </Link>
                  <Link
                    href="/my-work"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#005b96]/10 transition-colors"
                    onClick={() => setActiveDropdown(null)}
                  >
                    <span className="text-sm font-semibold text-[#005b96]">📊 My Submissions</span>
                  </Link>
                  <Link
                    href="https://sgtuniversity.ac.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#005b96]/10 transition-colors"
                  >
                    <span className="text-sm font-semibold text-[#005b96]">🌐 University Website</span>
                  </Link>
                  <Link
                    href="https://sgttimes.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#005b96]/10 transition-colors"
                  >
                    <span className="text-sm font-semibold text-[#005b96]">📰 SGT Times</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Dark Mode Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-all duration-200"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <button 
            onClick={() => router.push('/notifications')}
            className="relative p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-all duration-200"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 pr-3 hover:bg-white/15 rounded-lg transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold shadow-lg border-2 border-white/30">
                {getUserInitials()}
              </div>
              <span className="text-white text-sm font-medium hidden lg:block">{getUserDisplayName()}</span>
              <ChevronDown className={`w-4 h-4 text-white/80 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-800">
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
    </header>
  );
}
