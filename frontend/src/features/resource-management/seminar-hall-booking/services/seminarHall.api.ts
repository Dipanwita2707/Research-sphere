import api, { unwrapResponse } from '@/shared/api/api';
import type { BookingRequestItem, ResourceBlock, ResourceRoom, ResourceRoomType } from '../types/roomBooking.types';

type SeminarHallRoomApiItem = {
  id: string;
  name: string;
  roomNumber?: string | null;
  type: ResourceRoomType;
  capacity: number;
  chairs: number;
  description?: string | null;
  isActive: boolean;
  block: {
    id: string;
    name: string;
    blockNumber?: string | null;
  };
  floor: {
    id: string;
    name: string;
    floorNumber: number;
  };
  facilities: Array<{
    quantity: number;
    notes?: string | null;
    facility: {
      id: string;
      name: string;
      category?: string | null;
    };
  }>;
};

type CreateSeminarHallBookingPayload = {
  roomId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  timeSlot: string;
  purpose: string;
  additionalRequirements?: string;
};

type SeminarHallBookingApiItem = {
  id: string;
  requestId: string;
  roomId?: string;
  requestKind: BookingRequestItem['requestKind'];
  status: BookingRequestItem['status'];
  bookingDate: string;
  startTime: string;
  endTime: string;
  timeSlot: string;
  purpose: string;
  additionalRequirements?: string | null;
  createdAt: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string | null;
  department: string;
  originalBookingDate?: string | null;
  originalStartTime?: string | null;
  originalEndTime?: string | null;
  requestedBookingDate?: string | null;
  requestedStartTime?: string | null;
  requestedEndTime?: string | null;
  room: {
    name: string;
    type: ResourceRoomType;
    block: {
      name: string;
    };
    floor: {
      name: string;
    };
  };
};

type UpdateSeminarHallBookingStatusPayload = {
  status: BookingRequestItem['status'];
  adminRemark?: string;
};

function formatBookingDateLabel(dateInput: string): string {
  const date = new Date(dateInput);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatCreatedAtLabel(dateInput: string): string {
  const date = new Date(dateInput);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `Requested on ${day} ${month}, ${time}`;
}

export function mapSeminarHallBookingToUiItem(booking: SeminarHallBookingApiItem): BookingRequestItem {
  return {
    id: booking.id,
    roomId: booking.roomId,
    requestKind: booking.requestKind,
    roomName: booking.room.name,
    roomType: booking.room.type,
    blockName: booking.room.block.name,
    floorName: booking.room.floor.name,
    bookingDate: formatBookingDateLabel(booking.bookingDate),
    timeSlot: booking.timeSlot,
    purpose: booking.purpose,
    additionalRequirements: booking.additionalRequirements || undefined,
    status: booking.status,
    createdAtLabel: formatCreatedAtLabel(booking.createdAt),
    requesterName: booking.requesterName,
    requesterEmail: booking.requesterEmail,
    requesterPhone: booking.requesterPhone || undefined,
    department: booking.department,
    originalBookingDate: booking.originalBookingDate ? formatBookingDateLabel(booking.originalBookingDate) : undefined,
    originalStartTime: booking.originalStartTime || undefined,
    originalEndTime: booking.originalEndTime || undefined,
    originalTimeSlot: booking.originalStartTime && booking.originalEndTime ? `${booking.originalStartTime} - ${booking.originalEndTime}` : undefined,
    requestedBookingDate: booking.requestedBookingDate ? formatBookingDateLabel(booking.requestedBookingDate) : undefined,
    requestedStartTime: booking.requestedStartTime || undefined,
    requestedEndTime: booking.requestedEndTime || undefined,
    requestedTimeSlot: booking.requestedStartTime && booking.requestedEndTime ? `${booking.requestedStartTime} - ${booking.requestedEndTime}` : undefined,
  };
}

export async function fetchSeminarHallBlocks(): Promise<ResourceBlock[]> {
  const response = await api.get('/seminar-hall/rooms', {
    params: {
      isActive: true,
    },
  });

  const rooms = unwrapResponse<SeminarHallRoomApiItem[]>(response);
  const blockMap = new Map<string, ResourceBlock>();

  rooms.forEach((room) => {
    let block = blockMap.get(room.block.id);

    if (!block) {
      block = {
        id: room.block.id,
        name: room.block.name,
        floors: [],
      };
      blockMap.set(room.block.id, block);
    }

    let floor = block.floors.find((item) => item.id === room.floor.id);

    if (!floor) {
      floor = {
        id: room.floor.id,
        name: room.floor.name,
        rooms: [],
      };
      block.floors.push(floor);
    }

    const mappedRoom: ResourceRoom = {
      id: room.id,
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      chairs: room.chairs,
      facilities: room.facilities.map((item) => item.facility.name),
      status: 'free',
      calendarAvailability: {},
    };

    floor.rooms.push(mappedRoom);
  });

  return Array.from(blockMap.values()).map((block) => ({
    ...block,
    floors: [...block.floors].sort((left, right) => left.name.localeCompare(right.name)),
  }));
}

export async function createSeminarHallBooking(payload: CreateSeminarHallBookingPayload): Promise<SeminarHallBookingApiItem> {
  const response = await api.post('/seminar-hall/bookings', payload);
  return unwrapResponse<SeminarHallBookingApiItem>(response);
}

export async function fetchSeminarHallBookingsRaw(): Promise<SeminarHallBookingApiItem[]> {
  try {
    const response = await api.get('/seminar-hall/bookings/availability');
    return unwrapResponse<SeminarHallBookingApiItem[]>(response);
  } catch (error) {
    console.error('[API] Error fetching bookings:', {
      message: error instanceof Error ? error.message : String(error),
      status: (error as any).response?.status,
      statusText: (error as any).response?.statusText,
      responseData: (error as any).response?.data,
    });
    return [];
  }
}

export async function fetchSeminarHallBookings(): Promise<BookingRequestItem[]> {
  const response = await api.get('/seminar-hall/bookings');
  const bookings = unwrapResponse<SeminarHallBookingApiItem[]>(response);
  return bookings.map(mapSeminarHallBookingToUiItem);
}

export async function updateSeminarHallBookingStatus(
  bookingId: string,
  payload: UpdateSeminarHallBookingStatusPayload,
): Promise<BookingRequestItem> {
  const response = await api.patch(`/seminar-hall/bookings/${bookingId}/status`, payload);
  const booking = unwrapResponse<SeminarHallBookingApiItem>(response);
  return mapSeminarHallBookingToUiItem(booking);
}