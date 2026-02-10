/**
 * Department Permission Definitions
 * Each department can have custom permissions
 * These are checkboxes that can be assigned to users
 */

const SCHOOL_DEPARTMENT_PERMISSIONS = {
  // Common permissions for all school departments
  common: [
    { key: 'view_dashboard', label: 'View Dashboard', category: 'General' },
    { key: 'view_reports', label: 'View Reports', category: 'General' },
    { key: 'export_data', label: 'Export Data', category: 'General' },
  ],
  
  // Student Management
  students: [
    { key: 'view_students', label: 'View Students', category: 'Students' },
    { key: 'add_students', label: 'Add Students', category: 'Students' },
    { key: 'edit_students', label: 'Edit Students', category: 'Students' },
    { key: 'delete_students', label: 'Delete Students', category: 'Students' },
    { key: 'approve_students', label: 'Approve Student Data', category: 'Students' },
    { key: 'view_student_records', label: 'View Student Records', category: 'Students' },
    { key: 'edit_student_records', label: 'Edit Student Records', category: 'Students' },
    // Default IPR permissions for students
    { key: 'file_ipr', label: 'File IPR Applications', category: 'Students' },
    { key: 'view_own_ipr', label: 'View Own IPR', category: 'Students' },
    { key: 'edit_own_ipr', label: 'Edit Own IPR', category: 'Students' },
  ],
  
  // Faculty Management
  faculty: [
    { key: 'view_faculty', label: 'View Faculty', category: 'Faculty' },
    { key: 'add_faculty', label: 'Add Faculty', category: 'Faculty' },
    { key: 'edit_faculty', label: 'Edit Faculty', category: 'Faculty' },
    { key: 'delete_faculty', label: 'Delete Faculty', category: 'Faculty' },
    { key: 'assign_courses', label: 'Assign Courses', category: 'Faculty' },
    { key: 'view_workload', label: 'View Workload', category: 'Faculty' },
  ],
  
  // Course Management
  courses: [
    { key: 'view_courses', label: 'View Courses', category: 'Courses' },
    { key: 'add_courses', label: 'Add Courses', category: 'Courses' },
    { key: 'edit_courses', label: 'Edit Courses', category: 'Courses' },
    { key: 'delete_courses', label: 'Delete Courses', category: 'Courses' },
    { key: 'manage_syllabus', label: 'Manage Syllabus', category: 'Courses' },
  ],
  
  // Examination
  examinations: [
    { key: 'view_exams', label: 'View Examinations', category: 'Examinations' },
    { key: 'create_exams', label: 'Create Examinations', category: 'Examinations' },
    { key: 'edit_exams', label: 'Edit Examinations', category: 'Examinations' },
    { key: 'delete_exams', label: 'Delete Examinations', category: 'Examinations' },
    { key: 'enter_marks', label: 'Enter Marks', category: 'Examinations' },
    { key: 'approve_marks', label: 'Approve Marks', category: 'Examinations' },
    { key: 'generate_results', label: 'Generate Results', category: 'Examinations' },
  ],
};

const CENTRAL_DEPARTMENT_PERMISSIONS = {
  // HR Department
  hr: [
    { key: 'view_employees', label: 'View Employees', category: 'HR' },
    { key: 'add_employees', label: 'Add Employees', category: 'HR' },
    { key: 'edit_employees', label: 'Edit Employees', category: 'HR' },
    { key: 'delete_employees', label: 'Delete Employees', category: 'HR' },
    { key: 'manage_attendance', label: 'Manage Attendance', category: 'HR' },
    { key: 'manage_leave', label: 'Manage Leave', category: 'HR' },
    { key: 'manage_payroll', label: 'Manage Payroll', category: 'HR' },
    { key: 'view_salary', label: 'View Salary', category: 'HR' },
    { key: 'edit_salary', label: 'Edit Salary', category: 'HR' },
    { key: 'approve_leave', label: 'Approve Leave', category: 'HR' },
    { key: 'generate_hr_reports', label: 'Generate HR Reports', category: 'HR' },
  ],
  
  // ERP Department
  erp: [
    { key: 'view_erp_modules', label: 'View ERP Modules', category: 'ERP' },
    { key: 'configure_erp', label: 'Configure ERP', category: 'ERP' },
    { key: 'manage_workflows', label: 'Manage Workflows', category: 'ERP' },
    { key: 'system_admin', label: 'System Administration', category: 'ERP' },
    { key: 'view_system_logs', label: 'View System Logs', category: 'ERP' },
    { key: 'manage_integrations', label: 'Manage Integrations', category: 'ERP' },
  ],
  
  // DRD (Development & Research Department) - Simplified 4 IPR Permission Model
  drd: [
    // ========== IPR Permissions ==========
    // IPR Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    { key: 'ipr_file_new', label: 'IPR Filing', category: 'IPR Permissions', type: 'action', description: 'Can file new IPR applications (Faculty/Student have this by default)' },
    
    // IPR Review - DRD Member can review applications from assigned schools
    { key: 'ipr_review', label: 'IPR Review', category: 'IPR Permissions', type: 'action', description: 'DRD Member - Can review IPR applications from assigned schools' },
    
    // IPR Approve - DRD Head can give final approval/rejection
    { key: 'ipr_approve', label: 'IPR Approve', category: 'IPR Permissions', type: 'action', description: 'DRD Head - Can give final approval/rejection on IPR applications' },
    
    // Assign Schools - DRD Head can assign schools to DRD member reviewers
    { key: 'ipr_assign_school', label: 'Assign Schools to DRD Members (IPR)', category: 'IPR Permissions', type: 'action', description: 'DRD Head - Can assign schools to DRD member reviewers for IPR' },
    
    // ========== Research Paper Permissions ==========
    // Research Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    { key: 'research_file_new', label: 'Research Paper Filing', category: 'Research Permissions', type: 'action', description: 'Can file new research paper contributions (Faculty/Student have this by default)' },
    
    // Research Review - DRD Member can review applications from assigned schools
    { key: 'research_review', label: 'Research Paper Review', category: 'Research Permissions', type: 'action', description: 'DRD Member - Can review research paper contributions from assigned schools' },
    
    // Research Approve - DRD Head can give final approval/rejection
    { key: 'research_approve', label: 'Research Paper Approve', category: 'Research Permissions', type: 'action', description: 'DRD Head - Can give final approval/rejection on research paper contributions' },
    
    // Assign Schools for Research - DRD Head can assign schools to DRD member reviewers
    { key: 'research_assign_school', label: 'Assign Schools to DRD Members (Research)', category: 'Research Permissions', type: 'action', description: 'DRD Head - Can assign schools to DRD member reviewers for Research' },
    
    // ========== Book/Book Chapter Permissions ==========
    // Book Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    { key: 'book_file_new', label: 'Book/Chapter Filing', category: 'Book Permissions', type: 'action', description: 'Can file new book/book chapter contributions (Faculty/Student have this by default)' },
    
    // Book Review - DRD Member can review book applications from assigned schools
    { key: 'book_review', label: 'Book/Chapter Review', category: 'Book Permissions', type: 'action', description: 'DRD Member - Can review book/book chapter contributions from assigned schools' },
    
    // Book Approve - DRD Head can give final approval/rejection
    { key: 'book_approve', label: 'Book/Chapter Approve', category: 'Book Permissions', type: 'action', description: 'DRD Head - Can give final approval/rejection on book/book chapter contributions' },
    
    // Assign Schools for Book - DRD Head can assign schools to DRD member reviewers
    { key: 'book_assign_school', label: 'Assign Schools to DRD Members (Book)', category: 'Book Permissions', type: 'action', description: 'DRD Head - Can assign schools to DRD member reviewers for Book/Chapter' },
    
    // ========== Conference Permissions ==========
    // Conference Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    { key: 'conference_file_new', label: 'Conference Paper Filing', category: 'Conference Permissions', type: 'action', description: 'Can file new conference paper contributions (Faculty/Student have this by default)' },
    
    // Conference Review - DRD Member can review conference applications from assigned schools
    { key: 'conference_review', label: 'Conference Paper Review', category: 'Conference Permissions', type: 'action', description: 'DRD Member - Can review conference paper contributions from assigned schools' },
    
    // Conference Approve - DRD Head can give final approval/rejection
    { key: 'conference_approve', label: 'Conference Paper Approve', category: 'Conference Permissions', type: 'action', description: 'DRD Head - Can give final approval/rejection on conference paper contributions' },
    
    // Assign Schools for Conference - DRD Head can assign schools to DRD member reviewers
    { key: 'conference_assign_school', label: 'Assign Schools to DRD Members (Conference)', category: 'Conference Permissions', type: 'action', description: 'DRD Head - Can assign schools to DRD member reviewers for Conference' },
    
    // ========== Grant/Funding Permissions ==========
    // Grant Filing - Faculty/Student have this by default, Staff/Admin need explicit assignment
    { key: 'grant_file_new', label: 'Grant Filing', category: 'Grant Permissions', type: 'action', description: 'Can file new grant/funding applications (Faculty/Student have this by default)' },
    
    // Grant Review - DRD Member can review grant applications from assigned schools
    { key: 'grant_review', label: 'Grant Review', category: 'Grant Permissions', type: 'action', description: 'DRD Member - Can review grant/funding applications from assigned schools' },
    
    // Grant Approve - DRD Head can give final approval/rejection
    { key: 'grant_approve', label: 'Grant Approve', category: 'Grant Permissions', type: 'action', description: 'DRD Head - Can give final approval/rejection on grant/funding applications' },
    
    // Assign Schools for Grant - DRD Head can assign schools to DRD member reviewers
    { key: 'grant_assign_school', label: 'Assign Schools to DRD Members (Grant)', category: 'Grant Permissions', type: 'action', description: 'DRD Head - Can assign schools to DRD member reviewers for Grant/Funding' },
  ],
  
  // Finance Department
  finance: [
    { key: 'view_accounts', label: 'View Accounts', category: 'Finance' },
    { key: 'manage_accounts', label: 'Manage Accounts', category: 'Finance' },
    { key: 'view_transactions', label: 'View Transactions', category: 'Finance' },
    { key: 'approve_transactions', label: 'Approve Transactions', category: 'Finance' },
    { key: 'manage_fees', label: 'Manage Fees', category: 'Finance' },
    { key: 'generate_invoices', label: 'Generate Invoices', category: 'Finance' },
    { key: 'view_financial_reports', label: 'View Financial Reports', category: 'Finance' },
    { key: 'manage_budget', label: 'Manage Budget', category: 'Finance' },
  ],
  
  // Library
  library: [
    { key: 'view_books', label: 'View Books', category: 'Library' },
    { key: 'add_books', label: 'Add Books', category: 'Library' },
    { key: 'edit_books', label: 'Edit Books', category: 'Library' },
    { key: 'delete_books', label: 'Delete Books', category: 'Library' },
    { key: 'issue_books', label: 'Issue Books', category: 'Library' },
    { key: 'return_books', label: 'Return Books', category: 'Library' },
    { key: 'manage_members', label: 'Manage Members', category: 'Library' },
    { key: 'generate_library_reports', label: 'Generate Reports', category: 'Library' },
  ],
  
  // IT Department
  it: [
    { key: 'manage_infrastructure', label: 'Manage Infrastructure', category: 'IT' },
    { key: 'manage_networks', label: 'Manage Networks', category: 'IT' },
    { key: 'manage_security', label: 'Manage Security', category: 'IT' },
    { key: 'manage_users', label: 'Manage Users', category: 'IT' },
    { key: 'manage_permissions', label: 'Manage Permissions', category: 'IT' },
    { key: 'view_system_health', label: 'View System Health', category: 'IT' },
    { key: 'manage_backups', label: 'Manage Backups', category: 'IT' },
  ],
  
  // Admissions
  admissions: [
    { key: 'view_applications', label: 'View Applications', category: 'Admissions' },
    { key: 'review_applications', label: 'Review Applications', category: 'Admissions' },
    { key: 'approve_applications', label: 'Approve Applications', category: 'Admissions' },
    { key: 'reject_applications', label: 'Reject Applications', category: 'Admissions' },
    { key: 'manage_entrance_tests', label: 'Manage Entrance Tests', category: 'Admissions' },
    { key: 'generate_admission_reports', label: 'Generate Reports', category: 'Admissions' },
  ],
  
  // Registrar
  registrar: [
    { key: 'view_registrations', label: 'View Registrations', category: 'Registrar' },
    { key: 'approve_registrations', label: 'Approve Registrations', category: 'Registrar' },
    { key: 'issue_certificates', label: 'Issue Certificates', category: 'Registrar' },
    { key: 'manage_transcripts', label: 'Manage Transcripts', category: 'Registrar' },
    { key: 'verify_documents', label: 'Verify Documents', category: 'Registrar' },
    { key: 'manage_records', label: 'Manage Records', category: 'Registrar' },
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
  Object.keys(SCHOOL_DEPARTMENT_PERMISSIONS).forEach(key => {
    if (key !== 'common') {
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
