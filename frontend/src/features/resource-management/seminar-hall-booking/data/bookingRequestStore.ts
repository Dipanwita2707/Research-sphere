import type { BookingRequestItem } from '../types/roomBooking.types';
import { mockBookingRequests } from './mockBookings';

const BOOKING_REQUESTS_STORAGE_KEY = 'seminar_booking_requests_v1';
const BOOKING_REQUESTS_UPDATED_EVENT = 'seminar-booking-requests-updated';

function cloneSeedData(): BookingRequestItem[] {
  return mockBookingRequests.map((request) => ({ ...request }));
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readStoredRequests(): BookingRequestItem[] | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(BOOKING_REQUESTS_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as BookingRequestItem[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getBookingRequests(): BookingRequestItem[] {
  if (!isBrowser()) {
    return cloneSeedData();
  }

  const stored = readStoredRequests();
  if (stored) {
    return stored;
  }

  const seeded = cloneSeedData();
  window.localStorage.setItem(BOOKING_REQUESTS_STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveBookingRequests(requests: BookingRequestItem[]): void {
  if (!isBrowser()) return;

  window.localStorage.setItem(BOOKING_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new Event(BOOKING_REQUESTS_UPDATED_EVENT));
}

export function appendBookingRequest(request: BookingRequestItem): BookingRequestItem[] {
  const existing = getBookingRequests();
  const next = [request, ...existing];
  saveBookingRequests(next);
  return next;
}

export function createBookingRequestId(): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const randomSuffix = Math.floor(Math.random() * 900 + 100);
  return `REQ-${timestamp}-${randomSuffix}`;
}

export function subscribeBookingRequests(listener: (requests: BookingRequestItem[]) => void): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }

  const internalUpdateHandler = () => listener(getBookingRequests());
  const storageHandler = (event: StorageEvent) => {
    if (event.key === BOOKING_REQUESTS_STORAGE_KEY) {
      listener(getBookingRequests());
    }
  };

  window.addEventListener(BOOKING_REQUESTS_UPDATED_EVENT, internalUpdateHandler);
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener(BOOKING_REQUESTS_UPDATED_EVENT, internalUpdateHandler);
    window.removeEventListener('storage', storageHandler);
  };
}
