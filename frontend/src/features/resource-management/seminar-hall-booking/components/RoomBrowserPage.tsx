'use client';

import { Activity, ArrowUpRight, CalendarX2, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { createSeminarHallBooking, fetchSeminarHallBlocks, fetchSeminarHallBookingsRaw } from '../services/seminarHall.api';
import type { ResourceBlock, ResourceRoom, RoomCalendarEntry } from '../types/roomBooking.types';

const allowedRoomTypes: ResourceRoom['type'][] = ['seminar_hall', 'auditorium'];

type BlockCalendarEntry = RoomCalendarEntry & {
  roomId?: string;
  roomName?: string;
  roomType?: ResourceRoom['type'];
  capacity?: number;
  chairs?: number;
  facilities?: string[];
};

type LiveBookingEntry = {
  id: string;
  roomId: string;
  roomName: string;
  roomType: ResourceRoom['type'];
  blockName: string;
  floorName: string;
  bookingDateKey: string;
  startTime: string;
  endTime: string;
  slotLabel: string;
  purpose: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  department?: string;
};

type RoomVisibilityFilter = 'all' | 'free' | 'booked';

const roomTypeLabels: Record<ResourceRoom['type'], string> = {
  seminar_hall: 'Seminar Hall',
  auditorium: 'Auditorium',
  classroom: 'Classroom',
  conference_room: 'Conference Room',
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function prettyLongDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function buildMonthDates(anchorDate: Date): Date[] {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1));
}

function buildMonthGrid(anchorDate: Date): Array<Date | null> {
  const dates = buildMonthDates(anchorDate);
  const firstDayOfWeek = dates[0]?.getDay() ?? 0;
  const leadingEmptyCells = Array.from({ length: firstDayOfWeek }, () => null);
  const combined = [...leadingEmptyCells, ...dates];
  const trailingCount = combined.length % 7 === 0 ? 0 : 7 - (combined.length % 7);
  const trailingEmptyCells = Array.from({ length: trailingCount }, () => null);
  return [...combined, ...trailingEmptyCells];
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function formatBookingDateLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatCreatedAtLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `Requested on ${day} ${month}, ${time}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatTime12Hour(time24: string): string {
  const [hourString, minuteString] = time24.split(':');
  const hour = Number(hourString);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, '0')}:${minuteString} ${period}`;
}

function getDurationLabel(startTime: string, endTime: string): string {
  if (!startTime || !endTime) return '';
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (totalMinutes <= 0) return '';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  return `${hours}h ${minutes}m`;
}

function getCurrentTimeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function overlapsTimeRange(startTime: string, endTime: string, selectedStartTime: string, selectedEndTime: string): boolean {
  return startTime < selectedEndTime && endTime > selectedStartTime;
}

export default function RoomBrowserPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.userType === 'admin';
  const currentUserEmail = (user?.email || '').trim().toLowerCase();
  
  const weekDayLabels = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], []);
  const today = useMemo(() => new Date(), []);
  const [resourceBlocks, setResourceBlocks] = useState<ResourceBlock[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string>('');
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(toDateKey(today));
  const [visibleMonthAnchorDate, setVisibleMonthAnchorDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [startTimeValue, setStartTimeValue] = useState<string>('');
  const [endTimeValue, setEndTimeValue] = useState<string>('');
  const [additionalRequirement, setAdditionalRequirement] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('Room booking request');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [liveBookings, setLiveBookings] = useState<LiveBookingEntry[]>([]);
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [roomVisibilityFilter, setRoomVisibilityFilter] = useState<RoomVisibilityFilter>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<LiveBookingEntry | null>(null);
  const [editNewDateKey, setEditNewDateKey] = useState<string>('');
  const [editNewStartTime, setEditNewStartTime] = useState<string>('');
  const [editNewEndTime, setEditNewEndTime] = useState<string>('');
  const [actionRequestBookingId, setActionRequestBookingId] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const loadRooms = async () => {
      try {
        setRoomsLoading(true);
        setRoomsError('');
        const [blocks, bookings] = await Promise.all([fetchSeminarHallBlocks(), fetchSeminarHallBookingsRaw()]);

        if (!isMounted) {
          return;
        }

        setResourceBlocks(blocks);
        setLiveBookings(
          bookings
            .filter((booking) => booking.status === 'approved')
            .filter((booking) => Boolean(booking.roomId))
            .map((booking) => ({
              id: booking.id,
              roomId: booking.roomId as string,
              roomName: booking.room.name,
              roomType: booking.room.type,
              blockName: booking.room.block.name,
              floorName: booking.room.floor.name,
              bookingDateKey: booking.bookingDate.slice(0, 10),
              startTime: booking.startTime,
              endTime: booking.endTime,
              slotLabel: booking.timeSlot,
              purpose: booking.purpose,
              requesterName: booking.requesterName,
              requesterEmail: booking.requesterEmail,
              requesterPhone: booking.requesterPhone || undefined,
              department: booking.department || undefined,
            })),
        );
        setSelectedBlockId((current) => current || blocks[0]?.id || '');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setRoomsError('Unable to load seminar hall rooms from backend. Please check backend server and API URL.');
      } finally {
        if (isMounted) {
          setRoomsLoading(false);
        }
      }
    };

    loadRooms();

    // Auto-refresh bookings every 10 seconds so rescheduled bookings approved by admin appear
    const refreshInterval = setInterval(() => {
      if (isMounted) {
        loadRooms();
      }
    }, 10000);

    return () => {
      clearInterval(refreshInterval);
      isMounted = false;
    };
  }, []);

  const timeOptions = useMemo(
    () =>
      ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(
        (value) => ({ value, label: formatTime12Hour(value) }),
      ),
    [],
  );

  const selectedBlock = useMemo(
    () => resourceBlocks.find((block) => block.id === selectedBlockId),
    [resourceBlocks, selectedBlockId],
  );

  const calendarGridCells = useMemo(() => buildMonthGrid(visibleMonthAnchorDate), [visibleMonthAnchorDate]);

  const blockRooms = useMemo<ResourceRoom[]>(() => {
    if (!selectedBlock) return [];
    return selectedBlock.floors.flatMap((floor) => floor.rooms.filter((room) => allowedRoomTypes.includes(room.type)));
  }, [selectedBlock]);

  const roomFloorNameById = useMemo(() => {
    const floorMap = new Map<string, string>();

    selectedBlock?.floors.forEach((floor) => {
      floor.rooms.forEach((room) => {
        floorMap.set(room.id, floor.name);
      });
    });

    return floorMap;
  }, [selectedBlock]);

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateKey]);

  const selectedDateIsPast = useMemo(() => startOfDay(selectedDate) < startOfDay(today), [selectedDate, today]);

  const hasExplicitTimeSelection = Boolean(startTimeValue && endTimeValue);

  const bookingsOnSelectedDateByRoomId = useMemo(() => {
    const bookingMap = new Map<string, LiveBookingEntry>();

    liveBookings.forEach((booking) => {
      if (booking.bookingDateKey !== selectedDateKey) {
        return;
      }

      const existing = bookingMap.get(booking.roomId);
      if (!existing || booking.startTime < existing.startTime) {
        bookingMap.set(booking.roomId, booking);
      }
    });

    return bookingMap;
  }, [liveBookings, selectedDateKey]);

  const overlappingBookingsByRoomId = useMemo(() => {
    if (!hasExplicitTimeSelection) {
      return new Map<string, LiveBookingEntry>();
    }

    const bookingMap = new Map<string, LiveBookingEntry>();

    liveBookings.forEach((booking) => {
      if (booking.bookingDateKey !== selectedDateKey) {
        return;
      }

      if (!overlapsTimeRange(booking.startTime, booking.endTime, startTimeValue, endTimeValue)) {
        return;
      }

      const existing = bookingMap.get(booking.roomId);
      if (!existing || booking.startTime < existing.startTime) {
        bookingMap.set(booking.roomId, booking);
      }
    });

    return bookingMap;
  }, [endTimeValue, hasExplicitTimeSelection, liveBookings, selectedDateKey, startTimeValue]);

  const selectedDateCalendarEntry = useMemo<BlockCalendarEntry | undefined>(() => {
    const sourceBookingsByRoomId = hasExplicitTimeSelection ? overlappingBookingsByRoomId : bookingsOnSelectedDateByRoomId;
    const firstBookedRoom = blockRooms.find((room) => sourceBookingsByRoomId.has(room.id));
    if (!firstBookedRoom) {
      return undefined;
    }

    const booking = sourceBookingsByRoomId.get(firstBookedRoom.id);
    if (!booking) {
      return undefined;
    }

    return {
      status: 'booked',
      roomId: firstBookedRoom.id,
      roomName: firstBookedRoom.name,
      roomType: firstBookedRoom.type,
      capacity: firstBookedRoom.capacity,
      chairs: firstBookedRoom.chairs,
      facilities: firstBookedRoom.facilities,
      slotLabel: booking.slotLabel,
      purpose: booking.purpose,
      bookedByName: booking.requesterName,
      bookedByDepartment: booking.department,
      bookedByMobile: booking.requesterPhone,
      bookedByEmail: booking.requesterEmail,
    };
  }, [blockRooms, bookingsOnSelectedDateByRoomId, hasExplicitTimeSelection, overlappingBookingsByRoomId]);

  const bookedExpectedAttendees = selectedDateCalendarEntry?.capacity
    ? Math.max(1, Math.round(selectedDateCalendarEntry.capacity * 0.72))
    : 0;

  const bookedCapacityPercent = selectedDateCalendarEntry?.capacity
    ? Math.min(100, Math.round((bookedExpectedAttendees / selectedDateCalendarEntry.capacity) * 100))
    : 0;

  const visibleMonthSummary = useMemo(() => {
    let free = 0;
    let booked = 0;
    let past = 0;

    calendarGridCells.forEach((date) => {
      if (!date) return;

      const dateKey = toDateKey(date);
      const isPast = startOfDay(date) < startOfDay(today);
      if (isPast) past += 1;

      const hasAnyBookedRoom = liveBookings.some(
        (booking) => booking.bookingDateKey === dateKey && blockRooms.some((room) => room.id === booking.roomId),
      );

      if (hasAnyBookedRoom) {
        booked += 1;
      } else {
        free += 1;
      }
    });

    return { free, booked, past };
  }, [calendarGridCells, liveBookings, blockRooms, today]);

  const availabilityRate = useMemo(() => {
    const total = visibleMonthSummary.free + visibleMonthSummary.booked;
    if (total === 0) return 0;
    return Math.round((visibleMonthSummary.free / total) * 100);
  }, [visibleMonthSummary]);

  const availableRoomsOnSelectedDate = useMemo(() => {
    if (!hasExplicitTimeSelection) {
      return blockRooms;
    }

    return blockRooms.filter((room) => !overlappingBookingsByRoomId.has(room.id));
  }, [blockRooms, hasExplicitTimeSelection, overlappingBookingsByRoomId]);

  const bookedRoomsOnSelectedDate = useMemo(
    () => {
      return liveBookings
        .filter((booking) => booking.bookingDateKey === selectedDateKey)
        .filter((booking) => (hasExplicitTimeSelection ? overlapsTimeRange(booking.startTime, booking.endTime, startTimeValue, endTimeValue) : true))
        .map((booking) => {
          const room = blockRooms.find((candidate) => candidate.id === booking.roomId);
          return room ? { room, booking } : null;
        })
        .filter((item): item is { room: ResourceRoom; booking: LiveBookingEntry } => Boolean(item));
    },
    [blockRooms, hasExplicitTimeSelection, liveBookings, selectedDateKey, startTimeValue, endTimeValue],
  );

  const normalizedRoomSearchTerm = roomSearchTerm.trim().toLowerCase();
  const searchRequestsFreeRooms = /\bfree\b/.test(normalizedRoomSearchTerm);
  const searchRequestsBookedRooms = /\bbooked\b/.test(normalizedRoomSearchTerm);

  const effectiveRoomVisibilityFilter = useMemo<RoomVisibilityFilter>(() => {
    if (searchRequestsFreeRooms && !searchRequestsBookedRooms) {
      return 'free';
    }

    if (searchRequestsBookedRooms && !searchRequestsFreeRooms) {
      return 'booked';
    }

    return roomVisibilityFilter;
  }, [roomVisibilityFilter, searchRequestsFreeRooms, searchRequestsBookedRooms]);

  const normalizedSearchKeywords = useMemo(
    () =>
      normalizedRoomSearchTerm
        .split(/\s+/)
        .filter(Boolean)
        .filter((term) => term !== 'free' && term !== 'booked' && term !== 'room' && term !== 'rooms'),
    [normalizedRoomSearchTerm],
  );

  const filteredAvailableRooms = useMemo(() => {
    if (effectiveRoomVisibilityFilter === 'booked') {
      return [];
    }

    return availableRoomsOnSelectedDate.filter((room) => {
      if (normalizedSearchKeywords.length === 0) {
        return true;
      }

      const searchableText = [room.name, room.type, ...room.facilities].join(' ').toLowerCase();
      return normalizedSearchKeywords.every((term) => searchableText.includes(term));
    });
  }, [availableRoomsOnSelectedDate, normalizedSearchKeywords, effectiveRoomVisibilityFilter]);

  const filteredBookedRooms = useMemo(() => {
    if (effectiveRoomVisibilityFilter === 'free') {
      return [];
    }

    return bookedRoomsOnSelectedDate.filter(({ room, booking }) => {
      if (normalizedSearchKeywords.length === 0) {
        return true;
      }

      const searchableText = [
        room.name,
        room.type,
        booking.requesterName,
        booking.requesterEmail,
        booking.department || '',
        booking.purpose,
      ]
        .join(' ')
        .toLowerCase();

      return normalizedSearchKeywords.every((term) => searchableText.includes(term));
    });
  }, [bookedRoomsOnSelectedDate, normalizedSearchKeywords, effectiveRoomVisibilityFilter]);

  const rescheduleValidationMessage = useMemo(() => {
    if (!editingBooking) {
      return '';
    }

    if (!editNewDateKey || !editNewStartTime || !editNewEndTime) {
      return '';
    }

    const now = new Date();
    const currentDateKey = toDateKey(now);
    const currentTimeKey = getCurrentTimeKey(now);

    if (editNewDateKey < editingBooking.bookingDateKey) {
      return 'Reschedule date must be the same as or after the current booking date.';
    }

    if (editNewDateKey < currentDateKey) {
      return 'Reschedule date cannot be in the past.';
    }

    if (editNewDateKey === currentDateKey && editNewStartTime < currentTimeKey) {
      return 'For today, the reschedule start time must be current time or later.';
    }

    if (editNewDateKey === editingBooking.bookingDateKey && editNewStartTime < editingBooking.endTime) {
      return 'Reschedule time must be after the current booking end time.';
    }

    if (editNewStartTime >= editNewEndTime) {
      return 'End time must be after start time.';
    }

    return '';
  }, [editNewDateKey, editNewEndTime, editNewStartTime, editingBooking]);

  const canManageBooking = (booking: LiveBookingEntry) => {
    const bookingOwnerEmail = booking.requesterEmail.trim().toLowerCase();
    return isAdmin || (currentUserEmail.length > 0 && currentUserEmail === bookingOwnerEmail);
  };

  const shouldShowInlineSearchResults = normalizedRoomSearchTerm.length > 0 || roomVisibilityFilter !== 'all';

  const selectedRoom = useMemo(
    () => availableRoomsOnSelectedDate.find((room) => room.id === selectedRoomId),
    [availableRoomsOnSelectedDate, selectedRoomId],
  );

  const selectedDurationLabel = useMemo(
    () => getDurationLabel(startTimeValue, endTimeValue),
    [startTimeValue, endTimeValue],
  );

  const validEndTimeOptions = useMemo(() => {
    if (!startTimeValue) return timeOptions;
    return timeOptions.filter((option) => option.value > startTimeValue);
  }, [startTimeValue, timeOptions]);

  const submitBookingRequest = async () => {
    if (selectedDateIsPast) {
      setRequestFeedback('Booking is not allowed for past dates. Please select current or future date.');
      return;
    }

    const now = new Date();
    const currentDateKey = toDateKey(now);
    const currentTimeKey = getCurrentTimeKey(now);

    if (!selectedRoomId) {
      setRequestFeedback('Please select one room first.');
      return;
    }

    if (!startTimeValue || !endTimeValue) {
      setRequestFeedback('Please select both start time and end time.');
      return;
    }

    if (startTimeValue >= endTimeValue) {
      setRequestFeedback('End time must be after start time.');
      return;
    }

    if (selectedDateKey < currentDateKey) {
      setRequestFeedback('Booking is not allowed for past dates. Please select current or future date.');
      return;
    }

    if (selectedDateKey === currentDateKey && startTimeValue < currentTimeKey) {
      setRequestFeedback('For today, booking start time must be current time or later.');
      return;
    }

    if (!selectedRoom) {
      setRequestFeedback('Selected room is already booked for the selected date and time.');
      return;
    }

    if (!purpose.trim()) {
      setRequestFeedback('Please enter booking purpose.');
      return;
    }

    const requirementText = additionalRequirement.trim();
    const timeSlotLabel = `${formatTime12Hour(startTimeValue)} - ${formatTime12Hour(endTimeValue)}`;

    try {
      setIsSubmittingRequest(true);
      setRequestFeedback('');

      const createdBooking = await createSeminarHallBooking({
        roomId: selectedRoom.id,
        bookingDate: selectedDateKey,
        startTime: startTimeValue,
        endTime: endTimeValue,
        timeSlot: timeSlotLabel,
        purpose: purpose.trim(),
        additionalRequirements: requirementText || undefined,
      });

      setRequestFeedback(
        `Booking request ${createdBooking.requestId} submitted for ${prettyLongDate(selectedDate)} (${createdBooking.room.name}) from ${formatTime12Hour(startTimeValue)} to ${formatTime12Hour(endTimeValue)}${selectedDurationLabel ? ` (${selectedDurationLabel})` : ''} in ${createdBooking.room.block.name}${requirementText ? `. Additional requirement: ${requirementText}` : '.'}`,
      );
      setSelectedRoomId('');
      setStartTimeValue('');
      setEndTimeValue('');
      setAdditionalRequirement('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit booking request right now.';
      setRequestFeedback(message);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const createBookedActionRequest = async (kind: 'cancel_request' | 'reschedule_request', bookingOverride?: LiveBookingEntry) => {
    const booking = bookingOverride ?? bookedRoomsOnSelectedDate.find((item) => selectedRoomId === item.room.id)?.booking;

    if (!booking) {
      setRequestFeedback('No booking selected.');
      return;
    }

    if (actionRequestBookingId === booking.id) {
      setRequestFeedback(
        kind === 'cancel_request'
          ? 'You have already sent a cancellation request for this booking.'
          : 'You have already sent a reschedule request for this booking.',
      );
      return;
    }

    if (kind === 'reschedule_request') {
      // Open edit modal for reschedule
      setEditingBooking(booking);
      setEditNewDateKey(booking.bookingDateKey);
      setEditNewStartTime(booking.startTime);
      setEditNewEndTime(booking.endTime);
      setIsEditModalOpen(true);
      return;
    }

    // Handle cancel request directly
    try {
      setActionRequestBookingId(booking.id);
      setRequestFeedback('Processing your request...');
      const response = await fetch(`/api/v1/seminar-hall/bookings/${booking.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          kind,
          reason: `User requested cancellation via room browser`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process cancellation');
      }

      const result = await response.json();
      setRequestFeedback(
        `Cancellation request submitted successfully (${result.data.requestId}). Admin will review shortly.`,
      );

      // Reload bookings after successful action request
      const bookings = await fetchSeminarHallBookingsRaw();
      setLiveBookings(
        bookings
          .filter((b) => b.status === 'approved')
          .filter((b) => Boolean(b.roomId))
          .map((b) => ({
            id: b.id,
            roomId: b.roomId as string,
            roomName: b.room.name,
            roomType: b.room.type,
            blockName: b.room.block.name,
            floorName: b.room.floor.name,
            bookingDateKey: b.bookingDate.slice(0, 10),
            startTime: b.startTime,
            endTime: b.endTime,
            slotLabel: b.timeSlot,
            purpose: b.purpose,
            requesterName: b.requesterName,
            requesterEmail: b.requesterEmail,
            requesterPhone: b.requesterPhone || undefined,
            department: b.department || undefined,
          })),
      );
    } catch (error) {
      setRequestFeedback(
        `Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
      );
    } finally {
      setActionRequestBookingId('');
    }
  };

  const submitRescheduleRequest = async () => {
    if (!editingBooking) {
      setRequestFeedback('No booking selected for rescheduling.');
      return;
    }

    if (!editNewStartTime || !editNewEndTime) {
      setRequestFeedback('Please select both start and end time for the new schedule.');
      return;
    }

    if (rescheduleValidationMessage) {
      setRequestFeedback(rescheduleValidationMessage);
      return;
    }

    try {
      setIsSubmittingRequest(true);
      const response = await fetch(`/api/v1/seminar-hall/bookings/${editingBooking.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: editingBooking.id,
          kind: 'reschedule_request',
          requestedBookingDate: editNewDateKey,
          requestedStartTime: editNewStartTime,
          requestedEndTime: editNewEndTime,
          reason: `Reschedule request: ${editingBooking.bookingDateKey} ${editingBooking.startTime}-${editingBooking.endTime} → ${editNewDateKey} ${editNewStartTime}-${editNewEndTime}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit reschedule request');
      }

      const result = await response.json();
      setRequestFeedback(
        `Reschedule request submitted successfully (${result.data.requestId}). Admin will review shortly.`,
      );

      setIsEditModalOpen(false);
      setEditingBooking(null);
      setEditNewDateKey('');
      setEditNewStartTime('');
      setEditNewEndTime('');

      // Reload bookings
      const bookings = await fetchSeminarHallBookingsRaw();
      setLiveBookings(
        bookings
          .filter((b) => b.status === 'approved')
          .filter((b) => Boolean(b.roomId))
          .map((b) => ({
            id: b.id,
            roomId: b.roomId as string,
            roomName: b.room.name,
            roomType: b.room.type,
            blockName: b.room.block.name,
            floorName: b.room.floor.name,
            bookingDateKey: b.bookingDate.slice(0, 10),
            startTime: b.startTime,
            endTime: b.endTime,
            slotLabel: b.timeSlot,
            purpose: b.purpose,
            requesterName: b.requesterName,
            requesterEmail: b.requesterEmail,
            requesterPhone: b.requesterPhone || undefined,
            department: b.department || undefined,
          })),
      );
    } catch (error) {
      setRequestFeedback(
        `Error: ${error instanceof Error ? error.message : 'Failed to submit reschedule request'}`,
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const moveMonth = (direction: -1 | 1) => {
    setVisibleMonthAnchorDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1),
    );
  };

  const jumpToCurrentMonth = () => {
    setVisibleMonthAnchorDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(toDateKey(today));
    setRequestFeedback('');
    setSelectedRoomId('');
    setStartTimeValue('');
    setEndTimeValue('');
    setAdditionalRequirement('');
  };

  return (
    <>
    <main className="min-h-screen bg-[#edf1f6] px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rmb-fade-in rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-bold text-[#1c2e4a]">Room Browser</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">Select a date to view availability and booking details</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/resource-management/seminar-hall-booking/my-bookings"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                My bookings
              </Link>
              {isAdmin && (
                <Link
                  href="/resource-management/seminar-hall-booking/admin"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Admin queue
                </Link>
              )}
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600">
                <Search className="h-4 w-4" />
                <input
                  type="text"
                  value={roomSearchTerm}
                  onChange={(event) => setRoomSearchTerm(event.target.value)}
                  placeholder="Search rooms"
                  className="w-32 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 sm:w-40"
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600">
                <SlidersHorizontal className="h-4 w-4" />
                <select
                  value={roomVisibilityFilter}
                  onChange={(event) => setRoomVisibilityFilter(event.target.value as RoomVisibilityFilter)}
                  className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="all">All rooms</option>
                  <option value="free">Free rooms</option>
                  <option value="booked">Booked rooms</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setIsRequestDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#0f274d] bg-[#0f274d] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" />
                New booking
              </button>
            </div>
          </div>
        </header>

        <section className="rmb-fade-in grid gap-3 sm:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: '70ms' }}>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-4xl font-bold leading-none text-[#1c2e4a]">{visibleMonthSummary.free}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Free dates this month</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-100 p-2.5 text-rose-500">
                <CalendarX2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-4xl font-bold leading-none text-[#1c2e4a]">{visibleMonthSummary.booked}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Booked dates</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-2.5 text-blue-500">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-4xl font-bold leading-none text-[#1c2e4a]">{visibleMonthSummary.past}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Past dates</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-2.5 text-amber-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-4xl font-bold leading-none text-[#1c2e4a]">{availabilityRate}%</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Availability rate</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rmb-fade-in" style={{ animationDelay: '120ms' }}>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Select Block</h2>
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {resourceBlocks.map((block) => {
              const isActive = block.id === selectedBlockId;
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => {
                    setSelectedBlockId(block.id);
                    setIsRequestDialogOpen(false);
                    setRequestFeedback('');
                    setSelectedRoomId('');
                    setStartTimeValue('');
                    setEndTimeValue('');
                    setAdditionalRequirement('');
                  }}
                  className={[
                    'min-w-[88px] rounded-lg px-4 py-2 text-sm font-semibold transition',
                    isActive
                      ? 'bg-[#0f274d] text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                  ].join(' ')}
                >
                  {block.name}
                </button>
              );
            })}
          </div>
          {roomsLoading ? (
            <p className="mt-3 text-sm font-medium text-slate-500">Loading rooms from backend...</p>
          ) : null}
          {roomsError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{roomsError}</p>
          ) : null}
        </section>

        <section className="rmb-fade-in rounded-[22px] border border-slate-200 bg-white shadow-sm" style={{ animationDelay: '170ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-4xl font-semibold leading-none text-[#1c2e4a]">{formatMonthYear(visibleMonthAnchorDate)}</h2>
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Free: {visibleMonthSummary.free}</span>
              <span className="rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Booked: {visibleMonthSummary.booked}</span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Past: {visibleMonthSummary.past}</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={jumpToCurrentMonth}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-b-[22px]">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {weekDayLabels.map((label, index) => (
                <p key={label} className={[
                  'py-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400',
                  index !== 6 ? 'border-r border-slate-200' : '',
                ].join(' ')}>{label}</p>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarGridCells.map((date, index) => {
                const isLastColumn = index % 7 === 6;

                if (!date) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className={[
                        'h-[106px] bg-slate-50/30',
                        !isLastColumn ? 'border-r border-slate-200' : '',
                        'border-b border-slate-200',
                      ].join(' ')}
                      aria-hidden="true"
                    />
                  );
                }

                const key = toDateKey(date);
                const bookedRoomIds = new Set(
                  liveBookings
                    .filter((booking) => booking.bookingDateKey === key)
                    .filter((booking) => blockRooms.some((room) => room.id === booking.roomId))
                    .map((booking) => booking.roomId),
                );
                const entry = blockRooms.length > 0 && bookedRoomIds.size >= blockRooms.length
                  ? { status: 'booked' as const }
                  : undefined;
                const isSelected = key === selectedDateKey;
                const isBooked = entry?.status === 'booked';
                const isPastDate = startOfDay(date) < startOfDay(today);
                const isToday = key === toDateKey(today);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(key);
                      setIsRequestDialogOpen(true);
                      setRequestFeedback('');
                      setSelectedRoomId('');
                      setStartTimeValue('');
                      setEndTimeValue('');
                      setAdditionalRequirement('');
                    }}
                    className={[
                      'h-[106px] px-3 py-2 text-left transition duration-200',
                      !isLastColumn ? 'border-r border-slate-200' : '',
                      'border-b border-slate-200',
                      isSelected ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-300' : 'bg-white hover:bg-slate-50',
                      isPastDate ? 'text-slate-400' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-slate-700">{date.getDate()}</span>
                      {isToday ? <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Today</span> : null}
                    </div>
                    <p className={[
                      'mt-4 inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold',
                      isBooked ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600',
                    ].join(' ')}>
                      {isBooked ? 'Booked' : 'Free'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {shouldShowInlineSearchResults ? (
          <section className="rmb-fade-in space-y-4 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: '210ms' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-[#1c2e4a]">Matching Rooms</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {prettyLongDate(selectedDate)} in {selectedBlock?.name ?? 'selected block'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                  Mode: {effectiveRoomVisibilityFilter === 'all' ? 'All rooms' : effectiveRoomVisibilityFilter === 'free' ? 'Free rooms' : 'Booked rooms'}
                </span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[#0F2573]">
                  Search: {normalizedRoomSearchTerm || 'None'}
                </span>
              </div>
            </div>

            {filteredBookedRooms.length === 0 && filteredAvailableRooms.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                No matching rooms found for the selected date, time, and filter.
              </div>
            ) : null}

            {filteredBookedRooms.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.12em] text-rose-500">Booked rooms</p>
                    <p className="text-sm text-rose-700">
                      {hasExplicitTimeSelection
                        ? 'These rooms are already occupied for the selected date and time.'
                        : 'These rooms already have bookings on the selected date. Select start and end time to check whether another slot is free.'}
                    </p>
                  </div>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    {filteredBookedRooms.length} booked
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredBookedRooms.map(({ room, booking }) => (
                    <div key={`inline-booked-${room.id}-${booking.id}`} className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{room.name}</p>
                          <p className="text-xs text-slate-500">{roomTypeLabels[room.type]} • {booking.blockName} • {booking.floorName}</p>
                        </div>
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">{booking.slotLabel}</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <p><span className="font-semibold text-slate-900">Booked by:</span> {booking.requesterName}</p>
                        <p><span className="font-semibold text-slate-900">Department:</span> {booking.department || '-'}</p>
                        <p className="break-all"><span className="font-semibold text-slate-900">Email:</span> {booking.requesterEmail}</p>
                        <p><span className="font-semibold text-slate-900">Phone:</span> {booking.requesterPhone || '-'}</p>
                        <p><span className="font-semibold text-slate-900">Capacity:</span> {room.capacity} seats</p>
                        <p><span className="font-semibold text-slate-900">Chairs:</span> {room.chairs}</p>
                        <p className="sm:col-span-2"><span className="font-semibold text-slate-900">Purpose:</span> {booking.purpose}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {filteredAvailableRooms.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-600">Free rooms</p>
                    <p className="text-sm text-emerald-700">
                      {hasExplicitTimeSelection
                        ? 'These rooms are available for booking on the selected date and time.'
                        : 'These rooms currently have no bookings on the selected date.'}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {filteredAvailableRooms.length} free
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {filteredAvailableRooms.map((room) => (
                    <div key={`inline-free-${room.id}`} className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{room.name}</p>
                          <p className="text-xs text-slate-500">{roomTypeLabels[room.type]} • {selectedBlock?.name ?? '-'} • {roomFloorNameById.get(room.id) ?? '-'}</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Available</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <p><span className="font-semibold text-slate-900">Capacity:</span> {room.capacity} seats</p>
                        <p><span className="font-semibold text-slate-900">Chairs:</span> {room.chairs}</p>
                        <p className="sm:col-span-2"><span className="font-semibold text-slate-900">Facilities:</span> {room.facilities.join(', ') || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {isRequestDialogOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#071a3a]/85 p-2 sm:p-4">
            <div className="rmb-dialog max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="font-serif text-4xl font-semibold tracking-tight text-[#111f3b]">Room Request</h3>
                  <p className="mt-1 text-lg font-semibold text-[#3b6fdd]">{prettyLongDate(selectedDate)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[#0F2573]">
                      Block: {selectedBlock?.name ?? 'N/A'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                      Filter: {effectiveRoomVisibilityFilter === 'all' ? 'All rooms' : effectiveRoomVisibilityFilter === 'free' ? 'Free rooms' : 'Booked rooms'}
                    </span>
                    <span
                      className={[
                        'rounded-full border px-3 py-1',
                        selectedDateCalendarEntry?.status === 'booked'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                      ].join(' ')}
                    >
                      {selectedDateCalendarEntry?.status === 'booked' ? 'Status: Booked' : 'Status: Free'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRequestDialogOpen(false)}
                  className="rounded-xl border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-100"
                  aria-label="Close request dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 text-sm text-[#334b72]">
                {filteredBookedRooms.length > 0 ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-[0.12em] text-rose-500">Booked rooms</p>
                          <p className="text-sm text-rose-700">These rooms are already occupied, but you can still book any free room below.</p>
                        </div>
                        <span className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700">
                          {filteredBookedRooms.length} booked
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {filteredBookedRooms.map(({ room, booking }) => (
                          <div key={`dialog-booked-${room.id}-${booking.id}`} className="rounded-2xl border border-rose-200 bg-white p-4 text-sm text-slate-700">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold text-slate-900">{room.name}</p>
                                <p className="text-xs text-slate-500">{roomTypeLabels[room.type]} • {booking.blockName} • {booking.floorName}</p>
                              </div>
                              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">{booking.slotLabel}</span>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <p><span className="font-semibold text-slate-900">Booked by:</span> {booking.requesterName}</p>
                              <p><span className="font-semibold text-slate-900">Department:</span> {booking.department || '-'}</p>
                              <p className="break-all"><span className="font-semibold text-slate-900">Email:</span> {booking.requesterEmail}</p>
                              <p><span className="font-semibold text-slate-900">Phone:</span> {booking.requesterPhone || '-'}</p>
                              <p><span className="font-semibold text-slate-900">Capacity:</span> {room.capacity} seats</p>
                              <p><span className="font-semibold text-slate-900">Chairs:</span> {room.chairs}</p>
                              <p className="sm:col-span-2"><span className="font-semibold text-slate-900">Purpose:</span> {booking.purpose}</p>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-rose-100 pt-4">
                              {canManageBooking(booking) ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => createBookedActionRequest('cancel_request', booking)}
                                    disabled={actionRequestBookingId === booking.id}
                                    className="rounded-xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                                  >
                                    {actionRequestBookingId === booking.id ? 'Sending...' : 'Cancel Booking'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => createBookedActionRequest('reschedule_request', booking)}
                                    className="rounded-xl border border-[#0f274d] bg-[#0f274d] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                                  >
                                    Edit Booking
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs font-semibold text-slate-500">
                                  Only the booking owner or admin can change this slot.
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                    <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#3d6fe0]">Booking Flow</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#21427e]">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0f274d] text-white">1</span>
                      <span>Select a room</span>
                      <span className="text-slate-400">→</span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0f274d] text-white">2</span>
                      <span>Choose start & end time</span>
                      <span className="text-slate-400">→</span>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0f274d] text-white">3</span>
                      <span>Submit request</span>
                    </div>
                  </div>
                  {selectedDateIsPast ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      Past dates are not allowed for booking requests. Please select current or future date.
                    </div>
                  ) : null}
                  {filteredAvailableRooms.length === 0 && effectiveRoomVisibilityFilter !== 'booked' ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      No matching free seminar hall or auditorium is available in selected block for the selected date and time.
                    </div>
                  ) : null}

                  {filteredBookedRooms.length === 0 && effectiveRoomVisibilityFilter !== 'free' ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      No matching booked rooms found for the selected date and time.
                    </div>
                  ) : null}

                  {filteredAvailableRooms.length > 0 ? (
                    <div>
                      <p className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Select Room</p>
                      <div className="grid gap-3 md:grid-cols-2">
                      {filteredAvailableRooms.map((room) => {
                        const isRoomSelected = room.id === selectedRoomId;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setSelectedRoomId(room.id)}
                            className={[
                              'relative rounded-2xl border px-4 py-4 text-left text-sm transition duration-300',
                              isRoomSelected
                                ? 'border-[#4f89f5] bg-blue-50/80 ring-2 ring-[#4f89f5]/30'
                                : 'border-slate-200 bg-white text-[#334b72] hover:border-[#4f89f5] hover:bg-blue-50/40',
                            ].join(' ')}
                          >
                            <p className="text-2xl font-semibold text-[#11284a]">{room.name}</p>
                            <p className="mt-1 text-lg text-[#5f7ca5]">
                              Cap. {room.capacity}   ❤ {room.chairs} chairs
                            </p>
                            {isRoomSelected ? (
                              <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#4f89f5] text-white">✓</span>
                            ) : null}
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-3 text-lg font-bold uppercase tracking-[0.12em] text-[#1f3b67]">Start time</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {timeOptions.map((time) => {
                          const isActive = startTimeValue === time.value;
                          return (
                            <button
                              key={`start-${time.value}`}
                              type="button"
                              onClick={() => {
                                setStartTimeValue(time.value);
                                if (endTimeValue && endTimeValue <= time.value) {
                                  setEndTimeValue('');
                                }
                              }}
                              className={[
                                'rounded-xl border px-2.5 py-2 text-base font-semibold transition duration-300',
                                isActive
                                  ? 'border-[#4f89f5] bg-[#4f89f5] text-white'
                                  : 'border-slate-300 bg-white text-[#1f3b67] hover:border-[#4f89f5] hover:bg-blue-50',
                              ].join(' ')}
                            >
                              {time.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-3 text-lg font-bold uppercase tracking-[0.12em] text-[#1f3b67]">End time</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {validEndTimeOptions.map((time) => {
                          const isActive = endTimeValue === time.value;
                          const isDisabled = !startTimeValue;
                          return (
                            <button
                              key={`end-${time.value}`}
                              type="button"
                              onClick={() => setEndTimeValue(time.value)}
                              disabled={isDisabled}
                              className={[
                                'rounded-xl border px-2.5 py-2 text-base font-semibold transition duration-300',
                                isActive
                                  ? 'border-[#4f89f5] bg-[#4f89f5] text-white'
                                  : 'border-slate-300 bg-white text-[#1f3b67] hover:border-[#4f89f5] hover:bg-blue-50',
                                isDisabled ? 'cursor-not-allowed opacity-50 hover:border-blue-200 hover:bg-white' : '',
                              ].join(' ')}
                            >
                              {time.label}
                            </button>
                          );
                        })}
                      </div>
                      {!startTimeValue ? (
                        <p className="mt-2 text-sm text-[#7a91b1]">Select start time first</p>
                      ) : null}
                    </div>
                  </div>

                  {selectedDurationLabel ? (
                    <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                      Total duration: {selectedDurationLabel}
                    </p>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Requester details will be fetched automatically from your employee profile.
                  </div>

                  <div className="pt-1">
                    <label htmlFor="purpose" className="mb-1 block text-2xl font-semibold text-[#11284a]">
                      Purpose
                    </label>
                    <input
                      id="purpose"
                      type="text"
                      value={purpose}
                      onChange={(event) => setPurpose(event.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg text-[#334b72] outline-none transition focus:border-[#4f89f5] focus:ring-2 focus:ring-[#4f89f5]/20"
                      placeholder="Seminar, workshop, orientation, lecture..."
                    />
                  </div>

                  <div className="pt-1">
                    <label htmlFor="additionalRequirement" className="mb-1 block text-2xl font-semibold text-[#11284a]">
                      Additional requirement (optional)
                    </label>
                    <input
                      id="additionalRequirement"
                      type="text"
                      value={additionalRequirement}
                      onChange={(event) => setAdditionalRequirement(event.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg text-[#334b72] outline-none transition focus:border-[#4f89f5] focus:ring-2 focus:ring-[#4f89f5]/20"
                      placeholder="e.g. 2 wireless mics, HDMI adapter, whiteboard..."
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <p className="text-base text-slate-500">
                      {selectedRoom && selectedDurationLabel
                        ? `Selected: ${selectedRoom.name} · ${selectedDurationLabel}`
                        : 'No room or time selected yet'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRequestDialogOpen(false)}
                        className="rounded-xl border border-slate-300 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={submitBookingRequest}
                        disabled={selectedDateIsPast || filteredAvailableRooms.length === 0 || isSubmittingRequest}
                        className={[
                          'inline-flex items-center justify-center rounded-xl border px-5 py-2.5 text-sm font-semibold text-white transition duration-300',
                          selectedDateIsPast || filteredAvailableRooms.length === 0 || isSubmittingRequest
                            ? 'cursor-not-allowed border-slate-300 bg-slate-400'
                            : 'border-[#0f274d] bg-[#0f274d] hover:brightness-110',
                        ].join(' ')}
                      >
                        {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                        <ArrowUpRight className="ml-1.5 h-4 w-4" />
                      </button>
                    </div>
                  </div>
              </div>

              {requestFeedback ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {requestFeedback}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>

    {isEditModalOpen && editingBooking ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Reschedule Booking</h2>
              <p className="mt-1 text-sm text-slate-500">Change the booking slot here so the new date and time are visible before submission.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingBooking(null);
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Current Slot</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{editingBooking.roomName}</p>
              <p className="text-sm text-slate-700">{editingBooking.bookingDateKey}</p>
              <p className="text-sm text-slate-700">{formatTime12Hour(editingBooking.startTime)} - {formatTime12Hour(editingBooking.endTime)}</p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Proposed Slot</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{editingBooking.roomName}</p>
              <p className="text-sm text-slate-700">{editNewDateKey || 'Select a new date'}</p>
              <p className="text-sm text-slate-700">
                {editNewStartTime && editNewEndTime
                  ? `${formatTime12Hour(editNewStartTime)} - ${formatTime12Hour(editNewEndTime)}`
                  : 'Select a new start and end time'}
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Live Preview</p>
            <p className="mt-1 text-sm text-slate-700">
              {editingBooking.bookingDateKey} {formatTime12Hour(editingBooking.startTime)} - {formatTime12Hour(editingBooking.endTime)}
              {' → '}
              {editNewDateKey || 'new date'} {editNewStartTime && editNewEndTime ? `${formatTime12Hour(editNewStartTime)} - ${formatTime12Hour(editNewEndTime)}` : 'new time'}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">New Date</label>
              <input
                type="date"
                value={editNewDateKey}
                onChange={(e) => setEditNewDateKey(e.target.value)}
                min={editingBooking.bookingDateKey}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Start Time</label>
                <select
                  value={editNewStartTime}
                  onChange={(e) => setEditNewStartTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select time</option>
                  {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map((time) => (
                    <option key={time} value={time}>
                      {formatTime12Hour(time)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">End Time</label>
                <select
                  value={editNewEndTime}
                  onChange={(e) => setEditNewEndTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select time</option>
                  {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map((time) => (
                    <option key={time} value={time} disabled={time <= editNewStartTime}>
                      {formatTime12Hour(time)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">
                ℹ️ Your reschedule request will be sent for admin approval. You'll be notified once reviewed.
              </p>
            </div>

            {rescheduleValidationMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                {rescheduleValidationMessage}
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingBooking(null);
                }}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRescheduleRequest}
                disabled={isSubmittingRequest || !editNewDateKey || !editNewStartTime || !editNewEndTime || Boolean(rescheduleValidationMessage)}
                className="flex-1 rounded-xl border border-[#0f274d] bg-[#0f274d] px-4 py-2 font-semibold text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingRequest ? 'Submitting...' : 'Submit Reschedule Request'}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

    <style jsx>{`
      .rmb-fade-in {
        animation: rmbFadeIn 520ms ease-out both;
      }

      .rmb-dialog {
        animation: rmbDialogIn 260ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
      }

      @keyframes rmbFadeIn {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes rmbDialogIn {
        from {
          opacity: 0;
          transform: translateY(18px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .rmb-fade-in,
        .rmb-dialog {
          animation: none;
        }
      }
    `}</style>
    </>
  );
}
