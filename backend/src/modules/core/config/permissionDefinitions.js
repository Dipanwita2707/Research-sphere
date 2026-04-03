/**
 * Department Permission Definitions
 * Each department can have custom permissions
 * These are checkboxes that can be assigned to users
 */

const SCHOOL_DEPARTMENT_PERMISSIONS = {
  // Common permissions for all school departments
  common: [
    { key: "view_dashboard", label: "View Dashboard", category: "General" },
    { key: "view_reports", label: "View Reports", category: "General" },
    { key: "export_data", label: "Export Data", category: "General" },
    {
      key: "applicant_analytics",
      label: "Applicant Analytics",
      category: "DRD Analytics",
    },
    {
      key: "drd_member_analytics",
      label: "DRD Member Analytics",
      category: "DRD Analytics",
    },
  ],

  // Student Management
  students: [
    { key: "view_students", label: "View Students", category: "Students" },
    { key: "add_students", label: "Add Students", category: "Students" },
    { key: "edit_students", label: "Edit Students", category: "Students" },
    { key: "delete_students", label: "Delete Students", category: "Students" },
    {
      key: "approve_students",
      label: "Approve Student Data",
      category: "Students",
    },
    {
      key: "view_student_records",
      label: "View Student Records",
      category: "Students",
    },
    {
      key: "edit_student_records",
      label: "Edit Student Records",
      category: "Students",
    },
    // Default IPR permissions for students
    { key: "file_ipr", label: "File IPR Applications", category: "Students" },
    { key: "view_own_ipr", label: "View Own IPR", category: "Students" },
    { key: "edit_own_ipr", label: "Edit Own IPR", category: "Students" },
  ],

  // Faculty Management
  faculty: [
    { key: "view_faculty", label: "View Faculty", category: "Faculty" },
    { key: "add_faculty", label: "Add Faculty", category: "Faculty" },
    { key: "edit_faculty", label: "Edit Faculty", category: "Faculty" },
    { key: "delete_faculty", label: "Delete Faculty", category: "Faculty" },
    { key: "assign_courses", label: "Assign Courses", category: "Faculty" },
    { key: "view_workload", label: "View Workload", category: "Faculty" },
  ],

  // Course Management
  courses: [
    { key: "view_courses", label: "View Courses", category: "Courses" },
    { key: "add_courses", label: "Add Courses", category: "Courses" },
    { key: "edit_courses", label: "Edit Courses", category: "Courses" },
    { key: "delete_courses", label: "Delete Courses", category: "Courses" },
    { key: "manage_syllabus", label: "Manage Syllabus", category: "Courses" },
  ],

  // Examination
  examinations: [
    { key: "view_exams", label: "View Examinations", category: "Examinations" },
    {
      key: "create_exams",
      label: "Create Examinations",
      category: "Examinations",
    },
    { key: "edit_exams", label: "Edit Examinations", category: "Examinations" },
    {
      key: "delete_exams",
      label: "Delete Examinations",
      category: "Examinations",
    },
    { key: "enter_marks", label: "Enter Marks", category: "Examinations" },
    { key: "approve_marks", label: "Approve Marks", category: "Examinations" },
    {
      key: "generate_results",
      label: "Generate Results",
      category: "Examinations",
    },
  ],
};

const CENTRAL_DEPARTMENT_PERMISSIONS = {
  // HR Department
  hr: [
    { key: "view_employees", label: "View Employees", category: "HR" },
    { key: "add_employees", label: "Add Employees", category: "HR" },
    { key: "edit_employees", label: "Edit Employees", category: "HR" },
    { key: "delete_employees", label: "Delete Employees", category: "HR" },
    { key: "manage_attendance", label: "Manage Attendance", category: "HR" },
    { key: "manage_leave", label: "Manage Leave", category: "HR" },
    { key: "manage_payroll", label: "Manage Payroll", category: "HR" },
    { key: "view_salary", label: "View Salary", category: "HR" },
    { key: "edit_salary", label: "Edit Salary", category: "HR" },
    { key: "approve_leave", label: "Approve Leave", category: "HR" },
    {
      key: "generate_hr_reports",
      label: "Generate HR Reports",
      category: "HR",
    },
  ],

  // ERP Department
  erp: [
    { key: "view_erp_modules", label: "View ERP Modules", category: "ERP" },
    { key: "configure_erp", label: "Configure ERP", category: "ERP" },
    { key: "manage_workflows", label: "Manage Workflows", category: "ERP" },
    { key: "system_admin", label: "System Administration", category: "ERP" },
    { key: "view_system_logs", label: "View System Logs", category: "ERP" },
    {
      key: "manage_integrations",
      label: "Manage Integrations",
      category: "ERP",
    },
  ],

  // DRD (Development & Research Department) - Simplified 4 IPR Permission Model
  drd: [
    // ========== IPR Permissions ==========
    // IPR Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    {
      key: "ipr_file_new",
      label: "IPR Filing",
      category: "IPR Permissions",
      type: "action",
      description:
        "Can file new IPR applications (Faculty/Student have this by default)",
    },

    // IPR Review - DRD Member can review applications from assigned schools
    {
      key: "ipr_review",
      label: "IPR Review",
      category: "IPR Permissions",
      type: "action",
      description:
        "DRD Member - Can review IPR applications from assigned schools",
    },

    // IPR Approve - DRD Head can give final approval/rejection
    {
      key: "ipr_approve",
      label: "IPR Approve",
      category: "IPR Permissions",
      type: "action",
      description:
        "DRD Head - Can give final approval/rejection on IPR applications",
    },

    // Assign Schools - DRD Head can assign schools to DRD member reviewers
    {
      key: "ipr_assign_school",
      label: "Assign Schools to DRD Members (IPR)",
      category: "IPR Permissions",
      type: "action",
      description:
        "DRD Head - Can assign schools to DRD member reviewers for IPR",
    },

    // ========== Research Paper Permissions ==========
    // Research Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    {
      key: "research_file_new",
      label: "Research Paper Filing",
      category: "Research Permissions",
      type: "action",
      description:
        "Can file new research paper contributions (Faculty/Student have this by default)",
    },

    // Research Review - DRD Member can review applications from assigned schools
    {
      key: "research_review",
      label: "Research Paper Review",
      category: "Research Permissions",
      type: "action",
      description:
        "DRD Member - Can review research paper contributions from assigned schools",
    },

    // Research Approve - DRD Head can give final approval/rejection
    {
      key: "research_approve",
      label: "Research Paper Approve",
      category: "Research Permissions",
      type: "action",
      description:
        "DRD Head - Can give final approval/rejection on research paper contributions",
    },

    // Assign Schools for Research - DRD Head can assign schools to DRD member reviewers
    {
      key: "research_assign_school",
      label: "Assign Schools to DRD Members (Research)",
      category: "Research Permissions",
      type: "action",
      description:
        "DRD Head - Can assign schools to DRD member reviewers for Research",
    },

    // ========== Book/Book Chapter Permissions ==========
    // Book Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    {
      key: "book_file_new",
      label: "Book/Chapter Filing",
      category: "Book Permissions",
      type: "action",
      description:
        "Can file new book/book chapter contributions (Faculty/Student have this by default)",
    },

    // Book Review - DRD Member can review book applications from assigned schools
    {
      key: "book_review",
      label: "Book/Chapter Review",
      category: "Book Permissions",
      type: "action",
      description:
        "DRD Member - Can review book/book chapter contributions from assigned schools",
    },

    // Book Approve - DRD Head can give final approval/rejection
    {
      key: "book_approve",
      label: "Book/Chapter Approve",
      category: "Book Permissions",
      type: "action",
      description:
        "DRD Head - Can give final approval/rejection on book/book chapter contributions",
    },

    // Assign Schools for Book - DRD Head can assign schools to DRD member reviewers
    {
      key: "book_assign_school",
      label: "Assign Schools to DRD Members (Book)",
      category: "Book Permissions",
      type: "action",
      description:
        "DRD Head - Can assign schools to DRD member reviewers for Book/Chapter",
    },

    // ========== Conference Permissions ==========
    // Conference Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    {
      key: "conference_file_new",
      label: "Conference Paper Filing",
      category: "Conference Permissions",
      type: "action",
      description:
        "Can file new conference paper contributions (Faculty/Student have this by default)",
    },

    // Conference Review - DRD Member can review conference applications from assigned schools
    {
      key: "conference_review",
      label: "Conference Paper Review",
      category: "Conference Permissions",
      type: "action",
      description:
        "DRD Member - Can review conference paper contributions from assigned schools",
    },

    // Conference Approve - DRD Head can give final approval/rejection
    {
      key: "conference_approve",
      label: "Conference Paper Approve",
      category: "Conference Permissions",
      type: "action",
      description:
        "DRD Head - Can give final approval/rejection on conference paper contributions",
    },

    // Assign Schools for Conference - DRD Head can assign schools to DRD member reviewers
    {
      key: "conference_assign_school",
      label: "Assign Schools to DRD Members (Conference)",
      category: "Conference Permissions",
      type: "action",
      description:
        "DRD Head - Can assign schools to DRD member reviewers for Conference",
    },

    // ========== Grant/Funding Permissions ==========
    // Grant Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    {
      key: "grant_file_new",
      label: "Grant Filing",
      category: "Grant Permissions",
      type: "action",
      description:
        "Can file new grant/funding applications (Faculty/Student have this by default)",
    },

    // Grant Review - DRD Member can review grant applications from assigned schools
    {
      key: "grant_review",
      label: "Grant Review",
      category: "Grant Permissions",
      type: "action",
      description:
        "DRD Member - Can review grant/funding applications from assigned schools",
    },

    // Grant Approve - DRD Head can give final approval/rejection
    {
      key: "grant_approve",
      label: "Grant Approve",
      category: "Grant Permissions",
      type: "action",
      description:
        "DRD Head - Can give final approval/rejection on grant/funding applications",
    },

    // Assign Schools for Grant - DRD Head can assign schools to DRD member reviewers
    {
      key: "grant_assign_school",
      label: "Assign Schools to DRD Members (Grant)",
      category: "Grant Permissions",
      type: "action",
      description:
        "DRD Head - Can assign schools to DRD member reviewers for Grant/Funding",
    },

    // ========== DRD Analytics Permissions ==========
    {
      key: "applicant_analytics",
      label: "Applicant Analytics",
      category: "DRD Analytics",
      type: "view",
      description:
        "Can view applicant analytics across assigned schools and departments (IPR, Research, Book, Conference, Grant). Scope is configured per-user in the analytics assignment manager.",
    },
    {
      key: "drd_member_analytics",
      label: "DRD Member Analytics",
      category: "DRD Analytics",
      type: "view",
      description:
        "Can view DRD reviewer workload and performance analytics for assigned schools and departments.",
    },
  ],

  // Finance Department
  finance: [
    { key: "view_accounts", label: "View Accounts", category: "Finance" },
    { key: "manage_accounts", label: "Manage Accounts", category: "Finance" },
    {
      key: "view_transactions",
      label: "View Transactions",
      category: "Finance",
    },
    {
      key: "approve_transactions",
      label: "Approve Transactions",
      category: "Finance",
    },
    { key: "manage_fees", label: "Manage Fees", category: "Finance" },
    {
      key: "generate_invoices",
      label: "Generate Invoices",
      category: "Finance",
    },
    {
      key: "view_financial_reports",
      label: "View Financial Reports",
      category: "Finance",
    },
    { key: "manage_budget", label: "Manage Budget", category: "Finance" },
  ],

  // Library
  library: [
    { key: "view_books", label: "View Books", category: "Library" },
    { key: "add_books", label: "Add Books", category: "Library" },
    { key: "edit_books", label: "Edit Books", category: "Library" },
    { key: "delete_books", label: "Delete Books", category: "Library" },
    { key: "issue_books", label: "Issue Books", category: "Library" },
    { key: "return_books", label: "Return Books", category: "Library" },
    { key: "manage_members", label: "Manage Members", category: "Library" },
    {
      key: "generate_library_reports",
      label: "Generate Reports",
      category: "Library",
    },
  ],

  // IT Department
  it: [
    {
      key: "manage_infrastructure",
      label: "Manage Infrastructure",
      category: "IT",
    },
    { key: "manage_networks", label: "Manage Networks", category: "IT" },
    { key: "manage_security", label: "Manage Security", category: "IT" },
    { key: "manage_users", label: "Manage Users", category: "IT" },
    { key: "manage_permissions", label: "Manage Permissions", category: "IT" },
    { key: "view_system_health", label: "View System Health", category: "IT" },
    { key: "manage_backups", label: "Manage Backups", category: "IT" },
  ],

  // Admissions
  admissions: [
    {
      key: "view_applications",
      label: "View Applications",
      category: "Admissions",
    },
    {
      key: "review_applications",
      label: "Review Applications",
      category: "Admissions",
    },
    {
      key: "approve_applications",
      label: "Approve Applications",
      category: "Admissions",
    },
    {
      key: "reject_applications",
      label: "Reject Applications",
      category: "Admissions",
    },
    {
      key: "manage_entrance_tests",
      label: "Manage Entrance Tests",
      category: "Admissions",
    },
    {
      key: "generate_admission_reports",
      label: "Generate Reports",
      category: "Admissions",
    },
  ],

  // Registrar
  registrar: [
    {
      key: "view_registrations",
      label: "View Registrations",
      category: "Registrar",
    },
    {
      key: "approve_registrations",
      label: "Approve Registrations",
      category: "Registrar",
    },
    {
      key: "issue_certificates",
      label: "Issue Certificates",
      category: "Registrar",
    },
    {
      key: "manage_transcripts",
      label: "Manage Transcripts",
      category: "Registrar",
    },
    {
      key: "verify_documents",
      label: "Verify Documents",
      category: "Registrar",
    },
    { key: "manage_records", label: "Manage Records", category: "Registrar" },
  ],

  // DSW (Dean Student Welfare) - Club and Student Activities Management
  dsw: [
    // Club Management
    {
      key: "dsw_view_clubs",
      label: "View All Clubs",
      category: "Club Management",
      description: "Can view all clubs across the university",
    },
    {
      key: "dsw_create_club",
      label: "Create Club",
      category: "Club Management",
      description: "Can create new clubs",
    },
    {
      key: "dsw_edit_club",
      label: "Edit Club",
      category: "Club Management",
      description: "Can edit club details",
    },
    {
      key: "dsw_delete_club",
      label: "Delete Club",
      category: "Club Management",
      description: "Can delete clubs",
    },
    {
      key: "dsw_manage_members",
      label: "Manage Club Members",
      category: "Club Management",
      description: "Can add/remove club members and assign roles",
    },
    {
      key: "dsw_approve_club",
      label: "Approve Club Creation",
      category: "Club Approval",
      description: "Can approve new club creation requests",
    },
    // Noting Flow
    {
      key: "dsw_create_noting",
      label: "Create Club Noting",
      category: "Noting Flow",
      description: "Can initiate noting workflow for clubs",
    },
    {
      key: "dsw_approve_noting",
      label: "Approve/Forward Noting",
      category: "Noting Flow",
      description: "Can approve or forward noting requests",
    },
    // Administration
    {
      key: "dsw_admin",
      label: "DSW Administration",
      category: "Administration",
      description: "Full DSW administrative access",
    },
  ],

  // Noting System - Document Approval Workflow
  noting: [
    // Core Noting Actions
    {
      key: "noting_create",
      label: "Create Noting",
      category: "Core Actions",
      description: "Can initiate new noting/approval requests",
    },
    {
      key: "noting_view_own",
      label: "View Own Notings",
      category: "Core Actions",
      description: "Can view notings created by self",
    },
    {
      key: "noting_view_department",
      label: "View Department Notings",
      category: "Core Actions",
      description: "Can view notings within assigned departments",
    },
    {
      key: "noting_view_all",
      label: "View All Notings",
      category: "Core Actions",
      description: "Can view all notings in the system",
    },
    // Approval Actions
    {
      key: "noting_approve",
      label: "Approve Noting",
      category: "Approval Actions",
      description: "Can approve, reject, recommend noting requests",
    },
    {
      key: "noting_forward",
      label: "Forward Noting",
      category: "Approval Actions",
      description: "Can forward noting to next approver",
    },
    {
      key: "noting_return",
      label: "Revert / Return Noting",
      category: "Approval Actions",
      description:
        "Can revert noting back to creator for modifications (also enables reject)",
    },
    {
      key: "noting_add_comment",
      label: "Add Comment / Recommend",
      category: "Approval Actions",
      description: "Can add recommendations and comments on noting requests",
    },
    {
      key: "noting_reject",
      label: "Reject Noting",
      category: "Approval Actions",
      description:
        "Can reject noting requests (also granted via Approve or Return permissions)",
    },
    {
      key: "noting_not_recommend",
      label: "Not Recommend",
      category: "Approval Actions",
      description:
        "Can mark a noting as not recommended (also granted via Approve permission)",
    },
    // Subcategory Approval Permissions — granular control over which noting types a user can approve
    {
      key: "event_approve",
      label: "Approve Event Notings",
      category: "Subcategory Approvals",
      description: "Can approve notings for events (subcategory: events)",
    },
    {
      key: "dsw_approve_noting",
      label: "Approve DSW Club Notings",
      category: "Subcategory Approvals",
      description: "Can approve notings for DSW club creation/change requests",
    },
    {
      key: "curriculum_approve",
      label: "Approve Curriculum Notings",
      category: "Subcategory Approvals",
      description: "Can approve notings for curriculum-related requests",
    },
    {
      key: "exam_approve",
      label: "Approve Exam Notings",
      category: "Subcategory Approvals",
      description: "Can approve notings for examination-related requests",
    },
    {
      key: "infrastructure_approve",
      label: "Approve Infrastructure Notings",
      category: "Subcategory Approvals",
      description: "Can approve notings for infrastructure-related requests",
    },
    {
      key: "accounts_purchase_approve",
      label: "Approve Accounts/Purchase Notings",
      category: "Subcategory Approvals",
      description: "Can approve notings for accounts and purchase requests",
    },
    {
      key: "student_related_approve",
      label: "Approve Student-Related Notings",
      category: "Subcategory Approvals",
      description: "Can approve notings for student-related requests",
    },
    {
      key: "non_academic_resources_approve",
      label: "Approve Non-Academic Resources Notings",
      category: "Subcategory Approvals",
      description: "Can approve notings for non-academic resource requests",
    },
    // Administration
    {
      key: "noting_admin",
      label: "Noting Administration",
      category: "Administration",
      description: "Full noting system administrative access",
    },
  ],

  // Events - University Event Management
  events: [
    // Event Creation & Management
    {
      key: "event_create",
      label: "Create Events",
      category: "Event Management",
      description: "Can create new events",
    },
    {
      key: "event_edit_own",
      label: "Edit Own Events",
      category: "Event Management",
      description: "Can edit events created by self",
    },
    {
      key: "event_edit_all",
      label: "Edit All Events",
      category: "Event Management",
      description: "Can edit any event",
    },
    {
      key: "event_delete",
      label: "Delete Events",
      category: "Event Management",
      description: "Can delete events",
    },
    {
      key: "event_view_all",
      label: "View All Events",
      category: "Event Management",
      description: "Can view all events including drafts",
    },
    // Approval & Publishing
    {
      key: "event_approve",
      label: "Approve Events",
      category: "Event Approval",
      description: "Can approve event requests",
    },
    {
      key: "event_publish",
      label: "Publish Events",
      category: "Event Approval",
      description: "Can publish events to make them visible",
    },
    // Registration & Attendance
    {
      key: "event_manage_registrations",
      label: "Manage Registrations",
      category: "Registrations",
      description: "Can manage event registrations",
    },
    // Administration
    {
      key: "event_admin",
      label: "Event Administration",
      category: "Administration",
      description: "Full event system administrative access",
    },
  ],
  
  // Gate Entry - Visitor Pass Management System (Role-Based Access Control)
  gateEntry: [
    // ========== Pass Creation ==========
    { 
      key: 'gate_entry.create', 
      label: 'Create Gate Pass', 
      category: 'Pass Management', 
      description: 'Can create visitor gate passes (All roles: Admin, Guard, Faculty, Student)',
      roles: ['admin', 'superadmin', 'staff', 'faculty', 'student']
    },
    
    // ========== Pass Viewing (Two levels) ==========
    { 
      key: 'gate_entry.view_all', 
      label: 'View All Passes', 
      category: 'Pass Management', 
      description: 'Can view all gate passes in the system (Admin, Guard only)',
      roles: ['admin', 'superadmin', 'staff']
    },
    { 
      key: 'gate_entry.view_own', 
      label: 'View Own Passes', 
      category: 'Pass Management', 
      description: 'Can view only own created passes (Faculty, Student)',
      roles: ['faculty', 'student']
    },
    
    // ========== Pass Verification (Check-in/Check-out) ==========
    { 
      key: 'gate_entry.verify', 
      label: 'Verify Passes (Check-in/Check-out)', 
      category: 'Verification', 
      description: 'Can scan QR codes and verify visitor entry/exit (Admin, Guard only)',
      roles: ['admin', 'superadmin', 'staff']
    },
    
    // ========== Pass Cancellation (Context-Dependent) ==========
    { 
      key: 'gate_entry.cancel', 
      label: 'Cancel Pass', 
      category: 'Pass Actions', 
      description: 'Cancel gate passes (Rules: Before check-in → Creator/Admin only; After check-in → Creator/Admin/Guard)',
      roles: ['admin', 'superadmin', 'staff', 'faculty', 'student']
    },
    
    // ========== Pass Extension ==========
    { 
      key: 'gate_entry.extend', 
      label: 'Extend Pass Duration', 
      category: 'Pass Actions', 
      description: 'Extend pass validity time (Creator or Admin only - Guards CANNOT extend)',
      roles: ['admin', 'superadmin', 'faculty', 'student']
    },
    
    // ========== Analytics & Reports ==========
    { 
      key: 'gate_entry.analytics', 
      label: 'View Analytics Dashboard', 
      category: 'Analytics', 
      description: 'Access gate entry statistics and reports (Admin only)',
      roles: ['admin', 'superadmin']
    },
    
    // ========== Administration ==========
    { 
      key: 'gate_entry.admin', 
      label: 'Gate Entry Administration', 
      category: 'Administration', 
      description: 'Full administrative access to gate entry system (Superadmin only)',
      roles: ['superadmin']
    },
  ],
};

/**
 * Get all permissions for a school department
 */
function getSchoolDeptPermissions() {
  const allPermissions = [];

  // Add common permissions
  allPermissions.push(...SCHOOL_DEPARTMENT_PERMISSIONS.common);

  // Add specific permissions
  Object.keys(SCHOOL_DEPARTMENT_PERMISSIONS).forEach((key) => {
    if (key !== "common") {
      allPermissions.push(...SCHOOL_DEPARTMENT_PERMISSIONS[key]);
    }
  });

  return allPermissions;
}

/**
 * Get permissions for a specific central department
 */
function getCentralDeptPermissions(departmentType) {
  const type = departmentType?.toLowerCase();
  return CENTRAL_DEPARTMENT_PERMISSIONS[type] || [];
}

/**
 * Get all available central department types and their permissions
 */
function getAllCentralDeptPermissions() {
  return CENTRAL_DEPARTMENT_PERMISSIONS;
}

module.exports = {
  SCHOOL_DEPARTMENT_PERMISSIONS,
  CENTRAL_DEPARTMENT_PERMISSIONS,
  getSchoolDeptPermissions,
  getCentralDeptPermissions,
  getAllCentralDeptPermissions,
};
