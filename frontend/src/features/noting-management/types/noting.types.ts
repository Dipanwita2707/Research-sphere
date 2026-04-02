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
  departmentId?: string | null;
  departmentScope?: 'school' | 'central' | null;
  departmentName?: string | null;
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
  eventSponsors?: Array<{
    id?: string;
    name: string;
    originSource?: 'noting' | 'event';
    // New format fields
    sponsorType?: 'corporate' | 'individual' | 'organization' | 'other';
    contactPerson?: string;
    designation?: string;
    phone?: string;
    email?: string;
    notes?: string;
    contributionType?: 'cash' | 'in_kind' | 'both';
    cashAmount?: number;
    paymentStatus?: 'received' | 'pending' | 'partial' | 'not_received';
    paymentMethod?: 'cash' | 'upi' | 'card' | 'net_banking' | 'other';
    paymentMethodOtherLabel?: string;
    transactionId?: string;
    receipt?: { filePath: string; fileName: string } | null;
    sponsorLogo?: { filePath: string; fileName: string } | null;
    cashAssignedTo?: { id: string; uid: string; displayName: string; department?: string } | null;
    inKindItems?: Array<{
      itemName: string;
      category?: string;
      quantity?: number;
      estimatedValue?: number;
      description?: string;
      deliveryStatus?: 'pending' | 'received' | 'not_received';
      assignedTo?: { id: string; uid: string; displayName: string; department?: string } | null;
    }>;
    // Old format fields (backward compat)
    amount?: number;
    type?: 'cash' | 'in_kind';
  }> | null;
  eventHasResources?: boolean | null;
  eventResources?: { category?: string; type: string; description?: string; estimatedCost?: number; pricePerPiece?: number; quantity?: number }[] | null;
  eventCertification?: boolean | null;
  eventPrizesAwards?: { position: number; rank: string; title?: string; prizeType: string; prizeAmount?: number; additionalPerks?: string[]; sortOrder?: number }[] | null;
  notingEventType?: 'venue' | 'stall' | 'festival' | null;
  /** Optional club association for event notings */
  eventClubId?: string | null;
  stallConfig?: {
    enableStudentApplied: boolean;
    maxStudentStalls?: number;
    stallFee?: number;
    applicationDeadline?: string;
    enableCreatorMade: boolean;
    creatorStalls: { name: string; description: string; capacity: number }[];
  } | null;
  eventVisibilitySettings?: {
    visibleToRoles?: string[];
    studentFilterType?: 'all' | 'custom';
    allowedSchoolIds?: string[];
    allowedDepartmentIds?: string[];
    allowedProgramIds?: string[];
    allowedBatchYears?: number[];
    allowedSectionIds?: string[];
    allowExtraPasses?: boolean;
    maxExtraPassesPerUser?: number;
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
      eventSponsors?: any[] | null;
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
  // ── DSW Club Creation fields ──────────────────────────────────────────────
  clubName?: string | null;
  clubCategoryId?: string | null;
  clubPurpose?: string | null;
  clubAcademicSession?: string | null;
  clubTargetStudentGroup?: string[];
  clubMeetingFrequency?: string | null;
  clubExpectedActivityTypes?: string[];
  clubEstimatedAnnualActivityCount?: number | null;
  clubExpectedStudentStrength?: number | null;
  clubFacultyFacilitatorId?: string | null;
  clubChairpersonId?: string | null;
  clubInitialMembers?: string[];
  clubProposedEmail?: string | null;
  clubSocialMediaHandles?: { facebook?: string; instagram?: string; twitter?: string; linkedin?: string } | null;
  clubCodeOfConductAccepted?: boolean | null;
  clubAntiDiscriminationAccepted?: boolean | null;
  /** Resolved display names for club UUIDs — populated by backend for dsw_club_creation notes */
  clubDetails?: {
    categoryName: string | null;
    parentCategoryName: string | null;
    facultyFacilitator: { id: string; uid: string; name: string; department?: string | null; designation?: string | null } | null;
    chairperson: { id: string; uid: string; name: string; department?: string | null; program?: string | null } | null;
    members: { id: string; uid: string; name: string }[];
  } | null;
  status: NoteStatus;
  createdById: string;
  currentHolderId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    uid: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    employeeDetails?: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      empId?: string;
      designation?: string | null;
      email?: string | null;
      phoneNumber?: string | null;
      primaryDepartment?: { departmentName: string };
      primarySchool?: { facultyName: string };
    };
    studentLogin?: {
      studentId?: string;
      displayName?: string;
      email?: string | null;
      phone?: string | null;
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
  departmentId?: string | null;
  departmentScope?: 'school' | 'central' | null;
  description: string;
  approvalPeriod: ApprovalPeriod;
  recurringFrequency?: RecurringFrequency | null;
  policyCompliance?: 'yes' | 'no';
  amountRequired: boolean;
  amount?: number | null;
  points?: string[];
  attachments?: CreateNoteAttachmentPayload[];
  submit?: boolean;
  /** Optional club association — when set, the club's chairperson auto-receives event management permissions */
  eventClubId?: string | null;
}

export interface NotingAnalyticsUser {
  id: string;
  uid: string | null;
  role: string | null;
  displayName: string | null;
  employeeIdOrStudentId: string | null;
  department: string | null;
  school: string | null;
}

export interface NotingAdminNoteSummary {
  id: string;
  notingId: string;
  category: string;
  categoryLabel: string;
  subcategory: string;
  subcategoryLabel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
  historyCount: number;
  createdBy: NotingAnalyticsUser | null;
  currentHolder: {
    id: string;
    uid: string;
    displayName: string;
  } | null;
  metadata: {
    approvalPeriod: string;
    amountRequired: boolean;
    amount: number | null;
    eventName: string | null;
    notingEventType: string | null;
    clubName: string | null;
  };
}

export interface NotingAdminOverview {
  summary: {
    totalNotings: number;
    notesWithFiles: number;
    totalAttachments: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    reverted: number;
    draft: number;
  };
  byStatus: Record<string, number>;
  byCategory: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  bySubcategory: Array<{
    key: string;
    category: string;
    categoryLabel: string;
    label: string;
    count: number;
  }>;
  createdTimeline: Array<{
    date: string;
    count: number;
  }>;
  recentNotes: NotingAdminNoteSummary[];
  moderationQueue: NotingAdminNoteSummary[];
}

export interface NotingAdminUserStat {
  user: NotingAnalyticsUser;
  totalNotings: number;
  notesWithFiles: number;
  latestCreatedAt: string | null;
  byStatus: Record<string, number>;
}

export interface NotingAdminUserAnalytics {
  summary: {
    totalCreators: number;
    totalNotings: number;
    averageNotesPerCreator: number;
    mostRecentCreatedAt: string | null;
  };
  creators: NotingAdminUserStat[];
}

export interface NotingAdminActivityItem {
  id: string;
  action: string;
  remarks?: string | null;
  createdAt: string;
  note: {
    id: string;
    notingId: string;
    status: string;
    category: string;
    categoryLabel: string;
    subcategory: string;
    subcategoryLabel: string;
    createdAt: string;
    createdBy: NotingAnalyticsUser | null;
  };
  performedBy: NotingAnalyticsUser | null;
  nextHolder: {
    id: string;
    uid: string;
    displayName: string;
  } | null;
}

export interface NotingAdminActivityAnalytics {
  summary: {
    totalActivities: number;
    byAction: Record<string, number>;
  };
  items: NotingAdminActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotingTabSummary {
  mine: number;
  pending: number;
  handledApproved: number;
  handledRejected: number;
  copies: number;
  pendingPreviewIds: string[];
  copyPreviewIds: string[];
}
