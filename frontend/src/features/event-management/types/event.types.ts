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
  totalRevenue?: number;
  revenueCollected?: number;
  registrationsByDate: Array<{
    date: string;
    count: number;
  }>;
}

export interface EventFormData {
  description?: string;
  venue?: string;
  maxCapacity?: number;
  registrationFee?: number;
  registrationStartDate?: string;
  registrationEndDate?: string;
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
