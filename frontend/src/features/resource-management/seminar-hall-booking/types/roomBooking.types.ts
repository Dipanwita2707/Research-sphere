export type ResourceRoomType = 'seminar_hall' | 'auditorium' | 'classroom' | 'conference_room';

export type RoomAvailabilityStatus = 'free' | 'occupied' | 'private';
export type RoomCalendarStatus = 'free' | 'booked';

export type BookingRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RoomBookingSnapshot {
  name: string;
  mobile: string;
  email: string;
  slotLabel: string;
}

export interface ResourceRoom {
  id: string;
  name: string;
  type: ResourceRoomType;
  capacity: number;
  chairs: number;
  facilities: string[];
  status: RoomAvailabilityStatus;
  booking?: RoomBookingSnapshot;
  calendarAvailability?: Record<string, RoomCalendarEntry>;
}

export interface RoomCalendarEntry {
  status: RoomCalendarStatus;
  slotLabel?: string;
  purpose?: string;
  bookedByName?: string;
  bookedByDepartment?: string;
  bookedByMobile?: string;
  bookedByEmail?: string;
}

export interface ResourceFloor {
  id: string;
  name: string;
  rooms: ResourceRoom[];
}

export interface ResourceBlock {
  id: string;
  name: string;
  floors: ResourceFloor[];
}

export interface BookingRequestItem {
  id: string;
  roomName: string;
  roomType: ResourceRoomType;
  blockName: string;
  floorName: string;
  bookingDate: string;
  timeSlot: string;
  purpose: string;
  additionalRequirements?: string;
  status: BookingRequestStatus;
  adminRemark?: string;
  createdAtLabel: string;
}
