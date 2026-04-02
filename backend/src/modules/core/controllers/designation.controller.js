const prisma = require('../../../shared/config/database');
const {
  DSW_PERMISSIONS,
  NOTING_PERMISSIONS,
  EVENT_PERMISSIONS
} = require('../../../shared/config/permissions.config');

// Permission categories and their options
const PERMISSION_CATEGORIES = {
  students: {
    label: 'Student Management',
    permissions: [
      { key: 'view_students', label: 'View Students' },
      { key: 'add_students', label: 'Add Students' },
      { key: 'edit_students', label: 'Edit Students' },
      { key: 'delete_students', label: 'Delete Students' },
      { key: 'approve_student_data', label: 'Approve Student Data' },
      { key: 'bulk_upload_students', label: 'Bulk Upload Students' },
      { key: 'export_student_data', label: 'Export Student Data' },
    ]
  },
  faculty: {
    label: 'Faculty Management',
    permissions: [
      { key: 'view_faculty', label: 'View Faculty' },
      { key: 'add_faculty', label: 'Add Faculty' },
      { key: 'edit_faculty', label: 'Edit Faculty' },
      { key: 'delete_faculty', label: 'Delete Faculty' },
      { key: 'assign_subjects', label: 'Assign Subjects' },
      { key: 'view_faculty_attendance', label: 'View Faculty Attendance' },
    ]
  },
  staff: {
    label: 'Staff Management',
    permissions: [
      { key: 'view_staff', label: 'View Staff' },
      { key: 'add_staff', label: 'Add Staff' },
      { key: 'edit_staff', label: 'Edit Staff' },
      { key: 'delete_staff', label: 'Delete Staff' },
      { key: 'manage_attendance', label: 'Manage Attendance' },
    ]
  },
  admissions: {
    label: 'Admissions',
    permissions: [
      { key: 'view_applications', label: 'View Applications' },
      { key: 'process_applications', label: 'Process Applications' },
      { key: 'approve_admissions', label: 'Approve Admissions' },
      { key: 'generate_offer_letters', label: 'Generate Offer Letters' },
      { key: 'manage_admission_criteria', label: 'Manage Admission Criteria' },
    ]
  },
  academics: {
    label: 'Academics',
    permissions: [
      { key: 'view_courses', label: 'View Courses' },
      { key: 'manage_courses', label: 'Manage Courses' },
      { key: 'manage_timetable', label: 'Manage Timetable' },
      { key: 'view_results', label: 'View Results' },
      { key: 'enter_marks', label: 'Enter Marks' },
      { key: 'approve_results', label: 'Approve Results' },
    ]
  },
  examinations: {
    label: 'Examinations',
    permissions: [
      { key: 'schedule_exams', label: 'Schedule Exams' },
      { key: 'generate_hall_tickets', label: 'Generate Hall Tickets' },
      { key: 'manage_exam_seating', label: 'Manage Exam Seating' },
      { key: 'view_exam_results', label: 'View Exam Results' },
      { key: 'publish_results', label: 'Publish Results' },
    ]
  },
  research: {
    label: 'Research & Patents',
    permissions: [
      { key: 'view_research', label: 'View Research Papers' },
      { key: 'submit_research', label: 'Submit Research Papers' },
      { key: 'review_research', label: 'Review Research Papers' },
      { key: 'approve_research', label: 'Approve Research Papers' },
      { key: 'manage_patents', label: 'Manage Patents' },
    ]
  },
  library: {
    label: 'Library Management',
    permissions: [
      { key: 'view_books', label: 'View Books' },
      { key: 'issue_books', label: 'Issue Books' },
      { key: 'return_books', label: 'Return Books' },
      { key: 'manage_inventory', label: 'Manage Inventory' },
    ]
  },
  finance: {
    label: 'Finance',
    permissions: [
      { key: 'view_fee_records', label: 'View Fee Records' },
      { key: 'collect_fees', label: 'Collect Fees' },
      { key: 'generate_receipts', label: 'Generate Receipts' },
      { key: 'manage_fee_structure', label: 'Manage Fee Structure' },
      { key: 'view_financial_reports', label: 'View Financial Reports' },
    ]
  },
  reports: {
    label: 'Reports & Analytics',
    permissions: [
      { key: 'view_reports', label: 'View Reports' },
      { key: 'generate_custom_reports', label: 'Generate Custom Reports' },
      { key: 'export_data', label: 'Export Data' },
      { key: 'view_analytics', label: 'View Analytics' },
    ]
  },
  system: {
    label: 'System Administration',
    permissions: [
      { key: 'manage_users', label: 'Manage Users' },
      { key: 'manage_roles', label: 'Manage Roles' },
      { key: 'manage_permissions', label: 'Manage Permissions' },
      { key: 'view_audit_logs', label: 'View Audit Logs' },
      { key: 'system_settings', label: 'System Settings' },
      { key: 'backup_restore', label: 'Backup & Restore' },
    ]
  },
  // ====================================
  // DSW (Dean of Student Welfare) Permissions
  // ====================================
  dsw: {
    label: 'DSW & Club Management',
    permissions: [
      { key: 'dsw_create_club_noting', label: 'Create Club Noting', description: 'Can initiate club creation notings' },
      { key: 'dsw_view_club', label: 'View Clubs', description: 'Can view club details and member lists' },
      { key: 'dsw_view_all_clubs', label: 'View All Clubs', description: 'Can view all clubs across the institution' },
      { key: 'dsw_manage_members', label: 'Manage Club Members', description: 'Can add/remove club members' },
      { key: 'dsw_approve_club', label: 'Approve Club Creation', description: 'Can approve or reject club creation requests' },
      { key: 'dsw_suspend_club', label: 'Suspend/Archive Club', description: 'Can suspend or archive clubs' },
      { key: 'dsw_request_club_change', label: 'Request Club Changes', description: 'Can request modifications to club details' },
      { key: 'dsw_approve_club_change', label: 'Approve Club Changes', description: 'Can approve club modification requests' },
      { key: 'dsw_view_audit_logs', label: 'View DSW Audit Logs', description: 'Can view club audit and change history' },
    ]
  },
  // ====================================
  // Noting System Permissions
  // ====================================
  noting: {
    label: 'Noting & Approvals',
    permissions: [
      { key: 'noting_create', label: 'Create Noting', description: 'Can initiate new notings for approval workflows' },
      { key: 'noting_view_own', label: 'View Own Notings', description: 'Can view notings created by self' },
      { key: 'noting_view_department', label: 'View Department Notings', description: 'Can view all notings within assigned department' },
      { key: 'noting_view_all', label: 'View All Notings', description: 'Can view all notings across institution' },
      { key: 'noting_approve', label: 'Approve Notings', description: 'Can approve/reject notings at assigned approval level' },
      { key: 'noting_forward', label: 'Forward Notings', description: 'Can forward notings to next approval level' },
      { key: 'noting_return', label: 'Return Notings', description: 'Can return notings to previous level with comments' },
      { key: 'noting_add_comment', label: 'Add Noting Comments', description: 'Can add comments/observations to notings' },
      { key: 'noting_reject', label: 'Reject Notings', description: 'Can reject noting requests (also granted via Approve or Return)' },
      { key: 'noting_not_recommend', label: 'Not Recommend', description: 'Can mark notings as not recommended (also granted via Approve)' },
    ]
  },
  // ====================================
  // Event Management Permissions
  // ====================================
  events: {
    label: 'Event Management',
    permissions: [
      { key: 'event_create', label: 'Create Events', description: 'Can create new events (requires approved noting)' },
      { key: 'event_manage_own', label: 'Manage Own Events', description: 'Can edit/update events created by self' },
      { key: 'event_manage_all', label: 'Manage All Events', description: 'Can edit/update any event' },
      { key: 'event_publish', label: 'Publish Events', description: 'Can publish events to make them visible to students' },
      { key: 'event_cancel', label: 'Cancel Events', description: 'Can cancel scheduled events' },
      { key: 'event_view_all', label: 'View All Events', description: 'Can view all events including unpublished' },
      { key: 'event_manage_attendance', label: 'Manage Event Attendance', description: 'Can mark attendance and manage check-ins' },
      { key: 'event_assign_volunteers', label: 'Assign Event Volunteers', description: 'Can assign volunteers for event management' },
      { key: 'event_view_reports', label: 'View Event Reports', description: 'Can view event analytics and attendance reports' },
    ]
  }
};

// Default permission templates for common designations
const DESIGNATION_TEMPLATES = {
  'Registrar': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      students: ['view_students', 'add_students', 'edit_students', 'approve_student_data', 'export_student_data'],
      academics: ['view_courses', 'manage_courses', 'view_results', 'approve_results'],
      examinations: ['schedule_exams', 'generate_hall_tickets', 'view_exam_results', 'publish_results'],
      reports: ['view_reports', 'generate_custom_reports', 'export_data'],
      // Noting permissions for approvals
      noting: ['noting_view_all', 'noting_approve', 'noting_forward', 'noting_return', 'noting_add_comment', 'noting_reject', 'noting_not_recommend'],
    }
  },
  'Assistant Registrar': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      students: ['view_students', 'edit_students', 'export_student_data'],
      academics: ['view_courses', 'view_results'],
      examinations: ['generate_hall_tickets', 'view_exam_results'],
      reports: ['view_reports'],
      noting: ['noting_view_department', 'noting_forward', 'noting_add_comment'],
    }
  },
  'Admission Officer': {
    departments: ['ADMISSION'],
    defaultPermissions: {
      admissions: ['view_applications', 'process_applications', 'generate_offer_letters'],
      students: ['view_students', 'add_students'],
      reports: ['view_reports'],
      noting: ['noting_create', 'noting_view_own'],
    }
  },
  'Admission Head': {
    departments: ['ADMISSION'],
    defaultPermissions: {
      admissions: ['view_applications', 'process_applications', 'approve_admissions', 'generate_offer_letters', 'manage_admission_criteria'],
      students: ['view_students', 'add_students', 'approve_student_data'],
      reports: ['view_reports', 'generate_custom_reports'],
      noting: ['noting_create', 'noting_view_department', 'noting_approve', 'noting_forward'],
    }
  },
  'HR Manager': {
    departments: ['HR_TEACHING', 'HR_NON_TEACHING'],
    defaultPermissions: {
      faculty: ['view_faculty', 'add_faculty', 'edit_faculty', 'view_faculty_attendance'],
      staff: ['view_staff', 'add_staff', 'edit_staff', 'manage_attendance'],
      reports: ['view_reports', 'export_data'],
      noting: ['noting_create', 'noting_view_department', 'noting_approve', 'noting_forward'],
    }
  },
  'HR Executive': {
    departments: ['HR_TEACHING', 'HR_NON_TEACHING'],
    defaultPermissions: {
      faculty: ['view_faculty', 'edit_faculty'],
      staff: ['view_staff', 'edit_staff'],
      noting: ['noting_create', 'noting_view_own'],
    }
  },
  'Professor': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      students: ['view_students'],
      academics: ['view_courses', 'manage_timetable', 'enter_marks'],
      research: ['view_research', 'submit_research', 'review_research'],
      // Professors can create notings and clubs
      noting: ['noting_create', 'noting_view_own', 'noting_add_comment'],
      dsw: ['dsw_create_club_noting', 'dsw_view_club', 'dsw_request_club_change'],
      events: ['event_create', 'event_manage_own', 'event_publish', 'event_assign_volunteers'],
    }
  },
  'Assistant Professor': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      students: ['view_students'],
      academics: ['view_courses', 'enter_marks'],
      research: ['view_research', 'submit_research'],
      noting: ['noting_create', 'noting_view_own'],
      dsw: ['dsw_create_club_noting', 'dsw_view_club'],
      events: ['event_create', 'event_manage_own', 'event_publish'],
    }
  },
  'Dean': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      students: ['view_students', 'approve_student_data', 'export_student_data'],
      faculty: ['view_faculty', 'assign_subjects'],
      academics: ['view_courses', 'manage_courses', 'view_results', 'approve_results'],
      examinations: ['schedule_exams', 'view_exam_results', 'publish_results'],
      research: ['view_research', 'review_research', 'approve_research', 'manage_patents'],
      reports: ['view_reports', 'generate_custom_reports', 'view_analytics'],
      // Dean has approval authority
      noting: ['noting_create', 'noting_view_department', 'noting_approve', 'noting_forward', 'noting_return', 'noting_add_comment', 'noting_reject', 'noting_not_recommend'],
      dsw: ['dsw_view_club', 'dsw_view_all_clubs', 'dsw_approve_club', 'dsw_view_audit_logs'],
      events: ['event_create', 'event_manage_own', 'event_view_all', 'event_publish', 'event_view_reports'],
    }
  },
  'HOD': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      students: ['view_students', 'edit_students'],
      faculty: ['view_faculty', 'assign_subjects', 'view_faculty_attendance'],
      academics: ['view_courses', 'manage_courses', 'view_results'],
      examinations: ['schedule_exams', 'view_exam_results'],
      research: ['view_research', 'review_research'],
      reports: ['view_reports', 'generate_custom_reports'],
      // HOD has department-level approval
      noting: ['noting_create', 'noting_view_department', 'noting_approve', 'noting_forward', 'noting_add_comment'],
      dsw: ['dsw_view_club', 'dsw_create_club_noting', 'dsw_request_club_change'],
      events: ['event_create', 'event_manage_own', 'event_publish', 'event_assign_volunteers'],
    }
  },
  'Finance Manager': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      finance: ['view_fee_records', 'collect_fees', 'generate_receipts', 'manage_fee_structure', 'view_financial_reports'],
      students: ['view_students'],
      reports: ['view_reports', 'export_data'],
      noting: ['noting_create', 'noting_view_department', 'noting_approve', 'noting_forward'],
    }
  },
  'Accountant': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      finance: ['view_fee_records', 'collect_fees', 'generate_receipts'],
      reports: ['view_reports'],
      noting: ['noting_view_own'],
    }
  },
  'Librarian': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      library: ['view_books', 'issue_books', 'return_books', 'manage_inventory'],
      students: ['view_students'],
      faculty: ['view_faculty'],
      noting: ['noting_create', 'noting_view_own'],
    }
  },
  'System Administrator': {
    departments: ['REGISTRAR', 'ADMISSION', 'HR_TEACHING', 'HR_NON_TEACHING'],
    defaultPermissions: {
      system: ['manage_users', 'manage_roles', 'manage_permissions', 'view_audit_logs', 'system_settings', 'backup_restore'],
      reports: ['view_reports', 'generate_custom_reports', 'export_data', 'view_analytics'],
      // Full admin access to all modules
      noting: ['noting_view_all', 'noting_approve', 'noting_forward', 'noting_return', 'noting_add_comment', 'noting_reject', 'noting_not_recommend'],
      dsw: ['dsw_view_club', 'dsw_view_all_clubs', 'dsw_approve_club', 'dsw_suspend_club', 'dsw_approve_club_change', 'dsw_view_audit_logs'],
      events: ['event_view_all', 'event_manage_all', 'event_view_reports'],
    }
  },
  // ====================================
  // DSW Office Templates
  // ====================================
  'DSW Officer': {
    departments: ['DSW'],
    defaultPermissions: {
      dsw: ['dsw_view_club', 'dsw_view_all_clubs', 'dsw_approve_club', 'dsw_suspend_club', 'dsw_approve_club_change', 'dsw_view_audit_logs'],
      noting: ['noting_create', 'noting_view_department', 'noting_approve', 'noting_forward', 'noting_add_comment'],
      events: ['event_view_all', 'event_manage_all', 'event_publish', 'event_cancel', 'event_view_reports'],
      students: ['view_students'],
    }
  },
  'DSW Assistant': {
    departments: ['DSW'],
    defaultPermissions: {
      dsw: ['dsw_view_club', 'dsw_view_all_clubs', 'dsw_view_audit_logs'],
      noting: ['noting_create', 'noting_view_own', 'noting_forward'],
      events: ['event_view_all', 'event_manage_attendance', 'event_assign_volunteers'],
      students: ['view_students'],
    }
  },
  // ====================================
  // Faculty Club Facilitator Template
  // ====================================
  'Faculty Facilitator': {
    departments: ['REGISTRAR'],
    defaultPermissions: {
      dsw: ['dsw_create_club_noting', 'dsw_view_club', 'dsw_manage_members', 'dsw_request_club_change'],
      noting: ['noting_create', 'noting_view_own', 'noting_add_comment'],
      events: ['event_create', 'event_manage_own', 'event_publish', 'event_assign_volunteers', 'event_manage_attendance'],
      students: ['view_students'],
    }
  }
};

/**
 * Get all permission categories
 * Currently managed by Superadmin
 * TODO: Transfer to HR Module when implemented
 */
exports.getPermissionCategories = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: PERMISSION_CATEGORIES
    });
  } catch (error) {
    console.error('Error fetching permission categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permission categories'
    });
  }
};

/**
 * Get all designation templates
 */
exports.getDesignationTemplates = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: DESIGNATION_TEMPLATES
    });
  } catch (error) {
    console.error('Error fetching designation templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designation templates'
    });
  }
};

/**
 * Get default permissions for a designation
 */
exports.getDesignationPermissions = async (req, res) => {
  try {
    const { designation } = req.params;

    if (!DESIGNATION_TEMPLATES[designation]) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: DESIGNATION_TEMPLATES[designation]
    });
  } catch (error) {
    console.error('Error fetching designation permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designation permissions'
    });
  }
};

/**
 * Get user permissions with designation defaults
 */
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user details with employee info
    const user = await prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        employeeDetails: true,
        userDepartmentPermissions: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get designation-based default permissions
    const designation = user.employeeDetails?.designation;
    const designationDefaults = designation && DESIGNATION_TEMPLATES[designation]
      ? DESIGNATION_TEMPLATES[designation].defaultPermissions
      : {};

    // Get user's custom permissions from database
    const customPermissions = {};
    user.userDepartmentPermissions.forEach(dp => {
      if (dp.permissions && typeof dp.permissions === 'object') {
        Object.assign(customPermissions, dp.permissions);
      }
    });

    // Merge designation defaults with custom permissions
    const mergedPermissions = { ...designationDefaults };
    Object.keys(customPermissions).forEach(category => {
      if (mergedPermissions[category]) {
        mergedPermissions[category] = [...new Set([
          ...mergedPermissions[category],
          ...customPermissions[category]
        ])];
      } else {
        mergedPermissions[category] = customPermissions[category];
      }
    });

    res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        designation: designation,
        role: user.role,
        designationDefaults: designationDefaults,
        customPermissions: customPermissions,
        effectivePermissions: mergedPermissions
      }
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user permissions'
    });
  }
};

/**
 * Update user permissions
 * Currently managed by Superadmin only
 * TODO: Transfer to HR Module when implemented
 */
exports.updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { department, permissions } = req.body;

    // Validate user exists
    const user = await prisma.userLogin.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update or create permission record
    const updatedPermission = await prisma.userDepartmentPermission.upsert({
      where: {
        userId_department: {
          userId: userId,
          department: department
        }
      },
      update: {
        permissions: permissions,
        assignedBy: req.user.id,
        assignedAt: new Date()
      },
      create: {
        userId: userId,
        department: department,
        permissions: permissions,
        isActive: true,
        assignedBy: req.user.id,
        assignedAt: new Date()
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_PERMISSIONS',
        entityType: 'UserDepartmentPermission',
        entityId: updatedPermission.id,
        changes: {
          userId: userId,
          department: department,
          permissions: permissions
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.status(200).json({
      success: true,
      message: 'Permissions updated successfully',
      data: updatedPermission
    });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user permissions'
    });
  }
};

/**
 * Apply designation template to user
 * Currently managed by Superadmin only
 * TODO: Transfer to HR Module when implemented for HR personnel to manage
 */
exports.applyDesignationTemplate = async (req, res) => {
  try {
    const { userId } = req.params;
    const { designation } = req.body;

    // Validate designation template exists
    if (!DESIGNATION_TEMPLATES[designation]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid designation template'
      });
    }

    // Get user
    const user = await prisma.userLogin.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const template = DESIGNATION_TEMPLATES[designation];

    // Apply permissions for each department in template
    for (const dept of template.departments) {
      await prisma.userDepartmentPermission.upsert({
        where: {
          userId_department: {
            userId: userId,
            department: dept
          }
        },
        update: {
          permissions: template.defaultPermissions,
          assignedBy: req.user.id,
          assignedAt: new Date()
        },
        create: {
          userId: userId,
          department: dept,
          permissions: template.defaultPermissions,
          isActive: true,
          assignedBy: req.user.id,
          assignedAt: new Date()
        }
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'APPLY_DESIGNATION_TEMPLATE',
        entityType: 'UserDepartmentPermission',
        entityId: userId,
        changes: {
          designation: designation,
          template: template
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.status(200).json({
      success: true,
      message: 'Designation template applied successfully',
      data: {
        designation: designation,
        appliedPermissions: template.defaultPermissions
      }
    });
  } catch (error) {
    console.error('Error applying designation template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply designation template'
    });
  }
};
