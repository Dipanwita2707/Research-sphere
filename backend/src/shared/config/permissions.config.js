/**
 * IPR, Research & DRD Permission Configuration
 * Simplified to 4 core IPR permissions + 4 Research permissions
 */

const IPR_PERMISSIONS = {
  // Core IPR Permissions - Only 4 checkboxes
  IPR_CORE: {
    category: "IPR Permissions",
    permissions: {
      ipr_file_new: {
        key: "ipr_file_new",
        label: "IPR Filing",
        description:
          "Can file new IPR applications (Faculty/Student have this by default)",
      },
      ipr_review: {
        key: "ipr_review",
        label: "IPR Review",
        description:
          "DRD Member - Can review IPR applications from assigned schools",
      },
      ipr_approve: {
        key: "ipr_approve",
        label: "IPR Approve",
        description:
          "DRD Head - Can give final approval/rejection on IPR applications",
      },
      ipr_assign_school: {
        key: "ipr_assign_school",
        label: "Assign Schools to DRD Members (IPR)",
        description:
          "DRD Head - Can assign schools to DRD member reviewers for IPR",
      },
    },
  },
};

// Research Contribution Permissions - 4 checkboxes (parallel to IPR)
const RESEARCH_PERMISSIONS = {
  RESEARCH_CORE: {
    category: "Research Permissions",
    permissions: {
      research_file_new: {
        key: "research_file_new",
        label: "Research Paper Filing",
        description:
          "Can file new research paper contributions (Faculty/Student have this by default)",
      },
      research_review: {
        key: "research_review",
        label: "Research Paper Review",
        description:
          "DRD Member - Can review research paper contributions from assigned schools",
      },
      research_approve: {
        key: "research_approve",
        label: "Research Paper Approve",
        description:
          "DRD Head - Can give final approval/rejection on research paper contributions",
      },
      research_assign_school: {
        key: "research_assign_school",
        label: "Assign Schools to DRD Members (Research)",
        description:
          "DRD Head - Can assign schools to DRD member reviewers for Research",
      },
    },
  },
};

// Book/Book Chapter Permissions - 4 checkboxes (parallel to IPR and Research)
const BOOK_PERMISSIONS = {
  BOOK_CORE: {
    category: "Book Permissions",
    permissions: {
      book_file_new: {
        key: "book_file_new",
        label: "Book/Chapter Filing",
        description:
          "Can file new book/book chapter contributions (Faculty/Student have this by default)",
      },
      book_review: {
        key: "book_review",
        label: "Book/Chapter Review",
        description:
          "DRD Member - Can review book/book chapter contributions from assigned schools",
      },
      book_approve: {
        key: "book_approve",
        label: "Book/Chapter Approve",
        description:
          "DRD Head - Can give final approval/rejection on book/book chapter contributions",
      },
      book_assign_school: {
        key: "book_assign_school",
        label: "Assign Schools to DRD Members (Book)",
        description:
          "DRD Head - Can assign schools to DRD member reviewers for Book/Chapter",
      },
    },
  },
};

// Conference Paper Permissions - 4 checkboxes (parallel to IPR, Research, and Book)
const CONFERENCE_PERMISSIONS = {
  CONFERENCE_CORE: {
    category: "Conference Permissions",
    permissions: {
      conference_file_new: {
        key: "conference_file_new",
        label: "Conference Paper Filing",
        description:
          "Can file new conference paper contributions (Faculty/Student have this by default)",
      },
      conference_review: {
        key: "conference_review",
        label: "Conference Paper Review",
        description:
          "DRD Member - Can review conference paper contributions from assigned schools",
      },
      conference_approve: {
        key: "conference_approve",
        label: "Conference Paper Approve",
        description:
          "DRD Head - Can give final approval/rejection on conference paper contributions",
      },
      conference_assign_school: {
        key: "conference_assign_school",
        label: "Assign Schools to DRD Members (Conference)",
        description:
          "DRD Head - Can assign schools to DRD member reviewers for Conference",
      },
    },
  },
};

// Monthly Report Permissions - View progress tracker reports by school/department
const MONTHLY_REPORT_PERMISSIONS = {
  MONTHLY_REPORT_CORE: {
    category: "Monthly Report Permissions",
    permissions: {
      monthly_report_view: {
        key: "monthly_report_view",
        label: "View Monthly Reports",
        description:
          "Can view progress tracker reports for assigned schools/departments",
      },
    },
  },
};

// ====================================
// DSW (Dean of Student Welfare) Permissions
// Centralized club and student activity management
// ====================================
const DSW_PERMISSIONS = {
  DSW_CLUB: {
    category: "DSW Club Management",
    permissions: {
      dsw_create_club_noting: {
        key: "dsw_create_club_noting",
        label: "Create Club Noting",
        description:
          "Can initiate club creation notings (Faculty have this by default)",
      },
      dsw_view_club: {
        key: "dsw_view_club",
        label: "View Clubs",
        description: "Can view club details and member lists",
      },
      dsw_view_all_clubs: {
        key: "dsw_view_all_clubs",
        label: "View All Clubs",
        description:
          "Can view all clubs across the institution (Admin/DSW Office)",
      },
      dsw_manage_members: {
        key: "dsw_manage_members",
        label: "Manage Club Members",
        description:
          "Can add/remove club members (Chairperson, Faculty Facilitator)",
      },
      dsw_approve_club: {
        key: "dsw_approve_club",
        label: "Approve Club Creation",
        description:
          "Can approve or reject club creation requests (DSW Office)",
      },
      dsw_suspend_club: {
        key: "dsw_suspend_club",
        label: "Suspend/Archive Club",
        description: "Can suspend or archive clubs (DSW Office, Admin)",
      },
      dsw_request_club_change: {
        key: "dsw_request_club_change",
        label: "Request Club Changes",
        description: "Can request modifications to club details via noting",
      },
      dsw_approve_club_change: {
        key: "dsw_approve_club_change",
        label: "Approve Club Changes",
        description:
          "Can approve club modification requests (Admin, DSW Office)",
      },
      dsw_view_audit_logs: {
        key: "dsw_view_audit_logs",
        label: "View DSW Audit Logs",
        description:
          "Can view club audit and change history (Admin, DSW Office)",
      },
    },
  },
};

// ====================================
// Noting System Permissions
// Document approval workflow management
// ====================================
const NOTING_PERMISSIONS = {
  NOTING_CORE: {
    category: "Noting Permissions",
    permissions: {
      noting_create: {
        key: "noting_create",
        label: "Create Noting",
        description: "Can initiate new notings for approval workflows",
      },
      noting_view_own: {
        key: "noting_view_own",
        label: "View Own Notings",
        description: "Can view notings created by self",
      },
      noting_view_department: {
        key: "noting_view_department",
        label: "View Department Notings",
        description: "Can view all notings within assigned department",
      },
      noting_view_all: {
        key: "noting_view_all",
        label: "View All Notings",
        description:
          "Can view all notings across institution (Admin, Registrar)",
      },
      noting_approve: {
        key: "noting_approve",
        label: "Approve Notings",
        description: "Can approve/reject notings at assigned approval level",
      },
      noting_forward: {
        key: "noting_forward",
        label: "Forward Notings",
        description: "Can forward notings to next approval level",
      },
      noting_return: {
        key: "noting_return",
        label: "Return Notings",
        description: "Can return notings to previous level with comments",
      },
      noting_add_comment: {
        key: "noting_add_comment",
        label: "Add Noting Comments",
        description: "Can add comments/observations to notings",
      },
      noting_reject: {
        key: "noting_reject",
        label: "Reject Notings",
        description:
          "Can reject noting requests (also granted via noting_approve or noting_return)",
      },
      noting_not_recommend: {
        key: "noting_not_recommend",
        label: "Not Recommend Notings",
        description:
          "Can mark notings as not recommended (also granted via noting_approve)",
      },
    },
  },
  NOTING_SUBCATEGORY_APPROVALS: {
    category: "Subcategory Approval Permissions",
    permissions: {
      event_approve: {
        key: "event_approve",
        label: "Approve Event Notings",
        description: "Can approve notings for events",
      },
      dsw_approve_noting: {
        key: "dsw_approve_noting",
        label: "Approve DSW Club Notings",
        description: "Can approve notings for DSW club creation/change requests",
      },
      curriculum_approve: {
        key: "curriculum_approve",
        label: "Approve Curriculum Notings",
        description: "Can approve notings for curriculum-related requests",
      },
      exam_approve: {
        key: "exam_approve",
        label: "Approve Exam Notings",
        description: "Can approve notings for examination-related requests",
      },
      infrastructure_approve: {
        key: "infrastructure_approve",
        label: "Approve Infrastructure Notings",
        description: "Can approve notings for infrastructure-related requests",
      },
      accounts_purchase_approve: {
        key: "accounts_purchase_approve",
        label: "Approve Accounts/Purchase Notings",
        description: "Can approve notings for accounts and purchase requests",
      },
      student_related_approve: {
        key: "student_related_approve",
        label: "Approve Student-Related Notings",
        description: "Can approve notings for student-related requests",
      },
      non_academic_resources_approve: {
        key: "non_academic_resources_approve",
        label: "Approve Non-Academic Resources Notings",
        description: "Can approve notings for non-academic resource requests",
      },
    },
  },
};

// ====================================
// Event Management Permissions
// Campus event creation and management
// ====================================
const EVENT_PERMISSIONS = {
  EVENT_CORE: {
    category: "Event Management",
    permissions: {
      event_create: {
        key: "event_create",
        label: "Create Events",
        description: "Can create new events (requires approved noting)",
      },
      event_manage_own: {
        key: "event_manage_own",
        label: "Manage Own Events",
        description: "Can edit/update events created by self",
      },
      event_manage_all: {
        key: "event_manage_all",
        label: "Manage All Events",
        description: "Can edit/update any event (Admin, DSW Office)",
      },
      event_publish: {
        key: "event_publish",
        label: "Publish Events",
        description: "Can publish events to make them visible to students",
      },
      event_cancel: {
        key: "event_cancel",
        label: "Cancel Events",
        description: "Can cancel scheduled events",
      },
      event_view_all: {
        key: "event_view_all",
        label: "View All Events",
        description: "Can view all events including unpublished (Admin)",
      },
      event_manage_attendance: {
        key: "event_manage_attendance",
        label: "Manage Event Attendance",
        description: "Can mark attendance and manage check-ins",
      },
      event_assign_volunteers: {
        key: "event_assign_volunteers",
        label: "Assign Event Volunteers",
        description: "Can assign volunteers for event management",
      },
      event_view_reports: {
        key: "event_view_reports",
        label: "View Event Reports",
        description: "Can view event analytics and attendance reports",
      },
    },
  },
};

// ====================================
// Reporting Structure Permissions
// Organizational hierarchy and reporting relationships
// ====================================
const REPORTING_STRUCTURE_PERMISSIONS = {
  REPORTING_CORE: {
    category: "Reporting Structure",
    permissions: {
      manage_reporting_structure: {
        key: "manage_reporting_structure",
        label: "Manage Reporting Structure",
        description:
          "Can assign and modify reporting relationships (who reports to whom)",
      },
      view_reporting_structure: {
        key: "view_reporting_structure",
        label: "View Reporting Structure",
        description: "Can view full organizational reporting hierarchy tree",
      },
    },
  },
};

// ====================================
// TMS (Ticket Management System) Permissions
// Student grievance, assistance, enquiry & feedback
// ====================================
const TMS_PERMISSIONS = {
  TMS_CORE: {
    category: 'Ticket Management System',
    permissions: {
      tms_submit_ticket: {
        key: 'tms_submit_ticket',
        label: 'Submit Ticket',
        description: 'Can submit new tickets (grievance/assistance/enquiry/feedback)'
      },
      tms_view_own_tickets: {
        key: 'tms_view_own_tickets',
        label: 'View Own Tickets',
        description: 'Can view tickets submitted by self'
      },
      tms_view_assigned_tickets: {
        key: 'tms_view_assigned_tickets',
        label: 'View Assigned Tickets',
        description: 'Can view tickets assigned for handling'
      },
      tms_update_ticket: {
        key: 'tms_update_ticket',
        label: 'Update Ticket',
        description: 'Can add remarks and update ticket status'
      },
      tms_escalate_ticket: {
        key: 'tms_escalate_ticket',
        label: 'Escalate Ticket',
        description: 'Can escalate tickets to next level in the chain'
      },
      tms_resolve_ticket: {
        key: 'tms_resolve_ticket',
        label: 'Resolve Ticket',
        description: 'Can mark tickets as resolved'
      },
      tms_close_ticket: {
        key: 'tms_close_ticket',
        label: 'Close Ticket',
        description: 'Can close resolved or stale tickets'
      },
      tms_manage_categories: {
        key: 'tms_manage_categories',
        label: 'Manage TMS Categories',
        description: 'Can create/edit/delete category hierarchy and employee mappings'
      },
      tms_view_analytics: {
        key: 'tms_view_analytics',
        label: 'View TMS Analytics',
        description: 'Can view TMS dashboard analytics and all tickets (Admin)'
      },
      tms_registrar_handle: {
        key: 'tms_registrar_handle',
        label: 'Registrar Ticket Handling',
        description: 'Can handle tickets escalated to Registrar level'
      },
      tms_dean_handle: {
        key: 'tms_dean_handle',
        label: 'Dean Academics Ticket Handling',
        description: 'Can handle tickets escalated to Dean Academics level'
      },
      tms_vc_handle: {
        key: 'tms_vc_handle',
        label: 'Vice Chancellor Ticket Handling',
        description: 'Can handle tickets escalated to Vice Chancellor level'
      }
    }
  }
};

// Flat list of all permission keys for validation
const ALL_IPR_PERMISSION_KEYS = Object.values(IPR_PERMISSIONS).flatMap(
  (category) => Object.keys(category.permissions),
);

const ALL_RESEARCH_PERMISSION_KEYS = Object.values(
  RESEARCH_PERMISSIONS,
).flatMap((category) => Object.keys(category.permissions));

const ALL_BOOK_PERMISSION_KEYS = Object.values(BOOK_PERMISSIONS).flatMap(
  (category) => Object.keys(category.permissions),
);

const ALL_CONFERENCE_PERMISSION_KEYS = Object.values(
  CONFERENCE_PERMISSIONS,
).flatMap((category) => Object.keys(category.permissions));

const ALL_MONTHLY_REPORT_PERMISSION_KEYS = Object.values(
  MONTHLY_REPORT_PERMISSIONS,
).flatMap((category) => Object.keys(category.permissions));

const ALL_DSW_PERMISSION_KEYS = Object.values(DSW_PERMISSIONS).flatMap(
  (category) => Object.keys(category.permissions),
);

const ALL_NOTING_PERMISSION_KEYS = Object.values(NOTING_PERMISSIONS).flatMap(
  (category) => Object.keys(category.permissions),
);

const ALL_EVENT_PERMISSION_KEYS = Object.values(EVENT_PERMISSIONS).flatMap(
  (category) => Object.keys(category.permissions),
);

const ALL_REPORTING_STRUCTURE_PERMISSION_KEYS = Object.values(
  REPORTING_STRUCTURE_PERMISSIONS,
).flatMap((category) => Object.keys(category.permissions));

const ALL_TMS_PERMISSION_KEYS = Object.values(TMS_PERMISSIONS)
  .flatMap(category => Object.keys(category.permissions));

const ALL_PERMISSION_KEYS = [
  ...ALL_IPR_PERMISSION_KEYS,
  ...ALL_RESEARCH_PERMISSION_KEYS,
  ...ALL_BOOK_PERMISSION_KEYS,
  ...ALL_CONFERENCE_PERMISSION_KEYS,
  ...ALL_MONTHLY_REPORT_PERMISSION_KEYS,
  ...ALL_DSW_PERMISSION_KEYS,
  ...ALL_NOTING_PERMISSION_KEYS,
  ...ALL_EVENT_PERMISSION_KEYS,
  ...ALL_REPORTING_STRUCTURE_PERMISSION_KEYS,
  ...ALL_TMS_PERMISSION_KEYS
];

// Get all permissions as flat array for API response
const getPermissionsForUI = () => {
  const iprPerms = Object.entries(IPR_PERMISSIONS).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions),
  }));

  const researchPerms = Object.entries(RESEARCH_PERMISSIONS).map(
    ([groupKey, group]) => ({
      groupKey,
      category: group.category,
      permissions: Object.values(group.permissions),
    }),
  );

  const bookPerms = Object.entries(BOOK_PERMISSIONS).map(
    ([groupKey, group]) => ({
      groupKey,
      category: group.category,
      permissions: Object.values(group.permissions),
    }),
  );

  const conferencePerms = Object.entries(CONFERENCE_PERMISSIONS).map(
    ([groupKey, group]) => ({
      groupKey,
      category: group.category,
      permissions: Object.values(group.permissions),
    }),
  );

  const monthlyReportPerms = Object.entries(MONTHLY_REPORT_PERMISSIONS).map(
    ([groupKey, group]) => ({
      groupKey,
      category: group.category,
      permissions: Object.values(group.permissions),
    }),
  );

  const dswPerms = Object.entries(DSW_PERMISSIONS).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions),
  }));

  const notingPerms = Object.entries(NOTING_PERMISSIONS).map(
    ([groupKey, group]) => ({
      groupKey,
      category: group.category,
      permissions: Object.values(group.permissions),
    }),
  );

  const eventPerms = Object.entries(EVENT_PERMISSIONS).map(
    ([groupKey, group]) => ({
      groupKey,
      category: group.category,
      permissions: Object.values(group.permissions),
    }),
  );

  const reportingStructurePerms = Object.entries(
    REPORTING_STRUCTURE_PERMISSIONS,
  ).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions),
  }));

  
  const tmsPerms = Object.entries(TMS_PERMISSIONS).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions)
  }));
  
  return [
    ...iprPerms,
    ...researchPerms,
    ...bookPerms,
    ...conferencePerms,
    ...monthlyReportPerms,
    ...dswPerms,
    ...notingPerms,
    ...eventPerms,
    ...reportingStructurePerms,
    ...tmsPerms
  ];
};

// Validate permission keys
const isValidPermission = (key) => ALL_PERMISSION_KEYS.includes(key);

// Legacy permission-key aliases to keep old stored JSON permissions working.
const PERMISSION_KEY_ALIASES = {
  noting_view_department: ['noting_view_pending'],
  noting_view_pending: ['noting_view_department'],
};

const getPermissionKeyVariants = (key) => {
  if (!key || typeof key !== 'string') return [];

  const prefixedKey = `${key.split('_')[0]}_${key}`;
  const aliases = PERMISSION_KEY_ALIASES[key] || [];

  return Array.from(new Set([key, prefixedKey, ...aliases]));
};

// Get default permissions by role
// Faculty and Students can file IPR and Research by default (inherent right)
// Staff and Admin do NOT get filing by default - they need explicit checkbox
// Admin is IT head - manages users/permissions, NOT IPR/Research operations
const getDefaultPermissions = (role) => {
  const defaults = {
    student: {
      // DRD Permissions
      ipr_file_new: true, // Students can file IPR by default
      research_file_new: true, // Students can file Research by default
      book_file_new: true, // Students can file Book/Chapter by default
      conference_file_new: true, // Students can file Conference by default
      // DSW Permissions
      dsw_view_club: true, // Students can view clubs
      // Event Permissions
      event_manage_own: true,     // Students can manage events they create (via club)
      tms_submit_ticket: true,    // Students can submit tickets
      tms_view_own_tickets: true  // Students can view their own tickets
    },
    faculty: {
      // DRD Permissions
      ipr_file_new: true, // Faculty can file IPR by default
      // Admin does NOT get noting analytics/approval or IPR/Research filing by default
      // These require explicit permission assignment
      dsw_view_club: true, // Faculty can view clubs
      dsw_request_club_change: true, // Faculty facilitators can request changes
      // Noting Core Actions are explicit-assignment only.
      // (Chairperson override for students is handled in auth middleware.)
      // Event Permissions
      event_create: true,         // Faculty can create events (via noting)
      event_manage_own: true,     // Faculty can manage their own events
      event_publish: true,        // Faculty can publish their events
      event_assign_volunteers: true, // Faculty can assign volunteers
      // TMS Permissions
      tms_view_assigned_tickets: true, // Faculty can view assigned tickets
      tms_update_ticket: true,    // Faculty can add remarks
      tms_escalate_ticket: true,  // Faculty can escalate tickets
      tms_resolve_ticket: true    // Faculty can resolve tickets
    },
    staff: {
      // DSW Permissions - view only
      dsw_view_club: true, // Staff can view clubs
      // Noting Core Actions are explicit-assignment only.
      // TMS Permissions - same as faculty (staff are also employees)
      tms_view_assigned_tickets: true,  // Staff can view tickets assigned to them
      tms_update_ticket: true,          // Staff can add remarks to tickets
      tms_escalate_ticket: true,        // Staff can escalate tickets
      tms_resolve_ticket: true          // Staff can resolve tickets
      // Staff do NOT get filing/creation permissions by default
      // They need explicit permission from admin checkbox
    },
    admin: {
      // DSW Permissions
      dsw_view_club: true,
      dsw_view_all_clubs: true,
      dsw_approve_club: true,
      dsw_suspend_club: true,
      dsw_approve_club_change: true,
      dsw_view_audit_logs: true,
      // Noting Core Actions are explicit-assignment only.
      // Event Permissions
      event_view_all: true,
      event_manage_all: true,
      event_view_reports: true,
      // TMS Permissions
      tms_view_assigned_tickets: true,
      tms_manage_categories: true,
      tms_view_analytics: true,
      tms_close_ticket: true,
      // DRD Analytics Permissions — admin can view all analytics dashboards
      applicant_analytics: true,
      drd_member_analytics: true,
      // Admin does NOT get IPR/Research filing permissions by default
      // Admin manages users/permissions/analytics, NOT IPR operations
      // Admin does NOT get noting analytics/approval or IPR/Research filing by default
      // These require explicit permission assignment
    },
    superadmin: {
      // Superadmin gets all permissions by default
      dsw_view_club: true,
      dsw_view_all_clubs: true,
      dsw_approve_club: true,
      dsw_suspend_club: true,
      dsw_approve_club_change: true,
      dsw_view_audit_logs: true,
      noting_view_all: true,
      noting_approve: true,
      noting_forward: true,
      noting_return: true,
      event_view_all: true,
      event_manage_all: true,
      event_view_reports: true,
      // TMS Permissions
      tms_view_assigned_tickets: true,
      tms_manage_categories: true,
      tms_view_analytics: true,
      tms_close_ticket: true,
      // DRD Analytics Permissions
      applicant_analytics: true,
      drd_member_analytics: true
    },
  };

  return defaults[role] || {};
};

// Permission mapping for route protection
const ROUTE_PERMISSION_MAP = {
  // IPR Filing Routes
  "POST /api/v1/ipr/create": ["ipr_file_new"],
  "GET /api/v1/ipr/my-applications": ["ipr_file_new"],

  // DRD Review Routes (DRD Member)
  "GET /api/v1/drd-review/pending": ["ipr_review", "ipr_approve"],
  "POST /api/v1/drd-review/review/:id": ["ipr_review"],
  "POST /api/v1/drd-review/recommend/:id": ["ipr_review"],

  // DRD Head Approval Routes
  "POST /api/v1/drd-review/head-approve/:id": ["ipr_approve"],
  "POST /api/v1/drd-review/govt-application/:id": ["ipr_approve"],
  "POST /api/v1/drd-review/publication/:id": ["ipr_approve"],

  // School Assignment Routes (DRD Head)
  "POST /api/v1/drd-member/assign-schools": ["ipr_assign_school"],
  "PUT /api/v1/drd-member/assign-schools/:userId": ["ipr_assign_school"],

  // Research Contribution Filing Routes
  "POST /api/v1/research/create": ["research_file_new"],
  "GET /api/v1/research/my-contributions": ["research_file_new"],

  // Research Review Routes (DRD Member)
  "GET /api/v1/research-review/pending": [
    "research_review",
    "research_approve",
  ],
  "POST /api/v1/research-review/review/:id": ["research_review"],
  "POST /api/v1/research-review/request-changes/:id": ["research_review"],

  // Research Approval Routes (DRD Head)
  "POST /api/v1/research-review/approve/:id": ["research_approve"],
  "POST /api/v1/research-review/reject/:id": ["research_approve"],

  // Research School Assignment Routes (DRD Head)
  "POST /api/v1/research-member/assign-schools": ["research_assign_school"],
  "PUT /api/v1/research-member/assign-schools/:userId": [
    "research_assign_school",
  ],

  // Book/Chapter Filing Routes
  "POST /api/v1/book/create": ["book_file_new"],
  "GET /api/v1/book/my-books": ["book_file_new"],

  // Book Review Routes (DRD Member)
  "GET /api/v1/book-review/pending": ["book_review", "book_approve"],
  "POST /api/v1/book-review/review/:id": ["book_review"],
  "POST /api/v1/book-review/request-changes/:id": ["book_review"],

  // Book Approval Routes (DRD Head)
  "POST /api/v1/book-review/approve/:id": ["book_approve"],
  "POST /api/v1/book-review/reject/:id": ["book_approve"],

  // Book School Assignment Routes (DRD Head)
  "POST /api/v1/book-member/assign-schools": ["book_assign_school"],
  "PUT /api/v1/book-member/assign-schools/:userId": ["book_assign_school"],

  // Conference Paper Filing Routes
  "POST /api/v1/conference/create": ["conference_file_new"],
  "GET /api/v1/conference/my-papers": ["conference_file_new"],

  // Conference Review Routes (DRD Member)
  "GET /api/v1/conference-review/pending": [
    "conference_review",
    "conference_approve",
  ],
  "POST /api/v1/conference-review/review/:id": ["conference_review"],
  "POST /api/v1/conference-review/request-changes/:id": ["conference_review"],

  // Conference Approval Routes (DRD Head)
  "POST /api/v1/conference-review/approve/:id": ["conference_approve"],
  "POST /api/v1/conference-review/reject/:id": ["conference_approve"],

  // Conference School Assignment Routes (DRD Head)
  "POST /api/v1/conference-member/assign-schools": ["conference_assign_school"],
  "PUT /api/v1/conference-member/assign-schools/:userId": [
    "conference_assign_school",
  ],

  // Monthly Report Routes
  "GET /api/v1/progress-tracker/monthly-reports": ["monthly_report_view"],
  "GET /api/v1/progress-tracker/all": ["monthly_report_view"],

  // ====================================
  // DSW Club Routes
  // ====================================  "POST /api/v1/dsw/clubs/noting": ["dsw_create_club_noting"],
  "GET /api/v1/dsw/clubs": ["dsw_view_club"],
  "GET /api/v1/dsw/clubs/all": ["dsw_view_all_clubs"],
  "GET /api/v1/dsw/clubs/:id": ["dsw_view_club"],
  "POST /api/v1/dsw/clubs/:id/members": ["dsw_manage_members"],
  "DELETE /api/v1/dsw/clubs/:id/members/:memberId": ["dsw_manage_members"],
  "POST /api/v1/dsw/clubs/:id/approve": ["dsw_approve_club"],
  "POST /api/v1/dsw/clubs/:id/suspend": ["dsw_suspend_club"],
  "POST /api/v1/dsw/clubs/:id/change-request": ["dsw_request_club_change"],
  "POST /api/v1/dsw/clubs/:id/approve-change": ["dsw_approve_club_change"],
  "GET /api/v1/dsw/audit-logs": ["dsw_view_audit_logs"],

  // ====================================
  // Noting Routes
  // ====================================  "POST /api/v1/noting/create": ["noting_create"],
  "GET /api/v1/noting/my-notings": ["noting_view_own"],
  "GET /api/v1/noting/department": ["noting_view_department"],
  "GET /api/v1/noting/all": ["noting_view_all"],
  "POST /api/v1/noting/:id/approve": ["noting_approve"],
  "POST /api/v1/noting/:id/forward": ["noting_forward"],
  "POST /api/v1/noting/:id/return": ["noting_return"],
  "POST /api/v1/noting/:id/comment": ["noting_add_comment"],

  // ====================================
  // Event Management Routes
  // ====================================  'POST /api/v1/events/create': ['event_create'],
  'GET /api/v1/events/all': ['event_view_all'],
  'PUT /api/v1/events/:id': ['event_manage_own', 'event_manage_all'],
  'POST /api/v1/events/:id/publish': ['event_publish'],
  'POST /api/v1/events/:id/cancel': ['event_cancel'],
  'POST /api/v1/events/:id/attendance': ['event_manage_attendance'],
  'POST /api/v1/events/:id/volunteers': ['event_assign_volunteers'],
  'GET /api/v1/events/reports': ['event_view_reports'],
  
  // ====================================
  // TMS Ticket Management Routes
  // ====================================  'POST /api/v1/tms/tickets': ['tms_submit_ticket'],
  'GET /api/v1/tms/tickets/my': ['tms_view_own_tickets'],
  'GET /api/v1/tms/tickets/assigned': ['tms_view_assigned_tickets'],
  'GET /api/v1/tms/tickets/:id': ['tms_view_own_tickets', 'tms_view_assigned_tickets', 'tms_view_analytics'],
  'POST /api/v1/tms/tickets/:id/remark': ['tms_update_ticket'],
  'POST /api/v1/tms/tickets/:id/escalate': ['tms_escalate_ticket'],
  'POST /api/v1/tms/tickets/:id/resolve': ['tms_resolve_ticket'],
  'POST /api/v1/tms/tickets/:id/close': ['tms_close_ticket', 'tms_view_analytics'],
  'POST /api/v1/tms/tickets/:id/rate': ['tms_view_own_tickets'],
  'GET /api/v1/tms/categories': ['tms_submit_ticket', 'tms_view_own_tickets'],
  'GET /api/v1/tms/categories/all': ['tms_manage_categories'],
  'POST /api/v1/tms/categories/master': ['tms_manage_categories'],
  'PATCH /api/v1/tms/categories/master/:id': ['tms_manage_categories'],
  'DELETE /api/v1/tms/categories/master/:id': ['tms_manage_categories'],
  'POST /api/v1/tms/categories/category': ['tms_manage_categories'],
  'PATCH /api/v1/tms/categories/category/:id': ['tms_manage_categories'],
  'DELETE /api/v1/tms/categories/category/:id': ['tms_manage_categories'],
  'POST /api/v1/tms/categories/sub-category': ['tms_manage_categories'],
  'PATCH /api/v1/tms/categories/sub-category/:id': ['tms_manage_categories'],
  'DELETE /api/v1/tms/categories/sub-category/:id': ['tms_manage_categories'],
  'GET /api/v1/tms/admin/analytics/overview': ['tms_view_analytics'],
  'GET /api/v1/tms/admin/analytics/employees': ['tms_view_analytics'],
  'GET /api/v1/tms/admin/analytics/categories': ['tms_view_analytics'],
  'GET /api/v1/tms/admin/tickets': ['tms_view_analytics']
};

/**
 * Check if a user has a specific permission
 * Checks role-based defaults, direct department permissions, AND assigned role permissions
 *
 * @param {Object} user - User object with role, schoolDeptPermissions, centralDeptPermissions, assignedRoleIds
 * @param {string} permissionKey - Permission key to check (e.g., 'noting_approve')
 * @returns {boolean} True if user has the permission
 */
function hasPermission(user, permissionKey) {
  if (!user || !permissionKey) {
    return false;
  }

  const permissionVariants = getPermissionKeyVariants(permissionKey);

  // Special case: DEAN role has all permissions
  if (user.role === "dean" || user.roleCode === "DEAN") {
    return true;
  }

  // Check direct department permissions (array of {permissions: {...}} objects from Prisma)
  if (Array.isArray(user.schoolDeptPermissions)) {
    for (const perm of user.schoolDeptPermissions) {
      if (permissionVariants.some((variant) => perm?.permissions?.[variant] === true)) {
        return true;
      }
    }
  }

  if (Array.isArray(user.centralDeptPermissions)) {
    for (const perm of user.centralDeptPermissions) {
      if (permissionVariants.some((variant) => perm?.permissions?.[variant] === true)) {
        return true;
      }
    }
  }

  // Check role-based default permissions
  const defaultPermissions = getDefaultPermissions(user.role);
  if (
    defaultPermissions &&
    typeof defaultPermissions === 'object' &&
    permissionVariants.some((variant) => defaultPermissions[variant] === true)
  ) {
    return true;
  }

  // _resolvedRolePermissions is set by hasPermissionAsync after resolving assignedRoleIds
  if (permissionVariants.some((variant) => user._resolvedRolePermissions?.[variant] === true)) {
    return true;
  }

  return false;
}

/**
 * Async version of hasPermission that resolves assignedRoleIds from DB
 * Use this when you have a user object with assignedRoleIds but haven't resolved roles yet
 *
 * @param {Object} user - User object with assignedRoleIds
 * @param {string} permissionKey - Permission key to check
 * @returns {Promise<boolean>}
 */
async function hasPermissionAsync(user, permissionKey) {
  const permissionVariants = getPermissionKeyVariants(permissionKey);

  // First check sync permissions
  if (hasPermission(user, permissionKey)) {
    return true;
  }

  // If user has assignedRoleIds, resolve them from DB
  const roleIds = user.assignedRoleIds || [];
  if (Array.isArray(roleIds) && roleIds.length > 0) {
    const prisma = require("./database");
    const roles = await prisma.role.findMany({
      where: {
        id: { in: roleIds },
        isActive: true,
      },
      select: {
        permissions: true,
      },
    });

    for (const role of roles) {
      const perms = role.permissions || {};
      // Check central dept permissions from role
      if (permissionVariants.some((variant) => perms.centralDeptPermissions?.[variant] === true)) {
        return true;
      }
      // Check school dept permissions from role
      if (permissionVariants.some((variant) => perms.schoolDeptPermissions?.[variant] === true)) {
        return true;
      }
    }
  }

  return false;
}

module.exports = {
  // Permission Category Objects
  IPR_PERMISSIONS,
  RESEARCH_PERMISSIONS,
  BOOK_PERMISSIONS,
  CONFERENCE_PERMISSIONS,
  MONTHLY_REPORT_PERMISSIONS,
  DSW_PERMISSIONS,
  NOTING_PERMISSIONS,
  EVENT_PERMISSIONS,
  REPORTING_STRUCTURE_PERMISSIONS,
  TMS_PERMISSIONS,
  
  // Permission Key Arrays
  ALL_PERMISSION_KEYS,
  ALL_IPR_PERMISSION_KEYS,
  ALL_RESEARCH_PERMISSION_KEYS,
  ALL_BOOK_PERMISSION_KEYS,
  ALL_CONFERENCE_PERMISSION_KEYS,
  ALL_MONTHLY_REPORT_PERMISSION_KEYS,
  ALL_DSW_PERMISSION_KEYS,
  ALL_NOTING_PERMISSION_KEYS,
  ALL_EVENT_PERMISSION_KEYS,
  ALL_REPORTING_STRUCTURE_PERMISSION_KEYS,
  ALL_TMS_PERMISSION_KEYS,
  
  // Utility Functions
  getPermissionsForUI,
  isValidPermission,
  getPermissionKeyVariants,
  getDefaultPermissions,
  hasPermission,
  hasPermissionAsync,
  ROUTE_PERMISSION_MAP,
};
