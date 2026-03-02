/**
 * Event Management Types
 */

export type EventType =
  | 'seminar'
  | 'workshop'
  | 'fest'
  | 'conference'
  | 'competition'
  | 'cultural'
  | 'technical'
  | 'sports'
  | 'other';

export type EventPaymentType = 'free' | 'paid';

export type EventStatus =
  | 'draft'
  | 'published'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

export type OpportunityMode = 'online' | 'offline' | 'hybrid';

export type ParticipationType = 'individual' | 'team';

export type RegistrationStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'waitlisted'
  | 'rejected'
  | 'incomplete_team';

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded';

export type EventFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'time'
  | 'datetime'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'image';

export type TeamStatus =
  | 'forming'
  | 'complete'
  | 'confirmed'
  | 'disqualified'
  | 'withdrawn';

export type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

export interface Event {
  id: string;
  eventId: string;
  notingId: string;
  name: string;
  eventType: EventType;
  description?: string;
  longDescription?: string;
  startDate: string;
  endDate: string;
  paymentType: EventPaymentType;
  registrationFee?: number;
  teamRegistrationFee?: number;
  status: EventStatus;
  venue?: string;
  maxCapacity?: number;
  approxCapacity?: number;
  dutyLeaveAvailable?: boolean;
  dutyLeaveEligibility?: string[];
  dutyLeaveRoleType?: 'participants' | 'organizers' | 'both';
  hasSponsorship?: boolean;
  sponsors?: Array<{ name: string; amount: number; type: string; notes?: string }>;
  showSponsorshipPublicly?: boolean;  // Creator decides at publish: show sponsorship to users
  hasResources?: boolean;
  resources?: Array<{ category: string; type: string; description: string; estimatedCost?: number }>;
  currentRegistrations: number;
  isPaid: boolean;
  registrationStartDate?: string;
  registrationEndDate?: string;
  publishedAt?: string;

  // Event Branding
  bannerImageUrl?: string;
  logoImageUrl?: string;

  // Opportunity Mode & Participation
  opportunityMode?: OpportunityMode;
  participationType?: ParticipationType;
  minTeamSize?: number;
  maxTeamSize?: number;
  interCollegeAllowed?: boolean;
  interSpecializationAllowed?: boolean;

  // Contact Details
  contactPersonName?: string;
  contactEmail?: string;
  contactMobile?: string;
  alternateContact?: string;
  websiteUrl?: string;
  socialMediaLinks?: Record<string, string>;

  // Additional Information
  eligibilityCriteria?: string;
  eligibilityDisplayFormat?: 'points' | 'paragraph' | 'both';
  rulesAndGuidelines?: string;
  rulesDisplayFormat?: 'points' | 'paragraph' | 'both';
  prizeDetails?: string;
  certificateAvailable?: boolean;
  faqs?: Array<{ question: string; answer: string }>;

  // Advanced Registration Settings
  maxTeamLimit?: number;
  teamRegistrationDeadline?: string;
  requireFormSubmission?: boolean;
  lookingForTeammatesEnabled?: boolean;

  // Team Settings (additional)
  allowCrossInstituteTeams?: boolean;
  allowTeamEditAfterSubmission?: boolean;
  autoApproveTeams?: boolean;

  // Registration Control Settings
  registrationCap?: number;
  showParticipantsPublicly?: boolean;
  allowWithdrawRegistration?: boolean;
  lockTeamAfterDeadline?: boolean;

  // Team Discovery Settings
  allowPublicTeamListing?: boolean;
  allowJoinRequests?: boolean;
  allowInviteSystem?: boolean;

  // Prize Settings
  prizesEnabled?: boolean;

  // Stall Settings
  hasStalls?: boolean;
  notingEventType?: 'venue' | 'stall' | 'festival';
  stallConfig?: Record<string, any>;
  applicationDeadline?: string;
  festivalNotingId?: string | null;
  festivalMeta?: { name: string; startDate: string; endDate: string; description?: string; coordinator?: string } | null;

  // Dynamic data (populated from API)
  customFields?: EventCustomField[];
  prizes?: EventPrize[];
  stalls?: Stall[];

  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    uid: string;
    email?: string;
    name: string;
  };
  note?: {
    notingId: string;
    status: string;
    category: string;
    subcategory: string;
  };
  userRegistration?: {
    id: string;
    registrationId: string;
    qrCode: string;
    status: RegistrationStatus;
    hasEntered: boolean;
    registeredAt: string;
  };
}

export interface EventRegistration {
  id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  status: RegistrationStatus;
  qrCode: string;
  paymentStatus?: PaymentStatus;
  paymentId?: string;
  amountPaid?: number;
  hasEntered: boolean;
  enteredAt?: string;
  registeredAt: string;
  updatedAt: string;
  event?: Event;
  user?: {
    id: string;
    uid: string;
    email?: string;
    name: string;
  };
}

export interface EventVolunteer {
  id: string;
  eventId: string;
  userId: string;
  role?: string;
  canScanQr: boolean;
  assignedGate?: string;
  assignedAt: string;
  user?: {
    id: string;
    uid: string;
    email?: string;
    name: string;
  };
}

export interface EventEntry {
  id: string;
  eventId: string;
  registrationId: string;
  volunteerId: string;
  entryType: 'entry' | 'exit';
  scannedAt: string;
  gateLocation?: string;
  remarks?: string;
  registration?: EventRegistration;
  volunteer?: EventVolunteer;
}

export interface EventStatistics {
  totalRegistrations: number;
  confirmedRegistrations: number;
  pendingRegistrations: number;
  cancelledRegistrations: number;
  waitlistedRegistrations: number;
  totalAttended: number;
  totalEntries: number;
  totalExits: number;
  currentlyInside: number;
  volunteerCount: number;
  totalRevenue?: number;
  revenueCollected?: number;
  registrationsByDate: Array<{
    date: string;
    count: number;
  }>;
  recentRegistrations?: Array<{
    id: string;
    registrationId: string;
    status: RegistrationStatus;
    paymentStatus?: PaymentStatus;
    amountPaid?: number;
    hasEntered: boolean;
    registeredAt: string;
    user?: {
      id: string;
      uid: string;
      email?: string;
      name: string;
    };
  }>;
}

export interface EventFormData {
  description?: string;
  longDescription?: string;
  venue?: string;
  maxCapacity?: number;
  registrationFee?: number;
  registrationStartDate?: string;
  registrationEndDate?: string;

  // Event Branding
  bannerImageUrl?: string;
  logoImageUrl?: string;

  // Opportunity Mode & Participation
  opportunityMode?: OpportunityMode;
  participationType?: ParticipationType;
  minTeamSize?: number;
  maxTeamSize?: number;
  interCollegeAllowed?: boolean;
  interSpecializationAllowed?: boolean;

  // Contact Details
  contactPersonName?: string;
  contactEmail?: string;
  contactMobile?: string;
  alternateContact?: string;
  websiteUrl?: string;
  socialMediaLinks?: Record<string, string>;

  // Additional Information
  eligibilityCriteria?: string;
  eligibilityDisplayFormat?: 'points' | 'paragraph' | 'both';
  rulesAndGuidelines?: string;
  rulesDisplayFormat?: 'points' | 'paragraph' | 'both';
  prizeDetails?: string;
  certificateAvailable?: boolean;
  faqs?: Array<{ question: string; answer: string }>;
}

export interface VolunteerFormData {
  userId: string;
  role?: string;
  canScanQr?: boolean;
  assignedGate?: string;
}

export interface QRScanData {
  qrCode: string;
  entryType: 'entry' | 'exit';
  gateLocation?: string;
  remarks?: string;
}

export interface EventFilters {
  status?: EventStatus;
  eventType?: EventType;
  search?: string;
  myEvents?: boolean;
}

export interface EventListResponse {
  events: Event[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Advanced Registration Types
// ============================================

export interface EventCustomField {
  id: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: EventFieldType;
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[] | { label: string; value: string }[];
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  defaultValue?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface UserProfile {
  userId: string;
  uid: string;
  email?: string;
  phone?: string;
  userType: 'student' | 'employee';
  firstName: string;
  lastName?: string;
  displayName: string;
  registrationNo?: string;
  studentId?: string;
  employeeId?: string;
  gender?: string;
  department?: string;
  program?: string;
  school?: string;
  passOutYear?: string;
  institute: string;
  location?: string;
}

export interface ProfileFields {
  uid: boolean;
  registrationNo: boolean;
  studentId: boolean;
  employeeId: boolean;
  gender: boolean;
  school: boolean;
  department: boolean;
  program: boolean;
  passOutYear: boolean;
}

export interface RegistrationFormData {
  event: {
    id: string;
    eventId: string;
    name: string;
    participationType: ParticipationType;
    minTeamSize?: number;
    maxTeamSize?: number;
    interCollegeAllowed?: boolean;
    requireFormSubmission: boolean;
    paymentType: EventPaymentType;
    registrationFee?: number;
  };
  customFields: EventCustomField[];
  userProfile: UserProfile;
  profileFields: ProfileFields;
  existingRegistration?: {
    id: string;
    registrationId: string;
    status: RegistrationStatus;
    paymentStatus?: string | null;
    qrCode?: string;
    amountPaid?: number | null;
    formData?: Record<string, any>;
    teamId?: string;
    isTeamLeader: boolean;
    team?: {
      id: string;
      teamId: string;
      name: string;
      leaderId: string;
      members: {
        id: string;
        userId: string;
        role: string;
        name: string;
        email?: string | null;
        phone?: string | null;
        uid?: string | null;
        registrationNo?: string | null;
      }[];
    } | null;
  };
}

export interface EventTeam {
  id: string;
  teamId: string;
  name: string;
  status: TeamStatus;
  lookingForMembers: boolean;
  isComplete: boolean;
  isLocked: boolean;
  leaderId: string;
  isLeader: boolean;
  meetsMinimumRequirement?: boolean; // Backend calculated flag to check if team can be finalized
  event: {
    id: string;
    eventId: string;
    name: string;
    minTeamSize?: number;
    maxTeamSize?: number;
    interCollegeAllowed?: boolean;
    teamRegistrationDeadline?: string;
    paymentType?: string;
    registrationFee?: number;
    teamRegistrationFee?: number;
  };
  members: TeamMember[];
  memberCount: {
    current: number;
    min?: number;
    max?: number;
  };
  /** Each viewer's own EventRegistration for this event (contains their QR code) */
  myRegistration?: {
    id: string;
    registrationId: string;
    status: string;
    paymentStatus?: string | null;
    qrCode: string;
    amountPaid?: number | null;
    isTeamLeader: boolean;
  } | null;
  pendingInvitations?: TeamInvitation[];
  pendingRequests?: TeamRequest[];
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  role: 'leader' | 'member';
  status: 'pending' | 'confirmed' | 'removed' | 'left';
  joinedAt: string;
  name: string;
  email?: string;
  phone?: string;
  uid: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  firstName?: string;
  lastName?: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeId: string;
  status: InvitationStatus;
  message?: string;
  expiresAt?: string;
  createdAt: string;
  team?: EventTeam;
  inviter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  invitee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface TeamRequest {
  id: string;
  teamId: string;
  requesterId: string;
  status: RequestStatus;
  message?: string;
  respondedAt?: string;
  createdAt: string;
  team?: EventTeam;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  requester?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface SearchableUser {
  id: string;
  uid: string;
  email?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  institute: string;
  department?: string;
  program?: string;
  userType: 'student' | 'employee';
}

export interface TeamSearchResult {
  id: string;
  teamId: string;
  name: string;
  status: TeamStatus;
  createdAt: string;
  memberCount: number;
  maxSize?: number;
  leader?: {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    institute?: string;
  };
  hasRequestPending: boolean;
}

export interface RegistrationDashboard {
  registrations: Array<EventRegistration & {
    teamCompletion?: {
      current: number;
      min?: number;
      max?: number;
      isComplete: boolean;
    };
  }>;
  pendingInvitations: TeamInvitation[];
  sentRequests: TeamRequest[];
  summary: {
    totalRegistrations: number;
    confirmedRegistrations: number;
    pendingRegistrations: number;
    incompleteTeams: number;
    pendingInvitationsCount: number;
    sentRequestsCount: number;
  };
}

export interface RegistrationSettings {
  id: string;
  eventId: string;
  name: string;
  participationType: ParticipationType;
  minTeamSize?: number;
  maxTeamSize?: number;
  interCollegeAllowed?: boolean;
  maxTeamLimit?: number;
  teamRegistrationDeadline?: string;
  requireFormSubmission: boolean;
  lookingForTeammatesEnabled: boolean;
  registrationStartDate?: string;
  registrationEndDate?: string;
  maxCapacity?: number;

  // Additional Team Settings
  allowCrossInstituteTeams?: boolean;
  allowTeamEditAfterSubmission?: boolean;
  autoApproveTeams?: boolean;

  // Registration Control Settings
  registrationCap?: number;
  lockTeamAfterDeadline?: boolean;

  // Team Discovery Settings
  allowPublicTeamListing?: boolean;
  allowJoinRequests?: boolean;
  allowInviteSystem?: boolean;

  // Prize Settings
  prizesEnabled?: boolean;
}

// ============================================
// Prize Types
// ============================================

export type PrizeType =
  | 'cash'
  | 'certificate'
  | 'internship'
  | 'merchandise'
  | 'trophy'
  | 'scholarship'
  | 'voucher'
  | 'custom';

export interface EventPrize {
  id?: string;
  eventId?: string;
  position: number;
  rank: string;
  title: string;
  description?: string;
  prizeType: PrizeType;
  prizeAmount?: number;
  additionalPerks?: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrizeFormData {
  position: number;
  rank: string;
  title: string;
  description?: string;
  prizeType: PrizeType;
  prizeAmount?: number;
  additionalPerks?: string[];
}

// ============================================
// Stall Management Types
// ============================================

export type StallApplicationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type StallType = 'food' | 'non_food' | 'service' | 'other';

export type StallSource = 'creator' | 'student_approved';

export interface StallApplication {
  id: string;
  applicationId: string;
  eventId: string;
  userId: string;
  status: StallApplicationStatus;
  ownerName?: string;
  ownerEmail?: string;
  ownerSchool?: string;
  ownerDepartment?: string;

  // Stall Info
  stallName: string;
  stallType: StallType;
  category?: string;

  // Business Info
  businessName?: string;
  businessDescription?: string;
  products?: string[];

  // Infrastructure
  spaceRequired?: number;
  electricityRequired?: boolean;
  waterRequired?: boolean;
  specialRequirements?: string;

  // Payment
  stallFee?: number;
  paymentStatus?: 'pending' | 'paid';

  // Documents
  gstNumber?: string;
  foodLicenseNumber?: string;
  documentUrls?: string[];

  // Terms
  termsAccepted: boolean;

  // QR Code (generated on approval)
  qrCode?: string;
  stallId?: string;

  // Timestamps
  appliedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
  rejectionReason?: string;

  user?: {
    id: string;
    uid: string;
    name: string;
    email?: string;
  };
  event?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
}

export interface StallMetadata {
  businessName?: string | null;
  electricityRequired?: boolean;
  waterRequired?: boolean;
  specialRequirements?: string | null;
  products?: string[];
}

export interface Stall {
  id: string;
  stallId: string;
  eventId: string;
  stallName: string;
  stallType: StallType;
  category?: string;
  source: StallSource;
  location?: string;
  qrCode: string;
  isActive: boolean;
  createdAt: string;
  stallMetadata?: StallMetadata | null;
  owner?: {
    id: string;
    uid: string;
    name: string;
    email?: string;
  };
  application?: StallApplication;
}

export interface StallOpportunity {
  id: string;
  eventId: string;
  name: string;
  startDate: string;
  endDate: string;
  venue?: string;
  applicationDeadline?: string;
  maxStudentStalls?: number;
  stallFee?: number;
  stallsApproved: number;
  stallsRemaining?: number;
  myApplication?: StallApplication;
  status?: string;
}

export interface StallApplicationFormData {
  stallName: string;
  stallType: StallType;
  category?: string;
  businessName?: string;
  businessDescription?: string;
  products?: string[];
  spaceRequired?: number;
  electricityRequired?: boolean;
  waterRequired?: boolean;
  specialRequirements?: string;
  gstNumber?: string;
  foodLicenseNumber?: string;
  documentUrls?: string[];
  termsAccepted: boolean;
}

// ============================================
// Razorpay Payment Types
// ============================================

export type PaymentRecordStatus = 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
export type PaymentFor = 'individual' | 'team';

export interface PaymentRecord {
  id: string;
  registrationId?: string;
  eventId: string;
  userId: string;
  teamId?: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number;
  currency: string;
  status: PaymentRecordStatus;
  paymentFor: PaymentFor;
  receipt: string;
  attempts: number;
  paidAt?: string;
  failedAt?: string;
  refundedAt?: string;
  webhookVerified: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RazorpayOrderResponse {
  order: {
    id: string;
    amount: number; // in paise
    currency: string;
  };
  payment: PaymentRecord;
  key: string; // Razorpay public key
  registrationId?: string;
  teamId?: string;
}

export interface PaymentVerificationRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  message: string;
  payment: PaymentRecord;
}

export interface PaymentStatusResponse {
  isPaid: boolean;
  latestPayment: PaymentRecord | null;
  payments: PaymentRecord[];
}

/** Razorpay Checkout options (subset used by our integration) */
export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: PaymentVerificationRequest) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

/** Global Razorpay Checkout constructor (loaded via script tag) */
declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}
