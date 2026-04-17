/**
 * Registration Filter Types
 *
 * Types for the advanced server-side registration filtering system.
 */

// ── Filter parameters sent to the API ────────────────────────────
export interface RegistrationFilterParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  role?: string;
  gender?: string;
  schoolId?: string;
  departmentId?: string;
  programId?: string;
  passOutYear?: number | string;
  uid?: string;
  empId?: string;
  paymentStatus?: string;
  teamSearch?: string;
}

// ── Distinct filter options returned by the API ──────────────────
export interface RegistrationFilterOptions {
  roles: string[];
  genders: string[];
  schools: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  programs: { id: string; name: string }[];
  passOutYears: number[];
}

// ── Enhanced registration row with full user details ─────────────
export interface RegistrationRow {
  id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  teamId?: string | null;
  status: string;
  qrCode: string;
  paymentStatus?: string;
  amountPaid?: number;
  couponId?: string | null;
  discountAmount?: number | null;
  originalAmount?: number | null;
  isTeamLeader?: boolean;
  hasEntered: boolean;
  enteredAt?: string;
  registeredAt: string;
  updatedAt: string;
  /** Extra pass guests linked to this registration */
  guests?: Array<{
    id: string;
    guestName: string;
    guestEmail: string;
    mobileNumber: string;
    relationship: string;
    createdAt: string;
  }>;
  /** Team info (populated when event is team-based) */
  team?: {
    id: string;
    teamId: string;
    name: string;
    status: string;
    isComplete: boolean;
    isLocked: boolean;
    leaderId: string;
  } | null;
  /** Latest successful payment for this registration */
  latestPayment?: {
    razorpayPaymentId?: string | null;
    razorpayOrderId?: string;
    amount?: number;
    status?: string;
    paidAt?: string | null;
    paymentFor?: string;
  } | null;
  user_login?: {
    id: string;
    uid: string;
    email?: string;
    role: string;
    studentLogin?: {
      firstName: string;
      lastName?: string;
      displayName?: string;
      registrationNo?: string;
      studentId: string;
      gender?: string;
      graduationDate?: string;
      programId?: string;
      program?: {
        id: string;
        programName: string;
        department?: {
          id: string;
          departmentName: string;
          faculty?: {
            id: string;
            facultyName: string;
          };
        };
      };
    };
    employeeDetails?: {
      firstName: string;
      lastName?: string;
      displayName?: string;
      empId?: string;
      primarySchoolId?: string;
      primaryDepartmentId?: string;
      primarySchool?: { id: string; facultyName: string };
      primaryDepartment?: { id: string; departmentName: string };
    };
  };
}

export interface PaginatedRegistrations {
  registrations: RegistrationRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Role label helpers ───────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Staff',
  admin: 'Admin',
  superadmin: 'Super Admin',
  parent: 'Parent',
};

// ── Helper to extract display name from a registration row ───────
export function getRegistrationDisplayName(row: RegistrationRow): string {
  const u = row.user_login;
  if (!u) return 'N/A';
  if (u.studentLogin) {
    return u.studentLogin.displayName || `${u.studentLogin.firstName} ${u.studentLogin.lastName || ''}`.trim();
  }
  if (u.employeeDetails) {
    return u.employeeDetails.displayName || `${u.employeeDetails.firstName} ${u.employeeDetails.lastName || ''}`.trim();
  }
  return u.uid;
}

export function getRegistrationIdentifier(row: RegistrationRow): string {
  const u = row.user_login;
  if (!u) return '';
  if (u.role ===
   'student' && u.studentLogin) {
    return u.studentLogin.registrationNo || u.studentLogin.studentId || u.uid;
  }
  if (u.employeeDetails?.empId) {
    return u.employeeDetails.empId;
  }
  return u.uid;
}

export function getRegistrationSchool(row: RegistrationRow): string {
  const u = row.user_login;
  if (!u) return '';
  if (u.studentLogin?.program?.department?.faculty) {
    return u.studentLogin.program.department.faculty.facultyName;
  }
  if (u.employeeDetails?.primarySchool) {
    return u.employeeDetails.primarySchool.facultyName;
  }
  return '';
}

export function getRegistrationDepartment(row: RegistrationRow): string {
  const u = row.user_login;
  if (!u) return '';
  if (u.studentLogin?.program?.department) {
    return u.studentLogin.program.department.departmentName;
  }
  if (u.employeeDetails?.primaryDepartment) {
    return u.employeeDetails.primaryDepartment.departmentName;
  }
  return '';
}

export function getRegistrationProgram(row: RegistrationRow): string {
  const u = row.user_login;
  if (!u) return '';
  if (u.studentLogin?.program) {
    return u.studentLogin.program.programName;
  }
  return '';
}
