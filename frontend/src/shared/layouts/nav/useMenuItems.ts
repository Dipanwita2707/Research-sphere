import { MenuItem, SubMenuItem, NavPermissions } from './types';
import { useRndMenuItems } from './useRndMenuItems';

/** Builds the full top-level menu items array based on user permissions */
export function useMenuItems(perms: NavPermissions, hasVolunteerAssignments: boolean): MenuItem[] {
  const { isStudent, isFaculty, isStaff, isAdmin, isClubChairperson, hasFullGateEntryAccess } = perms;
  const rndSubItems = useRndMenuItems(perms);
  const menuItems: MenuItem[] = [];

  // ── UMS Navigation (hidden for staff/guard) ──────────────────────────────
  if (!isStaff) {
    const navigationSubItems: SubMenuItem[] = [
      {
        name: '📚 Academics',
        description: 'Academic resources and tools',
        children: [
          { name: '🎓 LMS', href: 'http://13.235.188.79', description: 'Learning Management System' },
          { name: '📖 Courses', href: '#', description: 'Course management (Coming Soon)' },
          { name: 'Timetable', href: '#', description: 'Class schedules (Coming Soon)' },
          { name: 'Examinations', href: '#', description: 'Exam management (Coming Soon)' },
          { name: 'Results', href: '#', description: 'Academic results (Coming Soon)' },
          { name: 'Attendance', href: '#', description: 'Attendance tracking (Coming Soon)' },
        ],
      },
    ];

    if (rndSubItems.length > 0) {
      navigationSubItems.push({ name: '🔬 Research & Development', description: 'Research, Patents & Reviews', children: rndSubItems });
    }

    navigationSubItems.push({ name: '📝 Admissions', href: 'http://localhost:3000/', description: 'Student admissions portal' });

    if (!isStudent) {
      navigationSubItems.push({ name: '📋 Noting & Approval', href: '/noting', description: 'Create and track approval notes' });
    }

    // Event Management
    const canCreateEvent = isFaculty || isClubChairperson;
    const eventChildren: SubMenuItem[] = [
      { name: '🌐 Browse Events', href: '/events', description: 'Discover and join published events' },
      { name: '🎫 My Registrations', href: '/events/registrations', description: 'View your event tickets and QR codes' },
      { name: '🏆 My Certificates', href: '/events/my-certificates', description: 'View and download your event certificates' },
      { name: '🏪 Stall Application', href: '/events/stall-opportunities', description: 'Apply for stalls at events with stall opportunities' },
      { name: '📱 Event Feedback Scanner', href: '/event-feedback-scanner', description: 'Scan QR to open event feedback form' },
    ];
    if (canCreateEvent) {
      eventChildren.splice(1, 0, { name: '📝 My Created Events', href: '/events/my-events', description: 'Manage events you organized' });
    }
    if (hasVolunteerAssignments) {
      eventChildren.push({ name: '🤝 Volunteer', href: '/events/volunteer', description: 'Manage your volunteer duties & scan QR codes' });
    }
    navigationSubItems.push({ name: '📅 Event Management', description: 'Discover, organize, and attend university events', children: eventChildren });

    navigationSubItems.push({ name: '🔐 RFID', href: 'https://192.168.7.20:3000', description: 'RFID access system' });

    // DSW
    if (isStudent || isFaculty || isAdmin) {
      navigationSubItems.push({
        name: '🎓 Division of Student Welfare',
        description: 'Student Clubs & Activities',
        children: [
          { name: '🏠 DSW Dashboard', href: '/dsw', description: 'Division of Student Welfare overview' },
          { name: '🎭 All Clubs', href: '/dsw/clubs', description: 'Browse all student clubs' },
          { name: '⭐ My Clubs', href: '/dsw/my-clubs', description: 'Clubs I am involved in' },
          ...((isStudent || isFaculty) ? [{ name: '➕ Create New Club', href: '/dsw/create-club', description: 'Initiate club creation request' }] : []),
          ...(isAdmin ? [
            { name: '📂 Club Categories', href: '/dsw/categories', description: 'Manage club categories' },
            { name: '📊 Club Statistics', href: '/dsw/statistics', description: 'View clubs analytics' },
          ] : []),
        ],
      });
    }

    menuItems.push({ name: 'UMS Navigation', subItems: navigationSubItems });
  }

  // ── Administration ────────────────────────────────────────────────────────
  const gateEntryChildren: SubMenuItem[] = [
    { name: '➕ Create Pass', href: '/admin/gate-entry/create-pass', description: 'Generate visitor pass' },
    { name: '📝 All Passes', href: '/admin/gate-entry', description: 'View all entry passes' },
  ];
  if (hasFullGateEntryAccess) {
    gateEntryChildren.push({ name: '🔍 Verify Pass', href: '/admin/gate-entry/verify', description: 'Guard pass verification' });
  }
  if (isAdmin) {
    gateEntryChildren.push({ name: '📊 Analytics', href: '/admin/gate-entry/analytics', description: 'Comprehensive analytics & insights' });
  }

  const administrationSubItems: SubMenuItem[] = [];
  if (isAdmin) {
    administrationSubItems.push(
      { name: '📊 Analytics Dashboard', href: '/admin/analytics', description: 'System statistics & reports' },
      { name: '📋 Audit Logs', href: '/admin/audit-logs', description: 'Track system activities' },
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
      {
        name: '👥 User Management',
        description: 'Employees, Students & Permissions',
        children: [
          { name: '👨‍🏫 Employees', href: '/admin/employees', description: 'Manage faculty & staff' },
          { name: '👨‍🎓 Students', href: '/admin/students', description: 'Manage student records' },
          { name: '🛡️ User & Role Management', href: '/admin/roles', description: 'Assign permissions & create role templates' },
          { name: '📊 Reporting Structure', href: '/admin/reporting-structure', description: 'Manage reporting hierarchy' },
          { name: '📤 Bulk Import', href: '/admin/bulk-upload', description: 'Import data in bulk' },
        ],
      },
    );
  }
  administrationSubItems.push({ name: '🚪 Gate Entry', description: 'Manage campus gate entries', children: gateEntryChildren });
  menuItems.push({ name: 'Administration', subItems: administrationSubItems });

  // ── My Account (students only) ────────────────────────────────────────────
  if (isStudent) {
    menuItems.push({
      name: 'My Account',
      subItems: [
        { name: '⚙️ Settings', href: '/settings', description: 'Account preferences' },
        { name: '🔔 Notifications', href: '/notifications', description: 'View all notifications' },
      ],
    });
  }

  return menuItems;
}
