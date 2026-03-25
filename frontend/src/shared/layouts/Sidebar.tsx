'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  Lightbulb, 
  ClipboardCheck, 
  UserCheck, 
  DollarSign, 
  Building, 
  ChevronDown,
  Bell,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  MapPin,
  Upload,
  BarChart3,
  BookOpen,
  FileText,
  Presentation,
  Calendar,
  Plus,
  List,
  UserPlus,
  CheckSquare,
  Shield,
  Store,
  QrCode,
  Award
} from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import api from '@/shared/api/api';
import { logger } from '@/shared/utils/logger';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  adminOnly?: boolean;
  subItems?: NavItem[];
}

interface DepartmentPermission {
  category: string;
  permissions: string[];
}

const hasPermission = (permissions: DepartmentPermission[], permissionName: string): boolean => {
  const variants = [permissionName, `drd_${permissionName}`, permissionName.replace('drd_', '')];
  for (const dept of permissions) {
    if (dept.permissions.some(p => variants.some(v => p.toLowerCase().includes(v.toLowerCase())))) return true;
  }
  return false;
};

const hasDrdPermissions = (permissions: DepartmentPermission[]): boolean => {
  // If no permissions, return false
  if (!permissions || permissions.length === 0) return false;
  
  // Check for any DRD-related permission
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
    // Check if category is DRD related
    if (category.includes('drd') || category.includes('research') || category.includes('development') || category.includes('book')) {
      logger.debug('DRD Permission found via category:', category);
      return true;
    }
    // Check for specific permissions
    for (const perm of dept.permissions || []) {
      const permLower = perm.toLowerCase();
      if (drdKeys.some(k => permLower.includes(k.toLowerCase()))) {
        logger.debug('DRD Permission found:', perm);
        return true;
      }
    }
  }
  logger.debug('No DRD permissions found in:', permissions);
  return false;
};

const hasAnalyticsPermissions = (permissions: DepartmentPermission[]): boolean => {
  const analyticsKeys = [
    'applicant_analytics', 'drd_member_analytics',
    'ipr_applicant_analytics', 'research_applicant_analytics',
    'book_applicant_analytics', 'conference_applicant_analytics',
    'grant_applicant_analytics',
  ];
  for (const dept of permissions) {
    for (const perm of dept.permissions || []) {
      if (analyticsKeys.some(k => perm.toLowerCase().includes(k))) return true;
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

const getNavItems = (
  userRole: string | undefined,
  userType: string | undefined,
  permissions: DepartmentPermission[],
  extraFlags?: { isChairperson?: boolean; hasVolunteerAssignments?: boolean }
): NavItem[] => {
  const isStudent = userRole === 'student' || userType === 'student';
  const isFaculty = userRole === 'faculty' || userType === 'faculty';
  const isStaff = userRole === 'staff' || userType === 'staff';
  const isAdmin = userRole === 'admin' || userType === 'admin';
  const canCreateEvent = isFaculty || extraFlags?.isChairperson;
  const canBrowseEvents = true;
  const hasVolunteerAssignments = extraFlags?.hasVolunteerAssignments ?? false;
  
  logger.debug('getNavItems - role:', userRole, 'type:', userType, 'isAdmin:', isAdmin);
  logger.debug('getNavItems - permissions:', permissions);
  
  const items: NavItem[] = [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }];
  
  // Check permissions
  const canFileIpr = isFaculty || isStudent || isAdmin || hasPermission(permissions, 'ipr_file_new');
  const canFileResearch = isFaculty || isStudent || isAdmin || hasPermission(permissions, 'research_file_new');
  const canFileBook = isFaculty || isStudent || isAdmin || hasPermission(permissions, 'book_file_new');
  const hasDrdAccess = hasDrdPermissions(permissions) || isAdmin;
  const hasFinanceAccess = hasFinancePermissions(permissions);
  
  logger.debug('getNavItems - canFileIpr:', canFileIpr, 'canFileResearch:', canFileResearch, 'canFileBook:', canFileBook, 'hasDrdAccess:', hasDrdAccess);
  
  // DRD Dashboard - Show for users with DRD permissions OR admins
  if (hasDrdAccess) {
    items.push({ name: 'DRD Dashboard', href: '/drd', icon: UserCheck });
  }
  
  // DRD Analytics - Show for users with analytics permissions OR admins
  const hasAnalyticsAccess = hasAnalyticsPermissions(permissions) || isAdmin;
  if (hasAnalyticsAccess) {
    items.push({
      name: 'DRD Analytics',
      href: '/drd/analytics/overview',
      icon: BarChart3,
      subItems: [
        { name: 'Overview', href: '/drd/analytics/overview', icon: LayoutDashboard },
        { name: 'Applicant Analytics', href: '/drd/analytics/applicant', icon: FileText },
        { name: 'DRD Member Performance', href: '/drd/analytics/drd-member', icon: Users },
      ],
    });
  }
  
  // Finance Dashboard - Show if user has finance permissions
  if (hasFinanceAccess) {
    items.push({ name: 'Finance', href: '/finance/dashboard', icon: DollarSign });
  }
  
  // Research & IPR - Show unified menu for faculty and students
  if (canFileResearch || canFileIpr || canFileBook) {
    const researchIprSubItems: NavItem[] = [
      { name: 'My Work', href: '/my-work', icon: LayoutDashboard },
    ];
    
    if (canFileIpr) {
      researchIprSubItems.push({ name: 'New IPR Application', href: '/ipr/apply', icon: Lightbulb });
      researchIprSubItems.push({ name: 'My IPR Applications', href: '/ipr/my-applications', icon: FileText });
    }
    
    if (canFileResearch) {
      researchIprSubItems.push({ name: 'New Research Contribution', href: '/research/apply', icon: BookOpen });
      researchIprSubItems.push({ name: 'My Research', href: '/research/my-contributions', icon: FileText });
    }
    
    if (isFaculty) {
      researchIprSubItems.push({ name: 'Mentor Approvals', href: '/mentor-approvals', icon: UserCheck });
    }
    
    items.push({
      name: 'Research & IPR',
      href: '/my-work',
      icon: BookOpen,
      subItems: researchIprSubItems
    });
  }
  
  // Event Management - Not for staff/guard role (gate entry only access)
  const eventSubItems: NavItem[] = [
    ...(canBrowseEvents ? [{ name: 'Browse Events', href: '/events', icon: List }] : []),
    { name: 'My Registrations', href: '/events/registrations', icon: UserPlus },
    { name: 'My Certificates', href: '/events/my-certificates', icon: Award },
    { name: 'Stall Application', href: '/events/stall-opportunities', icon: Store },
    { name: 'Event Feedback Scanner', href: '/event-feedback-scanner', icon: QrCode },
  ];
  // My Created Events — only faculty and club chairpersons
  if (canCreateEvent) {
    eventSubItems.splice(1, 0, { name: 'My Created Events', href: '/events/my-events', icon: CheckSquare });
  }
  // Volunteer — only users who are actually assigned as volunteers
  if (hasVolunteerAssignments) {
    eventSubItems.push({ name: 'Volunteer', href: '/events/volunteer', icon: Shield });
  }
  if (!isStaff) {
    items.push({
      name: 'Event Management',
      href: canBrowseEvents ? '/events' : '/events/registrations',
      icon: Calendar,
      subItems: eventSubItems,
    });
  }
  
  
  // Gate Entry - For staff/guard only (shown as main nav item)
  if (isStaff) {
    items.push({
      name: 'Gate Entry',
      href: '/admin/gate-entry',
      icon: Shield,
      subItems: [
        { name: 'All Passes', href: '/admin/gate-entry', icon: List },
        { name: 'Verify Pass', href: '/admin/gate-entry/verify', icon: QrCode },
        { name: 'Create Pass', href: '/admin/gate-entry/create-pass', icon: Plus },
      ]
    });
  }

  // Common items
  items.push(
    { name: 'Notifications', href: '/notifications', icon: Bell },
    { name: 'Settings', href: '/settings', icon: Settings }
  );
  
  // Admin section - Only for admins
  if (isAdmin) {
    items.push({ 
      name: 'Admin', href: '/admin', icon: Users, adminOnly: true,
      subItems: [
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
        { name: 'Bulk Upload', href: '/admin/bulk-upload', icon: Upload },
        { name: 'Schools', href: '/admin/schools', icon: GraduationCap },
        { name: 'Departments', href: '/admin/departments', icon: Building },
        { name: 'Programs', href: '/admin/programs', icon: BookOpen },
        { name: 'Central Departments', href: '/admin/central-departments', icon: Building },
        { name: 'Employees', href: '/admin/employees', icon: Users },
        { name: 'Students', href: '/admin/students', icon: GraduationCap },
        { name: 'Permissions', href: '/admin/permissions', icon: Settings },
        { name: 'Reporting Structure', href: '/admin/reporting-structure', icon: Shield },
        { name: 'IPR School Assignment', href: '/admin/drd-school-assignment', icon: MapPin },
        { name: 'Research School Assignment', href: '/admin/research-school-assignment', icon: BookOpen },
        { name: 'Book School Assignment', href: '/admin/book-school-assignment', icon: BookOpen },
        { name: 'Conference School Assignment', href: '/admin/conference-school-assignment', icon: Presentation },
        { name: 'Grant School Assignment', href: '/admin/grant-school-assignment', icon: DollarSign },
        { name: 'DRD Analytics Assignment', href: '/admin/drd-analytics-assignment', icon: BarChart3 },
        { name: 'IPR Policies', href: '/admin/incentive-policies', icon: Settings },
        { name: 'Research Policies', href: '/admin/research-policies', icon: FileText },
        { name: 'Book Policies', href: '/admin/book-policies', icon: BookOpen },
        { name: 'Book Chapter Policies', href: '/admin/book-chapter-policies', icon: BookOpen },
        { name: 'Conference Policies', href: '/admin/conference-policies', icon: Presentation },
        { name: 'Grant Policies', href: '/admin/grant-policies', icon: DollarSign },
      ]
    });
  }
  
  return items;
};

const getUserInitials = (user: any): string => {
  if (user?.firstName && user?.lastName) return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  if (user?.firstName) return user.firstName.substring(0, 2).toUpperCase();
  return user?.username?.substring(0, 2).toUpperCase() || 'U';
};

const getUserDisplayName = (user: any): string => {
  if (user?.firstName) return user.firstName;
  return user?.username || 'User';
};

const getUserRoleLabel = (user: any): string => {
  const type = user?.userType?.toUpperCase() || user?.role?.name?.toUpperCase() || 'USER';
  if (type === 'ADMIN') return 'ADMINISTRATOR';
  return type;
};

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Admin', 'Research & IPR', 'Event Management']); // Admin, Research & IPR, Event Management, and Ticket Management expanded by default
  const [userPermissions, setUserPermissions] = useState<DepartmentPermission[]>([]);
  const [isChairperson, setIsChairperson] = useState(false);
  const [hasVolunteerAssignments, setHasVolunteerAssignments] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserPermissions();
      fetchEventFlags();
    }
  }, [user]);

  const fetchUserPermissions = async () => {
    try {
      const response = await api.get('/dashboard/staff');
      if (response.data.success) {
        const perms = response.data.data.permissions || [];
        logger.debug('Sidebar - User permissions loaded:', perms);
        setUserPermissions(perms);
      }
    } catch (error) {
      logger.error('Error fetching permissions:', error);
    }
  };

  const fetchEventFlags = async () => {
    try {
      // Check if student is a club chairperson
      const isStudentUser = user?.role?.name === 'student' || user?.userType === 'student';
      if (isStudentUser) {
        const permsRes = await api.get('/noting/my-permissions');
        if (permsRes.data?.data?.isClubChairperson) {
          setIsChairperson(true);
        }
      }
    } catch (error) {
      logger.error('Error fetching noting permissions for sidebar:', error);
    }
    try {
      // Check if user has any volunteer assignments
      const volRes = await api.get('/events/volunteers/my');
      const assignments = volRes.data?.data;
      if (Array.isArray(assignments) && assignments.length > 0) {
        setHasVolunteerAssignments(true);
      }
    } catch (error) {
      logger.error('Error fetching volunteer assignments for sidebar:', error);
    }
  };

  const navItems = getNavItems(user?.role?.name, user?.userType, userPermissions, { isChairperson, hasVolunteerAssignments });
  // No need to filter - getNavItems already handles role-based visibility
  const filteredNavItems = navItems;

  const toggleExpand = (name: string) => {
    setExpandedItems(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Collapse Toggle - Like LMS */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-8 z-50 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors border border-gray-200"
      >
        <ChevronLeft className={`w-4 h-4 text-[#03396c] transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
      </button>

      {/* User Section - Like LMS with avatar, name, role badge */}
      <div className={`flex flex-col items-center py-6 border-b border-white/10 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        <div 
          className={`rounded-full bg-gradient-to-br from-[#03396c] to-[#011f4b] flex items-center justify-center text-white font-bold shadow-lg border-4 border-white/20 ${
            isCollapsed ? 'w-10 h-10 text-sm' : 'w-16 h-16 text-xl'
          }`}
        >
          {getUserInitials(user)}
        </div>
        {!isCollapsed && (
          <div className="text-center mt-3">
            <h3 className="text-white font-semibold text-sm">{getUserDisplayName(user)}</h3>
            <span className="inline-block mt-2 px-3 py-1 bg-[#005b96] text-white text-[10px] font-bold rounded-full tracking-wide">
              {getUserRoleLabel(user)}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {filteredNavItems.map((item: NavItem) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const isExpanded = expandedItems.includes(item.name);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          
          return (
            <div key={item.name} className="mb-1">
              {hasSubItems && !isCollapsed ? (
                <div>
                  <button
                    onClick={() => toggleExpand(item.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 mx-2 rounded-lg transition-all duration-200 ${
                      isActive 
                        ? 'bg-[#1a5a8a] text-white' 
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                    style={{ width: 'calc(100% - 16px)' }}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-1 space-y-0.5 pl-4 pr-2">
                      {item.subItems!.map((subItem: NavItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = pathname === subItem.href;
                        return (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            onClick={onMobileClose}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                              isSubActive 
                                ? 'bg-[#1a5a8a] text-white font-medium' 
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <SubIcon className="w-4 h-4 flex-shrink-0" />
                            {subItem.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={hasSubItems ? item.subItems![0]?.href || item.href : item.href}
                  onClick={onMobileClose}
                  className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200 ${
                    isCollapsed ? 'justify-center' : ''
                  } ${isActive 
                    ? 'bg-[#1a5a8a] text-white' 
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                  style={{ width: 'calc(100% - 16px)' }}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium text-sm">{item.name}</span>}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer - Like LMS */}
      {!isCollapsed && (
        <div className="border-t border-white/10 p-4 text-center">
          <p className="text-[10px] text-white/50">© 2025 SGT Learning Platform</p>
          <p className="text-[10px] text-white/40">Version 2.0</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex md:flex-col fixed left-0 top-14 bottom-0 z-30 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
        style={{ background: 'linear-gradient(180deg, #03396c 0%, #011f4b 100%)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onMobileClose} />
          <aside 
            className="fixed inset-y-0 left-0 w-60 z-50 md:hidden flex flex-col pt-14"
            style={{ background: 'linear-gradient(180deg, #03396c 0%, #011f4b 100%)' }}
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
