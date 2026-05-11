import type { BookingRequestItem, BookingRequestStatus } from '../types/roomBooking.types';
import { mockBookingRequests } from './mockBookings';

export type AdminBookingStatus = BookingRequestStatus;
export type AdminBookingRequest = BookingRequestItem;

export const mockAdminBookingRequests: AdminBookingRequest[] = mockBookingRequests.filter(
  (request) => request.status === 'pending' || request.status === 'cancel_pending' || request.status === 'reschedule_pending',
);
