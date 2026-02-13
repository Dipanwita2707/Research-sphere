export type NoteCategory = 'academic' | 'administrative';

export type NoteSubcategoryAcademic = 'events' | 'curriculum' | 'student_related' | 'exam';
export type NoteSubcategoryAdmin = 'infrastructure' | 'accounts_purchase' | 'non_academic_resources' | 'dsw_club_creation';
export type NoteSubcategory = NoteSubcategoryAcademic | NoteSubcategoryAdmin;

export type NoteStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'reverted';
export type ApprovalPeriod = 'one_time' | 'recurring';
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'annually';

export interface NotePoint {
  id?: string;
  sortOrder: number;
  content: string;
}

export interface NoteConfigCategory {
  value: string;
  label: string;
  subcategories: { value: string; label: string; idCode: string }[];
}

export interface NoteConfig {
  categories: NoteConfigCategory[];
  approvalPeriodOptions: { value: string; label: string }[];
  recurringFrequencyOptions: { value: string; label: string }[];
}

export interface CreatorInfo {
  name: string;
  employeeIdOrStudentId: string | null;
  role: string;
  department: string | null;
  school: string | null;
}

export interface Note {
  id: string;
  notingId: string;
  category: NoteCategory;
  subcategory: string;
  description: string;
  approvalPeriod: ApprovalPeriod;
  recurringFrequency?: RecurringFrequency | null;
  policyWithinSgtu?: boolean | null;
  policyOutsideSgtu?: boolean | null;
  policyBoth?: boolean | null;
  policyJustification?: string | null;
  policyCompliant?: boolean | null;
  amountRequired: boolean;
  amount?: number | string | null;
  eventName?: string | null;
  eventType?: 'workshop' | 'seminar' | 'conference' | 'competition' | 'cultural' | 'sports' | 'tech_fest' | 'hackathon' | 'webinar' | 'other' | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventPaymentType?: 'free' | 'paid' | null;
  status: NoteStatus;
  createdById: string;
  currentHolderId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    uid: string;
    email?: string | null;
    role: string;
    employeeDetails?: { firstName?: string; lastName?: string; displayName?: string; empId?: string; primaryDepartment?: { departmentName: string }; primarySchool?: { facultyName: string } };
    studentLogin?: {
      studentId?: string;
      displayName?: string;
      program?: {
        programName: string;
        department?: { departmentName: string; faculty?: { facultyName: string } };
      };
      section?: { sectionCode: string };
    };
  };
  currentHolder?: {
    id: string;
    uid: string;
    employeeDetails?: { displayName?: string; firstName?: string; lastName?: string };
  } | null;
  points?: NotePoint[];
  history?: NoteHistoryEntry[];
  attachments?: { id: string; fileName: string; filePath: string; fileDescription?: string | null }[];
  /** Present when listing with filter=handled: action you took and when */
  myAction?: { action: 'approved' | 'rejected' | 'forwarded' | 'reverted'; performedAt: string };
}

export interface NoteHistoryEntry {
  id: string;
  action: string;
  performedById: string;
  remarks?: string | null;
  createdAt: string;
  performedBy?: { id: string; uid: string; employeeDetails?: { displayName?: string; firstName?: string; lastName?: string } };
  nextHolder?: { id: string; uid: string; employeeDetails?: { displayName?: string } } | null;
}

export interface CreateNoteAttachmentPayload {
  filePath: string;
  fileName: string;
  fileDescription?: string | null;
}

export interface CreateNotePayload {
  category: NoteCategory;
  subcategory: string;
  description: string;
  approvalPeriod: ApprovalPeriod;
  recurringFrequency?: RecurringFrequency | null;
  policyCompliance?: 'yes' | 'no';
  amountRequired: boolean;
  amount?: number | null;
  points?: string[];
  attachments?: CreateNoteAttachmentPayload[];
  submit?: boolean;
}
