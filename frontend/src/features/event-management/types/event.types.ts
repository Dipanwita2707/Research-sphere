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
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'waitlisted';

export type PaymentStatus = 
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded';

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
