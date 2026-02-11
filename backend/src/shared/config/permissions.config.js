/**
 * IPR, Research & DRD Permission Configuration
 * Simplified to 4 core IPR permissions + 4 Research permissions
 */

const IPR_PERMISSIONS = {
  // Core IPR Permissions - Only 4 checkboxes
  IPR_CORE: {
    category: 'IPR Permissions',
    permissions: {
      ipr_file_new: {
        key: 'ipr_file_new',
        label: 'IPR Filing',
        description: 'Can file new IPR applications (Faculty/Student have this by default)'
      },
      ipr_review: {
        key: 'ipr_review',
        label: 'IPR Review',
        description: 'DRD Member - Can review IPR applications from assigned schools'
      },
      ipr_approve: {
        key: 'ipr_approve',
        label: 'IPR Approve',
        description: 'DRD Head - Can give final approval/rejection on IPR applications'
      },
      ipr_assign_school: {
        key: 'ipr_assign_school',
        label: 'Assign Schools to DRD Members (IPR)',
        description: 'DRD Head - Can assign schools to DRD member reviewers for IPR'
      }
    }
  }
};

// Research Contribution Permissions - 4 checkboxes (parallel to IPR)
const RESEARCH_PERMISSIONS = {
  RESEARCH_CORE: {
    category: 'Research Permissions',
    permissions: {
      research_file_new: {
        key: 'research_file_new',
        label: 'Research Paper Filing',
        description: 'Can file new research paper contributions (Faculty/Student have this by default)'
      },
      research_review: {
        key: 'research_review',
        label: 'Research Paper Review',
        description: 'DRD Member - Can review research paper contributions from assigned schools'
      },
      research_approve: {
        key: 'research_approve',
        label: 'Research Paper Approve',
        description: 'DRD Head - Can give final approval/rejection on research paper contributions'
      },
      research_assign_school: {
        key: 'research_assign_school',
        label: 'Assign Schools to DRD Members (Research)',
        description: 'DRD Head - Can assign schools to DRD member reviewers for Research'
      }
    }
  }
};

// Book/Book Chapter Permissions - 4 checkboxes (parallel to IPR and Research)
const BOOK_PERMISSIONS = {
  BOOK_CORE: {
    category: 'Book Permissions',
    permissions: {
      book_file_new: {
        key: 'book_file_new',
        label: 'Book/Chapter Filing',
        description: 'Can file new book/book chapter contributions (Faculty/Student have this by default)'
      },
      book_review: {
        key: 'book_review',
        label: 'Book/Chapter Review',
        description: 'DRD Member - Can review book/book chapter contributions from assigned schools'
      },
      book_approve: {
        key: 'book_approve',
        label: 'Book/Chapter Approve',
        description: 'DRD Head - Can give final approval/rejection on book/book chapter contributions'
      },
      book_assign_school: {
        key: 'book_assign_school',
        label: 'Assign Schools to DRD Members (Book)',
        description: 'DRD Head - Can assign schools to DRD member reviewers for Book/Chapter'
      }
    }
  }
};

// Conference Paper Permissions - 4 checkboxes (parallel to IPR, Research, and Book)
const CONFERENCE_PERMISSIONS = {
  CONFERENCE_CORE: {
    category: 'Conference Permissions',
    permissions: {
      conference_file_new: {
        key: 'conference_file_new',
        label: 'Conference Paper Filing',
        description: 'Can file new conference paper contributions (Faculty/Student have this by default)'
      },
      conference_review: {
        key: 'conference_review',
        label: 'Conference Paper Review',
        description: 'DRD Member - Can review conference paper contributions from assigned schools'
      },
      conference_approve: {
        key: 'conference_approve',
        label: 'Conference Paper Approve',
        description: 'DRD Head - Can give final approval/rejection on conference paper contributions'
      },
      conference_assign_school: {
        key: 'conference_assign_school',
        label: 'Assign Schools to DRD Members (Conference)',
        description: 'DRD Head - Can assign schools to DRD member reviewers for Conference'
      }
    }
  }
};

// Monthly Report Permissions - View progress tracker reports by school/department
const MONTHLY_REPORT_PERMISSIONS = {
  MONTHLY_REPORT_CORE: {
    category: 'Monthly Report Permissions',
    permissions: {
      monthly_report_view: {
        key: 'monthly_report_view',
        label: 'View Monthly Reports',
        description: 'Can view progress tracker reports for assigned schools/departments'
      }
    }
  }
};






// Flat list of all permission keys for validation
const ALL_IPR_PERMISSION_KEYS = Object.values(IPR_PERMISSIONS)
  .flatMap(category => Object.keys(category.permissions));

const ALL_RESEARCH_PERMISSION_KEYS = Object.values(RESEARCH_PERMISSIONS)
  .flatMap(category => Object.keys(category.permissions));

const ALL_BOOK_PERMISSION_KEYS = Object.values(BOOK_PERMISSIONS)
  .flatMap(category => Object.keys(category.permissions));

const ALL_CONFERENCE_PERMISSION_KEYS = Object.values(CONFERENCE_PERMISSIONS)
  .flatMap(category => Object.keys(category.permissions));

const ALL_MONTHLY_REPORT_PERMISSION_KEYS = Object.values(MONTHLY_REPORT_PERMISSIONS)
  .flatMap(category => Object.keys(category.permissions));

const ALL_PERMISSION_KEYS = [...ALL_IPR_PERMISSION_KEYS, ...ALL_RESEARCH_PERMISSION_KEYS, ...ALL_BOOK_PERMISSION_KEYS, ...ALL_CONFERENCE_PERMISSION_KEYS, ...ALL_MONTHLY_REPORT_PERMISSION_KEYS];

// Get all permissions as flat array for API response
const getPermissionsForUI = () => {
  const iprPerms = Object.entries(IPR_PERMISSIONS).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions)
  }));
  
  const researchPerms = Object.entries(RESEARCH_PERMISSIONS).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions)
  }));
  
  const bookPerms = Object.entries(BOOK_PERMISSIONS).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions)
  }));
  
  const conferencePerms = Object.entries(CONFERENCE_PERMISSIONS).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions)
  }));
  
  const monthlyReportPerms = Object.entries(MONTHLY_REPORT_PERMISSIONS).map(([groupKey, group]) => ({
    groupKey,
    category: group.category,
    permissions: Object.values(group.permissions)
  }));
  
  return [...iprPerms, ...researchPerms, ...bookPerms, ...conferencePerms, ...monthlyReportPerms];
};

// Validate permission keys
const isValidPermission = (key) => ALL_PERMISSION_KEYS.includes(key);

// Get default permissions by role
// Faculty and Students can file IPR and Research by default (inherent right)
// Staff and Admin do NOT get filing by default - they need explicit checkbox
// Admin is IT head - manages users/permissions, NOT IPR/Research operations
const getDefaultPermissions = (role) => {
  const defaults = {
    student: {
      ipr_file_new: true,         // Students can file IPR by default
      research_file_new: true,    // Students can file Research by default
      book_file_new: true,        // Students can file Book/Chapter by default
      conference_file_new: true   // Students can file Conference by default
    },
    faculty: {
      ipr_file_new: true,         // Faculty can file IPR by default
      research_file_new: true,    // Faculty can file Research by default
      book_file_new: true,        // Faculty can file Book/Chapter by default
      conference_file_new: true   // Faculty can file Conference by default
    },
    staff: {
      // Staff do NOT get any IPR/Research/Book/Conference permissions by default
      // They need explicit permission from admin checkbox
    },
    admin: {
      // Admin is IT head - manages users/permissions/analytics
      // Does NOT get IPR/Research/Book/Conference operational permissions by default
      // Can assign permissions to others, but cannot file/review/approve
    }
  };

  return defaults[role] || {};
};

// Permission mapping for route protection
const ROUTE_PERMISSION_MAP = {
  // IPR Filing Routes
  'POST /api/v1/ipr/create': ['ipr_file_new'],
  'GET /api/v1/ipr/my-applications': ['ipr_file_new'],
  
  // DRD Review Routes (DRD Member)
  'GET /api/v1/drd-review/pending': ['ipr_review', 'ipr_approve'],
  'POST /api/v1/drd-review/review/:id': ['ipr_review'],
  'POST /api/v1/drd-review/recommend/:id': ['ipr_review'],
  
  // DRD Head Approval Routes
  'POST /api/v1/drd-review/head-approve/:id': ['ipr_approve'],
  'POST /api/v1/drd-review/govt-application/:id': ['ipr_approve'],
  'POST /api/v1/drd-review/publication/:id': ['ipr_approve'],
  
  // School Assignment Routes (DRD Head)
  'POST /api/v1/drd-member/assign-schools': ['ipr_assign_school'],
  'PUT /api/v1/drd-member/assign-schools/:userId': ['ipr_assign_school'],
  
  // Research Contribution Filing Routes
  'POST /api/v1/research/create': ['research_file_new'],
  'GET /api/v1/research/my-contributions': ['research_file_new'],
  
  // Research Review Routes (DRD Member)
  'GET /api/v1/research-review/pending': ['research_review', 'research_approve'],
  'POST /api/v1/research-review/review/:id': ['research_review'],
  'POST /api/v1/research-review/request-changes/:id': ['research_review'],
  
  // Research Approval Routes (DRD Head)
  'POST /api/v1/research-review/approve/:id': ['research_approve'],
  'POST /api/v1/research-review/reject/:id': ['research_approve'],
  
  // Research School Assignment Routes (DRD Head)
  'POST /api/v1/research-member/assign-schools': ['research_assign_school'],
  'PUT /api/v1/research-member/assign-schools/:userId': ['research_assign_school'],
  
  // Book/Chapter Filing Routes
  'POST /api/v1/book/create': ['book_file_new'],
  'GET /api/v1/book/my-books': ['book_file_new'],
  
  // Book Review Routes (DRD Member)
  'GET /api/v1/book-review/pending': ['book_review', 'book_approve'],
  'POST /api/v1/book-review/review/:id': ['book_review'],
  'POST /api/v1/book-review/request-changes/:id': ['book_review'],
  
  // Book Approval Routes (DRD Head)
  'POST /api/v1/book-review/approve/:id': ['book_approve'],
  'POST /api/v1/book-review/reject/:id': ['book_approve'],
  
  // Book School Assignment Routes (DRD Head)
  'POST /api/v1/book-member/assign-schools': ['book_assign_school'],
  'PUT /api/v1/book-member/assign-schools/:userId': ['book_assign_school'],
  
  // Conference Paper Filing Routes
  'POST /api/v1/conference/create': ['conference_file_new'],
  'GET /api/v1/conference/my-papers': ['conference_file_new'],
  
  // Conference Review Routes (DRD Member)
  'GET /api/v1/conference-review/pending': ['conference_review', 'conference_approve'],
  'POST /api/v1/conference-review/review/:id': ['conference_review'],
  'POST /api/v1/conference-review/request-changes/:id': ['conference_review'],
  
  // Conference Approval Routes (DRD Head)
  'POST /api/v1/conference-review/approve/:id': ['conference_approve'],
  'POST /api/v1/conference-review/reject/:id': ['conference_approve'],
  
  // Conference School Assignment Routes (DRD Head)
  'POST /api/v1/conference-member/assign-schools': ['conference_assign_school'],
  'PUT /api/v1/conference-member/assign-schools/:userId': ['conference_assign_school'],
  
  // Monthly Report Routes
  'GET /api/v1/progress-tracker/monthly-reports': ['monthly_report_view'],
  'GET /api/v1/progress-tracker/all': ['monthly_report_view']
};

module.exports = {
  IPR_PERMISSIONS,
  RESEARCH_PERMISSIONS,
  BOOK_PERMISSIONS,
  CONFERENCE_PERMISSIONS,
  MONTHLY_REPORT_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  ALL_IPR_PERMISSION_KEYS,
  ALL_RESEARCH_PERMISSION_KEYS,
  ALL_BOOK_PERMISSION_KEYS,
  ALL_CONFERENCE_PERMISSION_KEYS,
  ALL_MONTHLY_REPORT_PERMISSION_KEYS,
  getPermissionsForUI,
  isValidPermission,
  getDefaultPermissions,
  ROUTE_PERMISSION_MAP
};
