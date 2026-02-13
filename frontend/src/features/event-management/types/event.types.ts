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
  status: EventStatus;
  venue?: string;
  maxCapacity?: number;
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
  rulesAndGuidelines?: string;
  prizeDetails?: string;
  certificateAvailable?: boolean;
  faqs?: Array<{ question: string; answer: string }>;
  
  // Advanced Registration Settings
  autoApproveRegistration?: boolean;
  maxTeamLimit?: number;
  teamRegistrationDeadline?: string;
  allowEditAfterSubmission?: boolean;
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
  
  // Dynamic data (populated from API)
  customFields?: EventCustomField[];
  prizes?: EventPrize[];
  
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
  rulesAndGuidelines?: string;
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
  employeeId?: string;
  department?: string;
  program?: string;
  school?: string;
  institute: string;
  location?: string;
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
  existingRegistration?: {
    id: string;
    registrationId: string;
    status: RegistrationStatus;
    formData?: Record<string, any>;
    teamId?: string;
    isTeamLeader: boolean;
    team?: EventTeam;
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
  };
  members: TeamMember[];
  memberCount: {
    current: number;
    min?: number;
    max?: number;
  };
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
  autoApproveRegistration: boolean;
  maxTeamLimit?: number;
  teamRegistrationDeadline?: string;
  allowEditAfterSubmission: boolean;
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
  showParticipantsPublicly?: boolean;
  allowWithdrawRegistration?: boolean;
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
