/**
 * Event Settings / Visibility Types
 *
 * Types for the event visibility configuration system.
 */

export type VisibleRole = 'student' | 'faculty' | 'staff' | 'admin' | 'parent' | 'superadmin';

export type StudentFilterType = 'all' | 'custom';

export interface EventVisibility {
  id: string;
  eventId: string;
  isActive: boolean;
  autoClosed: boolean;          // system auto-closed due to registrationEndDate expiry
  manuallyOverridden: boolean;  // admin has manually toggled after date expiry
  visibleToRoles: VisibleRole[];
  studentFilterType: StudentFilterType;
  allowedSchoolIds: string[];
  allowedDepartmentIds: string[];
  allowedProgramIds: string[];
  allowedBatchYears: number[];
  allowedSectionIds: string[];
  allowExtraPasses: boolean;
  maxExtraPassesPerUser: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventVisibilityUpdate {
  isActive?: boolean;
  visibleToRoles?: VisibleRole[];
  studentFilterType?: StudentFilterType;
  allowedSchoolIds?: string[];
  allowedDepartmentIds?: string[];
  allowedProgramIds?: string[];
  allowedBatchYears?: number[];
  allowedSectionIds?: string[];
  allowExtraPasses?: boolean;
  maxExtraPassesPerUser?: number;
}

export interface SchoolItem {
  id: string;
  facultyName: string;
  facultyCode: string;
  shortName?: string;
}

export interface DepartmentItem {
  id: string;
  departmentName: string;
  departmentCode: string;
  shortName?: string;
  facultyId: string;
}

export interface ProgramItem {
  id: string;
  programName: string;
  programCode: string;
  shortName?: string;
  departmentId: string;
}

export interface SectionItem {
  id: string;
  sectionName: string;
  sectionCode: string;
  batchYear: number;
  academicYear: string;
  programId: string;
}

export interface HierarchyData {
  schools: SchoolItem[];
  departments: DepartmentItem[];
  programs: ProgramItem[];
  sections: SectionItem[];
  batchYears: number[];
}

export const ROLE_LABELS: Record<VisibleRole, string> = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Staff',
  admin: 'Admin',
  parent: 'Parent',
  superadmin: 'Super Admin',
};

export const ALL_ROLES: VisibleRole[] = ['student', 'faculty', 'staff', 'admin', 'parent', 'superadmin'];
