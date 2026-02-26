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
  eventParticipationType?: 'individual' | 'team' | null;
  eventRegistrationFeeIndividual?: number | null;
  eventRegistrationFeeTeam?: number | null;
  eventApproxCapacity?: number | null;
  eventDutyLeaveAvailable?: boolean | null;
  eventDutyLeaveEligibility?: string[] | null;
  eventDutyLeaveRoleType?: 'participants' | 'organizers' | 'both' | null;
  eventHasSponsorship?: boolean | null;
  eventSponsors?: { name: string; amount: number; type: 'cash' | 'in_kind'; notes?: string }[] | null;
  eventHasResources?: boolean | null;
  eventResources?: { category?: string; type: string; description?: string; estimatedCost?: number; pricePerPiece?: number; quantity?: number }[] | null;
  eventCertification?: boolean | null;
  eventPrizesAwards?: { position: number; rank: string; title?: string; prizeType: string; prizeAmount?: number; additionalPerks?: string[]; sortOrder?: number }[] | null;
  notingEventType?: 'venue' | 'stall' | 'festival' | null;
  stallConfig?: {
    enableStudentApplied: boolean;
    maxStudentStalls?: number;
    stallFee?: number;
    applicationDeadline?: string;
    enableCreatorMade: boolean;
    creatorStalls: { name: string; description: string; capacity: number }[];
  } | null;
  festivalMeta?: { name: string; startDate: string; endDate: string; description?: string; coordinator?: string } | null;
  subEvents?: Array<{
    id?: string;
    eventType: 'venue' | 'stall';
    venueFormData: {
      eventName: string;
      eventType: string;
      eventStartDate: string;
      eventEndDate: string;
      eventPaymentType: 'free' | 'paid';
      eventParticipationType: 'individual' | 'team';
      eventRegistrationFeeIndividual?: number | null;
      eventRegistrationFeeTeam?: number | null;
      eventApproxCapacity?: number | null;
      eventDutyLeaveAvailable?: boolean | null;
      eventDutyLeaveEligibility?: string[] | null;
      eventDutyLeaveRoleType?: string | null;
      eventHasSponsorship?: boolean | null;
      eventSponsors?: { name: string; amount: number; type: string; notes?: string }[] | null;
      eventHasResources?: boolean | null;
      eventResources?: { type: string; description?: string; pricePerPiece?: number; quantity?: number }[] | null;
      eventCertification?: boolean | null;
      eventPrizesAwards?: { position: number; rank: string; title?: string; prizeType: string; prizeAmount?: number; additionalPerks?: string[] }[] | null;
    };
    stallConfig?: {
      enableStudentApplied: boolean;
      maxStudentStalls?: number;
      stallFee?: number;
      applicationDeadline?: string;
      enableCreatorMade: boolean;
      creatorStalls: { name: string; description: string; capacity: number }[];
    } | null;
  }> | null;
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
  /** Present in list view: counts for history and attachments */
  _count?: { history?: number; attachments?: number };
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

export interface NoteCopyReply {
  id: string;
  copyId: string;
  repliedById: string;
  remarks: string;
  attachments?: { filePath: string; fileName: string; fileDescription?: string | null }[];
  createdAt: string;
  repliedBy?: { id: string; uid: string; employeeDetails?: { displayName?: string } };
}

export interface NoteCopy {
  id: string;
  noteId: string;
  sentById: string;
  assignedToId: string;
  remarks: string;
  status: 'pending' | 'replied' | 'forwarded' | 'completed';
  escalationLevel: number;
  escalatedToId?: string | null;
  rootCopyId?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { id: string; uid: string; employeeDetails?: { displayName?: string; firstName?: string; lastName?: string } };
  escalatedTo?: { id: string; uid: string; employeeDetails?: { displayName?: string } } | null;
  sentBy?: { id: string; uid: string; employeeDetails?: { displayName?: string } };
  replies?: NoteCopyReply[];
  note?: {
    id: string;
    notingId: string;
    category: string;
    subcategory: string;
    description: string;
    status: string;
    amount?: number | string | null;
    amountRequired?: boolean;
    approvalPeriod?: string;
    recurringFrequency?: string | null;
    policyWithinSgtu?: boolean;
    policyOutsideSgtu?: boolean;
    policyBoth?: boolean;
    policyJustification?: string | null;
    policyCompliant?: boolean | null;
    createdAt?: string;
    points?: { id: string; content: string; sortOrder: number }[];
    attachments?: { id: string; filePath: string; fileName: string; fileDescription?: string | null }[];
    createdBy?: { uid: string; employeeDetails?: { displayName?: string } };
  };
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
