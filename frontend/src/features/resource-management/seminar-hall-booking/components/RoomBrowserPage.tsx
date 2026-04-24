'use client';

import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { mockResourceBlocks } from '../data/mockRooms';
import type { ResourceRoom, RoomCalendarEntry } from '../types/roomBooking.types';

const allowedRoomTypes: ResourceRoom['type'][] = ['seminar_hall', 'auditorium'];

type BlockCalendarEntry = RoomCalendarEntry & {
  roomName?: string;
  roomType?: ResourceRoom['type'];
  capacity?: number;
  chairs?: number;
  facilities?: string[];
};

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

export default function RoomBrowserPage() {
  const weekDayLabels = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], []);
  const today = useMemo(() => new Date(), []);
  const [selectedBlockId, setSelectedBlockId] = useState<string>(mockResourceBlocks[0]?.id ?? '');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(toDateKey(today));
  const [visibleMonthAnchorDate, setVisibleMonthAnchorDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [hoverTooltipAlign, setHoverTooltipAlign] = useState<'left' | 'center' | 'right'>('center');
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [startTimeValue, setStartTimeValue] = useState<string>('');
  const [endTimeValue, setEndTimeValue] = useState<string>('');
  const [additionalRequirement, setAdditionalRequirement] = useState<string>('');

  const timeOptions = useMemo(
    () =>
      ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(
        (value) => ({ value, label: formatTime12Hour(value) }),
      ),
    [],
  );

  const selectedBlock = useMemo(
    () => mockResourceBlocks.find((block) => block.id === selectedBlockId),
    [selectedBlockId],
  );

  const calendarGridCells = useMemo(() => buildMonthGrid(visibleMonthAnchorDate), [visibleMonthAnchorDate]);

  const blockRooms = useMemo<ResourceRoom[]>(() => {
    if (!selectedBlock) return [];
    return selectedBlock.floors.flatMap((floor) => floor.rooms.filter((room) => allowedRoomTypes.includes(room.type)));
  }, [selectedBlock]);

  const blockCalendarAvailability = useMemo<Record<string, BlockCalendarEntry>>(() => {
    const calendarByDate: Record<string, BlockCalendarEntry> = {};

    blockRooms.forEach((room) => {
      const entries = room.calendarAvailability ?? {};
      Object.entries(entries).forEach(([dateKey, entry]) => {
        if (entry.status === 'booked' && !calendarByDate[dateKey]) {
          calendarByDate[dateKey] = {
            ...entry,
            roomName: room.name,
            roomType: room.type,
            capacity: room.capacity,
            chairs: room.chairs,
            facilities: room.facilities,
          };
        }
      });
    });

    return calendarByDate;
  }, [blockRooms]);

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateKey]);

  const selectedDateIsPast = useMemo(() => startOfDay(selectedDate) < startOfDay(today), [selectedDate, today]);

  const selectedDateCalendarEntry = blockCalendarAvailability[selectedDateKey];

  const visibleMonthSummary = useMemo(() => {
    let free = 0;
    let booked = 0;
    let past = 0;

    calendarGridCells.forEach((date) => {
      if (!date) return;

      const dateKey = toDateKey(date);
      const isPast = startOfDay(date) < startOfDay(today);
      if (isPast) past += 1;

      if (blockCalendarAvailability[dateKey]?.status === 'booked') {
        booked += 1;
      } else {
        free += 1;
      }
    });

    return { free, booked, past };
  }, [calendarGridCells, blockCalendarAvailability, today]);

  const availableRoomsOnSelectedDate = useMemo(() => {
    return blockRooms.filter((room) => {
      const entry = room.calendarAvailability?.[selectedDateKey];
      return !entry || entry.status === 'free';
    });
  }, [blockRooms, selectedDateKey]);

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

  const submitBookingRequest = () => {
    if (selectedDateIsPast) {
      setRequestFeedback('Booking is not allowed for past dates. Please select current or future date.');
      return;
    }

    if (selectedDateCalendarEntry?.status === 'booked') {
      setRequestFeedback('This date is already booked. Please choose another date.');
      return;
    }

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

    if (!selectedRoom) {
      setRequestFeedback('Selected room is not available for this date.');
      return;
    }

    const requirementText = additionalRequirement.trim();
    setRequestFeedback(
      `Booking request submitted for ${prettyLongDate(selectedDate)} (${selectedRoom.name}) from ${formatTime12Hour(startTimeValue)} to ${formatTime12Hour(endTimeValue)}${selectedDurationLabel ? ` (${selectedDurationLabel})` : ''} in ${selectedBlock?.name ?? 'selected block'}${requirementText ? `. Additional requirement: ${requirementText}` : '.'}`,
    );
  };

  const startHoverPreview = (dateKey: string, element: HTMLButtonElement) => {
    const rect = element.getBoundingClientRect();
    const leftSpace = rect.left;
    const rightSpace = window.innerWidth - rect.right;

    if (leftSpace < 170) {
      setHoverTooltipAlign('left');
    } else if (rightSpace < 170) {
      setHoverTooltipAlign('right');
    } else {
      setHoverTooltipAlign('center');
    }

    setHoveredDateKey(dateKey);
  };

  const moveMonth = (direction: -1 | 1) => {
    setVisibleMonthAnchorDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1),
    );
    setHoveredDateKey(null);
  };

  const jumpToCurrentMonth = () => {
    setVisibleMonthAnchorDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDateKey(toDateKey(today));
    setHoveredDateKey(null);
    setRequestFeedback('');
    setSelectedRoomId('');
    setStartTimeValue('');
    setEndTimeValue('');
    setAdditionalRequirement('');
  };

  return (
    <>
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#e9f4ff_0%,#eef5ff_32%,#f8fafc_65%,#f5f8ff_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="rmb-orb rmb-orb-one" aria-hidden="true" />
      <div className="rmb-orb rmb-orb-two" aria-hidden="true" />
      <div className="mx-auto max-w-6xl">
        <header className="rmb-enter mb-6 rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-md backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#011f4b] sm:text-4xl">Room Browser</h1>
              <p className="mt-1 text-base text-[#266CA9] sm:text-lg">Select a date to see that date information.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/resource-management/seminar-hall-booking/my-bookings" className="inline-flex items-center rounded-xl border border-[#0F2573] bg-gradient-to-r from-[#041D56] to-[#0F2573] px-4 py-2.5 text-sm font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg hover:shadow-blue-900/20">
                My bookings
                <ArrowUpRight className="ml-1 inline h-4 w-4" />
              </Link>
              <Link href="/resource-management/seminar-hall-booking/admin" className="inline-flex items-center rounded-xl border border-[#266CA9] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F2573] transition duration-300 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-lg hover:shadow-blue-200/40">
                Admin queue
                <ArrowUpRight className="ml-1 inline h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <section className="rmb-enter rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6" style={{ animationDelay: '90ms' }}>
          <h2 className="text-sm font-bold tracking-[0.16em] text-[#266CA9]">SELECT BLOCK</h2>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {mockResourceBlocks.map((block) => {
              const isActive = block.id === selectedBlockId;
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => {
                    setSelectedBlockId(block.id);
                    setHoveredDateKey(null);
                    setIsRequestDialogOpen(false);
                    setRequestFeedback('');
                    setSelectedRoomId('');
                    setStartTimeValue('');
                    setEndTimeValue('');
                    setAdditionalRequirement('');
                  }}
                  className={[
                    'rounded-lg border px-4 py-2 text-sm font-semibold transition',
                    isActive
                      ? 'border-[#0F2573] bg-gradient-to-r from-[#041D56] to-[#0F2573] text-white'
                      : 'border-blue-100 bg-white text-[#03396c] hover:border-[#266CA9] hover:bg-blue-50',
                  ].join(' ')}
                >
                  {block.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rmb-enter mt-6 rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm sm:p-6" style={{ animationDelay: '160ms' }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="inline-flex items-center text-sm font-bold tracking-[0.16em] text-[#266CA9]">
              <CalendarDays className="mr-2 h-4 w-4" />
              MONTH CALENDAR
            </h2>
            <div className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white p-1">
              <button
                type="button"
                onClick={jumpToCurrentMonth}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0F2573] transition hover:bg-blue-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="rounded-lg border border-blue-100 bg-white p-2 text-[#03396c] transition hover:bg-blue-50"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-[140px] text-center text-sm font-semibold text-[#011f4b]">{formatMonthYear(visibleMonthAnchorDate)}</p>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="rounded-lg border border-blue-100 bg-white p-2 text-[#03396c] transition hover:bg-blue-50"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              Free: {visibleMonthSummary.free}
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
              Booked: {visibleMonthSummary.booked}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              Past dates: {visibleMonthSummary.past}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDayLabels.map((label) => (
              <p key={label} className="px-1 text-center text-[11px] font-bold uppercase tracking-wide text-[#266CA9]">
                {label}
              </p>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarGridCells.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="h-[66px] rounded-lg border border-transparent" aria-hidden="true" />;
              }

              const key = toDateKey(date);
              const entry = blockCalendarAvailability[key];
              const isSelected = key === selectedDateKey;
              const isHovered = key === hoveredDateKey;
              const isBooked = entry?.status === 'booked';
              const isPastDate = startOfDay(date) < startOfDay(today);
              const isToday = key === toDateKey(today);
              return (
                <button
                  key={key}
                  type="button"
                  onMouseEnter={(event) => startHoverPreview(key, event.currentTarget)}
                  onMouseLeave={() => setHoveredDateKey((current) => (current === key ? null : current))}
                  onFocus={(event) => startHoverPreview(key, event.currentTarget)}
                  onBlur={() => setHoveredDateKey((current) => (current === key ? null : current))}
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
                    'relative rounded-lg border px-3 py-2 text-left transition duration-300',
                    isSelected ? 'border-[#0F2573] bg-blue-50 ring-2 ring-[#266CA9]/30' : 'border-blue-100 bg-white hover:bg-blue-50/70',
                    isPastDate ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-50' : '',
                    isToday ? 'shadow-[inset_0_0_0_1px_rgba(15,37,115,0.25)]' : '',
                    !isPastDate ? 'hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-200/60' : '',
                  ].join(' ')}
                >
                  <p className="text-xs font-semibold text-[#011f4b]">
                    {date.getDate()} {isToday ? <span className="ml-1 rounded-full bg-[#0F2573] px-1.5 py-0.5 text-[10px] text-white">Today</span> : null}
                  </p>
                  <p className={['mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', isBooked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'].join(' ')}>
                    {isBooked ? 'Booked' : 'Free'}
                  </p>

                  {isHovered ? (
                    <div
                      className={[
                        'rmb-tooltip pointer-events-none absolute top-full z-20 mt-2 w-64 max-w-[85vw] rounded-lg border border-blue-100 bg-white p-3 text-[11px] text-[#03396c] shadow-xl',
                        hoverTooltipAlign === 'left' ? 'left-0' : '',
                        hoverTooltipAlign === 'center' ? 'left-1/2 -translate-x-1/2' : '',
                        hoverTooltipAlign === 'right' ? 'right-0' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'absolute -top-1.5 h-3 w-3 rotate-45 border-l border-t border-blue-100 bg-white',
                          hoverTooltipAlign === 'left' ? 'left-4' : '',
                          hoverTooltipAlign === 'center' ? 'left-1/2 -translate-x-1/2' : '',
                          hoverTooltipAlign === 'right' ? 'right-4' : '',
                        ].join(' ')}
                      />
                      <p className="font-semibold text-[#011f4b]">{prettyLongDate(date)}</p>
                      <p className="mt-1">
                        <span className="font-semibold">Status:</span> {isBooked ? 'Booked' : 'Free'}
                      </p>

                      {isBooked ? (
                        <>
                          {entry?.roomName ? (
                            <p className="mt-1">
                              <span className="font-semibold">Room:</span> {entry.roomName}
                            </p>
                          ) : null}
                          {entry?.bookedByName ? (
                            <p className="mt-1">
                              <span className="font-semibold">Name:</span> {entry.bookedByName}
                            </p>
                          ) : null}
                          {entry?.bookedByDepartment ? (
                            <p className="mt-1">
                              <span className="font-semibold">Department:</span> {entry.bookedByDepartment}
                            </p>
                          ) : null}
                          {entry?.bookedByMobile ? (
                            <p className="mt-1">
                              <span className="font-semibold">Phone:</span> {entry.bookedByMobile}
                            </p>
                          ) : null}
                          {entry?.bookedByEmail ? (
                            <p className="mt-1 break-all">
                              <span className="font-semibold">Email:</span> {entry.bookedByEmail}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="mt-1 text-emerald-700">This date is available for request.</p>
                      )}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {isRequestDialogOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
            <div className="rmb-dialog max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-blue-100 bg-white p-5 shadow-2xl sm:p-7">
              <div className="mb-5 flex items-start justify-between gap-4 border-b border-blue-100 pb-4">
                <div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-[#011f4b]">Room Request</h3>
                  <p className="mt-1 text-sm font-medium text-[#266CA9]">{prettyLongDate(selectedDate)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[#0F2573]">
                      Block: {selectedBlock?.name ?? 'N/A'}
                    </span>
                    <span
                      className={[
                        'rounded-full border px-2.5 py-1',
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
                  className="rounded-lg border border-blue-100 p-2 text-[#03396c] transition hover:bg-blue-50"
                  aria-label="Close request dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {selectedDateCalendarEntry?.status === 'booked' ? (
                <div className="grid gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700 md:grid-cols-2">
                  <p><span className="font-semibold">Status:</span> Booked</p>
                  {selectedDateCalendarEntry.roomName ? <p><span className="font-semibold">Room:</span> {selectedDateCalendarEntry.roomName}</p> : null}
                  {selectedDateCalendarEntry.roomType ? <p><span className="font-semibold">Room type:</span> {roomTypeLabels[selectedDateCalendarEntry.roomType]}</p> : null}
                  {selectedDateCalendarEntry.capacity ? <p><span className="font-semibold">Capacity:</span> {selectedDateCalendarEntry.capacity}</p> : null}
                  {selectedDateCalendarEntry.slotLabel ? <p><span className="font-semibold">Time slot:</span> {selectedDateCalendarEntry.slotLabel}</p> : null}
                  {selectedDateCalendarEntry.purpose ? <p className="md:col-span-2"><span className="font-semibold">Purpose:</span> {selectedDateCalendarEntry.purpose}</p> : null}
                  {selectedDateCalendarEntry.bookedByName ? <p><span className="font-semibold">Booked by:</span> {selectedDateCalendarEntry.bookedByName}</p> : null}
                  {selectedDateCalendarEntry.bookedByDepartment ? <p><span className="font-semibold">Department:</span> {selectedDateCalendarEntry.bookedByDepartment}</p> : null}
                  {selectedDateCalendarEntry.bookedByMobile ? <p><span className="font-semibold">Phone:</span> {selectedDateCalendarEntry.bookedByMobile}</p> : null}
                  {selectedDateCalendarEntry.bookedByEmail ? <p className="md:col-span-2"><span className="font-semibold">Email:</span> {selectedDateCalendarEntry.bookedByEmail}</p> : null}
                </div>
              ) : (
                <div className="space-y-4 text-sm text-[#03396c]">
                  <div className="rounded-2xl border border-blue-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#266CA9]">Booking Flow</p>
                    <p className="mt-1 text-sm text-[#03396c]">Select one room, choose start and end time, then submit one request.</p>
                  </div>
                  {selectedDateIsPast ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      Past dates are not allowed for booking requests. Please select current or future date.
                    </div>
                  ) : null}
                  {availableRoomsOnSelectedDate.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      No seminar hall or auditorium is available in selected block for this date.
                    </div>
                  ) : null}

                  {availableRoomsOnSelectedDate.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {availableRoomsOnSelectedDate.map((room) => {
                        const isRoomSelected = room.id === selectedRoomId;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setSelectedRoomId(room.id)}
                            className={[
                              'rounded-2xl border px-4 py-3 text-left text-xs transition duration-300',
                              isRoomSelected
                                ? 'border-[#0F2573] bg-blue-50 ring-2 ring-[#266CA9]/20 shadow-md shadow-blue-200/60'
                                : 'border-blue-100 bg-white text-[#03396c] hover:-translate-y-0.5 hover:border-[#266CA9] hover:bg-blue-50/50 hover:shadow-md hover:shadow-blue-200/40',
                            ].join(' ')}
                          >
                            <p className="font-semibold text-[#011f4b]">{room.name}</p>
                            <p className="mt-1 text-[#266CA9]">
                              {roomTypeLabels[room.type]} · Capacity {room.capacity} · Chairs {room.chairs}
                            </p>
                            {isRoomSelected ? (
                              <p className="mt-2 inline-flex rounded-full bg-[#0F2573] px-2.5 py-1 text-[10px] font-semibold text-white">
                                Selected
                              </p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-blue-100 bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0F2573]">Start time</p>
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
                                'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition duration-300',
                                isActive
                                  ? 'border-[#0F2573] bg-[#0F2573] text-white'
                                  : 'border-blue-200 bg-white text-[#03396c] hover:-translate-y-0.5 hover:border-[#266CA9] hover:bg-blue-50',
                              ].join(' ')}
                            >
                              {time.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0F2573]">End time</p>
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
                                'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition duration-300',
                                isActive
                                  ? 'border-[#0F2573] bg-[#0F2573] text-white'
                                  : 'border-blue-200 bg-white text-[#03396c] hover:-translate-y-0.5 hover:border-[#266CA9] hover:bg-blue-50',
                                isDisabled ? 'cursor-not-allowed opacity-50 hover:border-blue-200 hover:bg-white' : '',
                              ].join(' ')}
                            >
                              {time.label}
                            </button>
                          );
                        })}
                      </div>
                      {!startTimeValue ? (
                        <p className="mt-2 text-[11px] text-[#266CA9]">Select start time first.</p>
                      ) : null}
                    </div>
                  </div>

                  {selectedDurationLabel ? (
                    <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                      Total duration: {selectedDurationLabel}
                    </p>
                  ) : null}

                  <div className="pt-1">
                    <label htmlFor="additionalRequirement" className="mb-1 block text-xs font-semibold text-[#0F2573]">
                      Additional requirement (optional)
                    </label>
                    <input
                      id="additionalRequirement"
                      type="text"
                      value={additionalRequirement}
                      onChange={(event) => setAdditionalRequirement(event.target.value)}
                      className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-[#03396c] outline-none transition focus:border-[#266CA9] focus:ring-2 focus:ring-[#266CA9]/20"
                      placeholder="e.g., 2 wireless mics, HDMI adapter"
                    />
                  </div>

                  {selectedRoom ? (
                    <p className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 text-xs text-[#0F2573]">
                      Selected room: <span className="font-semibold">{selectedRoom.name}</span>
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={submitBookingRequest}
                    disabled={selectedDateIsPast || availableRoomsOnSelectedDate.length === 0}
                    className={[
                      'inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold text-white transition duration-300 sm:w-auto',
                      selectedDateIsPast || availableRoomsOnSelectedDate.length === 0
                        ? 'cursor-not-allowed border-slate-300 bg-slate-400'
                        : 'border-[#0F2573] bg-gradient-to-r from-[#041D56] to-[#0F2573] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg hover:shadow-blue-900/20',
                    ].join(' ')}
                  >
                    {selectedDateIsPast ? 'Past date not allowed' : 'Submit room request'}
                    <ArrowUpRight className="ml-1.5 h-4 w-4" />
                  </button>
                </div>
              )}

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
    <style jsx>{`
      .rmb-enter {
        animation: rmbFadeIn 520ms ease-out both;
      }

      .rmb-tooltip {
        animation: rmbTooltipIn 160ms ease-out both;
      }

      .rmb-dialog {
        animation: rmbDialogIn 260ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
      }

      .rmb-orb {
        position: absolute;
        border-radius: 999px;
        pointer-events: none;
        filter: blur(55px);
        opacity: 0.34;
      }

      .rmb-orb-one {
        width: 320px;
        height: 320px;
        top: -80px;
        right: -60px;
        background: radial-gradient(circle, #84bff5 0%, #b7d8f7 62%, rgba(183, 216, 247, 0) 100%);
        animation: rmbFloatOne 12s ease-in-out infinite;
      }

      .rmb-orb-two {
        width: 280px;
        height: 280px;
        bottom: 10%;
        left: -80px;
        background: radial-gradient(circle, #a4d6c1 0%, #cde8dc 64%, rgba(205, 232, 220, 0) 100%);
        animation: rmbFloatTwo 14s ease-in-out infinite;
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

      @keyframes rmbTooltipIn {
        from {
          opacity: 0;
          transform: translateY(6px);
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

      @keyframes rmbFloatOne {
        0%,
        100% {
          transform: translate3d(0, 0, 0);
        }
        50% {
          transform: translate3d(-18px, 14px, 0);
        }
      }

      @keyframes rmbFloatTwo {
        0%,
        100% {
          transform: translate3d(0, 0, 0);
        }
        50% {
          transform: translate3d(22px, -10px, 0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .rmb-enter,
        .rmb-tooltip,
        .rmb-dialog,
        .rmb-orb-one,
        .rmb-orb-two {
          animation: none;
        }
      }
    `}</style>
    </>
  );
}
