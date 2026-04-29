'use client';

import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText, Filter, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getBookingRequests, subscribeBookingRequests } from '../data/bookingRequestStore';
import { mockBookingRequests } from '../data/mockBookings';
import { fetchSeminarHallBookings } from '../services/seminarHall.api';
import type { BookingRequestItem, BookingRequestStatus } from '../types/roomBooking.types';

const statusPillClassMap: Record<BookingRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  cancel_pending: 'bg-orange-100 text-orange-700 border-orange-200',
  cancelled: 'bg-slate-200 text-slate-700 border-slate-300',
  reschedule_pending: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  rescheduled: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

const statusLabelMap: Record<BookingRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancel_pending: 'Cancel Pending',
  cancelled: 'Cancelled',
  reschedule_pending: 'Reschedule Pending',
  rescheduled: 'Rescheduled',
};

const requestTypeLabelMap: Record<BookingRequestItem['requestKind'], string> = {
  new_booking: 'New Booking',
  cancel_request: 'Cancellation Request',
  reschedule_request: 'Reschedule Request',
};

const monthMap: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseBookingDate(dateLabel: string): Date | null {
  const match = dateLabel.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = monthMap[match[2]];
  const year = Number(match[3]);
  if (month === undefined) return null;

  return new Date(year, month, day);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTime12HourToMinutes(timeLabel: string): number | null {
  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})\s(AM|PM)$/i);
  if (!match) return null;

  const hourRaw = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  const normalizedHour = hourRaw % 12;
  const hour24 = period === 'PM' ? normalizedHour + 12 : normalizedHour;
  return hour24 * 60 + minute;
}

function parseTimeSlotRange(timeSlot: string): { startMinutes: number | null; endMinutes: number | null } {
  const parts = timeSlot.split('-').map((x) => x.trim());
  if (parts.length !== 2) {
    return { startMinutes: null, endMinutes: null };
  }

  return {
    startMinutes: parseTime12HourToMinutes(parts[0]),
    endMinutes: parseTime12HourToMinutes(parts[1]),
  };
}

function parseInputTimeToMinutes(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatTime12Hour(time24: string): string {
  const [hourLabel, minuteLabel] = time24.split(':');
  const hour = Number(hourLabel);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, '0')}:${minuteLabel} ${period}`;
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function buildMonthGrid(anchorDate: Date): Array<Date | null> {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const dates = Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1));

  const leading = Array.from({ length: dates[0]?.getDay() ?? 0 }, () => null);
  const merged = [...leading, ...dates];
  const trailingLength = merged.length % 7 === 0 ? 0 : 7 - (merged.length % 7);
  const trailing = Array.from({ length: trailingLength }, () => null);
  return [...merged, ...trailing];
}

function BookingCard({ request }: { request: BookingRequestItem }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-[#1c2e4a]">{request.roomName}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {request.blockName}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#41577c]">{requestTypeLabelMap[request.requestKind]}</p>
        </div>
        <span className={['inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusPillClassMap[request.status]].join(' ')}>
          {statusLabelMap[request.status]}
        </span>
      </header>

      <div className="mt-4 grid gap-2 text-sm text-[#334b72] sm:grid-cols-2">
        <p className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#5f7ca5]" />
          {request.bookingDate}
        </p>
        <p className="inline-flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-[#5f7ca5]" />
          {request.timeSlot}
        </p>
        <p className="inline-flex items-center gap-2 sm:col-span-2">
          <MapPin className="h-4 w-4 text-[#5f7ca5]" />
          {request.roomType.replace('_', ' ')}
        </p>
        {request.department ? (
          <p className="inline-flex items-center gap-2 sm:col-span-2">
            <span className="font-semibold text-[#1f3b67]">Department:</span> {request.department}
          </p>
        ) : null}
      </div>

      {request.requestKind === 'cancel_request' ? (
        <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          <p className="text-xs font-semibold uppercase tracking-wide">Requested cancellation</p>
          <p className="mt-1">Original schedule: {request.originalBookingDate ?? request.bookingDate} · {request.originalTimeSlot ?? request.timeSlot}</p>
          <p className="mt-1 text-xs text-orange-700">Admin approval is required before this room slot is released.</p>
        </div>
      ) : null}

      {request.requestKind === 'reschedule_request' ? (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
          <p className="text-xs font-semibold uppercase tracking-wide">Requested reschedule</p>
          <p className="mt-1">From: {request.originalBookingDate ?? '-'} · {request.originalTimeSlot ?? '-'}</p>
          <p className="mt-1">To: {request.requestedBookingDate ?? request.bookingDate} · {request.requestedTimeSlot ?? request.timeSlot}</p>
          <p className="mt-1 text-xs text-indigo-700">New slot will be confirmed only after admin approval.</p>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7ca5]">Purpose</p>
        <p className="mt-1 text-sm text-[#334b72]">{request.purpose}</p>
      </div>

      {request.additionalRequirements ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7ca5]">Additional requirements</p>
          <p className="mt-1 text-sm text-[#334b72]">{request.additionalRequirements}</p>
        </div>
      ) : null}

      {request.adminRemark ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin remark</p>
          <p className="mt-1 text-sm text-slate-700">{request.adminRemark}</p>
        </div>
      ) : null}

      <footer className="mt-4 border-t border-slate-200 pt-3 text-xs text-[#6a7f9f]">{request.createdAtLabel}</footer>
    </article>
  );
}

function TimeFilterPicker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const selectedLabel = options.find((x) => x.value === value)?.label ?? 'Any';

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7f9f]">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#334b72] shadow-sm transition hover:border-[#5f7ca5]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedLabel}
        <ChevronRight className={['h-4 w-4 text-[#6a7f9f] transition', isOpen ? 'rotate-90' : ''].join(' ')} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={[
              'block w-full border-b border-slate-100 px-3 py-2 text-left text-sm font-semibold transition',
              !value ? 'bg-slate-100 text-[#1f3b67]' : 'text-[#334b72] hover:bg-slate-100',
            ].join(' ')}
          >
            Any
          </button>
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={[
                  'block w-full px-3 py-2 text-left text-sm transition',
                  value === option.value ? 'bg-slate-100 font-semibold text-[#1f3b67]' : 'text-[#334b72] hover:bg-slate-100',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MyBookingsPage() {
  const weekDayLabels = useMemo(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], []);
  const [statusFilter, setStatusFilter] = useState<'all' | BookingRequestStatus>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [timeFromFilter, setTimeFromFilter] = useState<string>('');
  const [timeToFilter, setTimeToFilter] = useState<string>('');
  const [requests, setRequests] = useState<BookingRequestItem[]>(() => (typeof window === 'undefined' ? mockBookingRequests : getBookingRequests()));
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState('');
  const [visibleMonthAnchorDate, setVisibleMonthAnchorDate] = useState<Date>(() => {
    const source = new Date();
    return new Date(source.getFullYear(), source.getMonth(), 1);
  });

  useEffect(() => {
    let isMounted = true;

    const loadRequests = async () => {
      try {
        setLoadingRequests(true);
        setRequestsError('');
        const backendRequests = await fetchSeminarHallBookings();

        if (!isMounted) {
          return;
        }

        const localRequests = getBookingRequests();
        const mergedRequests = [...backendRequests];

        localRequests.forEach((request) => {
          if (!mergedRequests.some((item) => item.id === request.id)) {
            mergedRequests.push(request);
          }
        });

        setRequests(mergedRequests);
      } catch {
        if (isMounted) {
          setRequests(getBookingRequests());
          setRequestsError('Unable to load booking requests from backend. Showing local data only.');
        }
      } finally {
        if (isMounted) {
          setLoadingRequests(false);
        }
      }
    };

    loadRequests();

    const unsubscribe = subscribeBookingRequests((nextRequests) => {
      setRequests((current) => {
        const merged = [...current];
        nextRequests.forEach((request) => {
          const index = merged.findIndex((item) => item.id === request.id);
          if (index >= 0) {
            merged[index] = request;
          } else {
            merged.unshift(request);
          }
        });
        return merged;
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const filterTimeOptions = useMemo(
    () =>
      ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']
        .map((value) => ({ value, label: formatTime12Hour(value) })),
    [],
  );

  const enrichedRequests = useMemo(() => {
    return requests.map((request) => {
      const bookingDateObj = parseBookingDate(request.bookingDate);
      const dateKey = bookingDateObj ? toDateKey(bookingDateObj) : '';
      const timeRange = parseTimeSlotRange(request.timeSlot);
      return {
        ...request,
        bookingDateObj,
        dateKey,
        startMinutes: timeRange.startMinutes,
        endMinutes: timeRange.endMinutes,
      };
    });
  }, [requests]);

  const calendarDataByDate = useMemo(() => {
    const map: Record<string, { total: number; approved: number; pending: number; rejected: number }> = {};

    enrichedRequests.forEach((request) => {
      if (!request.dateKey) return;
      if (!map[request.dateKey]) {
        map[request.dateKey] = { total: 0, approved: 0, pending: 0, rejected: 0 };
      }
      map[request.dateKey].total += 1;

      const metricKey =
        request.status === 'approved' || request.status === 'cancelled' || request.status === 'rescheduled'
          ? 'approved'
          : request.status === 'rejected'
            ? 'rejected'
            : 'pending';

      map[request.dateKey][metricKey] += 1;
    });

    return map;
  }, [enrichedRequests]);

  const filteredRequests = useMemo(() => {
    const fromMinutes = parseInputTimeToMinutes(timeFromFilter);
    const toMinutes = parseInputTimeToMinutes(timeToFilter);

    return enrichedRequests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      if (dateFilter && request.dateKey !== dateFilter) return false;

      if (fromMinutes !== null && request.endMinutes !== null && request.endMinutes <= fromMinutes) {
        return false;
      }

      if (toMinutes !== null && request.startMinutes !== null && request.startMinutes >= toMinutes) {
        return false;
      }

      return true;
    });
  }, [enrichedRequests, statusFilter, dateFilter, timeFromFilter, timeToFilter]);

  const summary = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((x) => x.status === 'pending').length,
      approved: requests.filter((x) => x.status === 'approved').length,
      rejected: requests.filter((x) => x.status === 'rejected').length,
      cancelPending: requests.filter((x) => x.status === 'cancel_pending').length,
      reschedulePending: requests.filter((x) => x.status === 'reschedule_pending').length,
    };
  }, [requests]);

  const calendarGridCells = useMemo(() => buildMonthGrid(visibleMonthAnchorDate), [visibleMonthAnchorDate]);

  const clearAllFilters = () => {
    setStatusFilter('all');
    setDateFilter('');
    setTimeFromFilter('');
    setTimeToFilter('');
  };

  return (
    <>
    <main className="min-h-screen bg-[#edf1f6] px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="mbp-enter rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl font-bold text-[#1c2e4a]">My Booking Requests</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">Track requests in list and calendar with date and time filters.</p>
            </div>
            <Link
              href="/resource-management/seminar-hall-booking"
              className="inline-flex items-center rounded-xl border border-[#0f274d] bg-[#0f274d] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to room browser
            </Link>
          </div>
        </header>

        <section className="mbp-enter grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '90ms' }}>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total requests</p>
            <p className="mt-1 text-3xl font-bold text-[#1c2e4a]">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending</p>
            <p className="mt-1 text-3xl font-bold text-amber-700">{summary.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Approved</p>
            <p className="mt-1 text-3xl font-bold text-emerald-700">{summary.approved}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Rejected</p>
            <p className="mt-1 text-3xl font-bold text-rose-700">{summary.rejected}</p>
          </div>
        </section>

        <section className="mbp-enter grid gap-3 sm:grid-cols-2" style={{ animationDelay: '140ms' }}>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Cancel approvals pending</p>
            <p className="mt-1 text-3xl font-bold text-orange-700">{summary.cancelPending}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Reschedule approvals pending</p>
            <p className="mt-1 text-3xl font-bold text-indigo-700">{summary.reschedulePending}</p>
          </div>
        </section>

        <section className="mbp-enter rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" style={{ animationDelay: '200ms' }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center text-sm font-semibold text-[#1c2e4a]">
              <Filter className="mr-2 h-4 w-4 text-[#6a7f9f]" />
              Filters (status, date, time)
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Clear all
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6a7f9f]">Status</p>
              <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'approved', 'rejected', 'cancel_pending', 'cancelled', 'reschedule_pending', 'rescheduled'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={[
                      'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                      statusFilter === status
                        ? 'border-[#0f274d] bg-[#0f274d] text-white'
                        : 'border-slate-300 bg-white text-[#334b72] hover:border-[#6a7f9f] hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {status === 'all' ? 'All' : statusLabelMap[status]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="dateFilter" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7f9f]">
                Date
              </label>
              <input
                id="dateFilter"
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#334b72] outline-none transition focus:border-[#6a7f9f]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <TimeFilterPicker
                label="Time from"
                value={timeFromFilter}
                onChange={setTimeFromFilter}
                options={filterTimeOptions}
              />
              <TimeFilterPicker
                label="Time to"
                value={timeToFilter}
                onChange={setTimeToFilter}
                options={filterTimeOptions}
              />
            </div>
          </div>
        </section>

        <section className="mbp-enter rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" style={{ animationDelay: '260ms' }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center text-sm font-semibold text-[#1c2e4a]">
              <CalendarDays className="mr-2 h-4 w-4 text-[#6a7f9f]" />
              Booking Calendar
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-1">
              <button
                type="button"
                onClick={() => setVisibleMonthAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="rounded-lg border border-slate-300 bg-white p-2 text-[#334b72] transition hover:bg-slate-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-[140px] text-center text-sm font-semibold text-[#1c2e4a]">{formatMonthYear(visibleMonthAnchorDate)}</p>
              <button
                type="button"
                onClick={() => setVisibleMonthAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="rounded-lg border border-slate-300 bg-white p-2 text-[#334b72] transition hover:bg-slate-100"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {weekDayLabels.map((label) => (
              <p key={label} className="px-1 text-center text-[11px] font-bold uppercase tracking-wide text-[#6a7f9f]">
                {label}
              </p>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarGridCells.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="h-[76px] rounded-lg border border-transparent" aria-hidden="true" />;
              }

              const dateKey = toDateKey(date);
              const metrics = calendarDataByDate[dateKey];
              const isDateFiltered = dateFilter === dateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setDateFilter((current) => (current === dateKey ? '' : dateKey))}
                  className={[
                    'rounded-lg border border-slate-200 px-2 py-2 text-left transition',
                    isDateFiltered
                      ? 'border-[#0f274d] bg-blue-50 ring-1 ring-[#6a7f9f]/40'
                      : 'bg-white hover:bg-slate-50',
                  ].join(' ')}
                >
                  <p className="text-xs font-semibold text-[#1c2e4a]">{date.getDate()}</p>
                  {metrics ? (
                    <>
                      <p className="mt-1 text-[11px] font-semibold text-[#334b72]">{metrics.total} request{metrics.total > 1 ? 's' : ''}</p>
                      <div className="mt-1 flex items-center gap-1">
                        {metrics.approved > 0 ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
                        {metrics.pending > 0 ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                        {metrics.rejected > 0 ? <span className="h-2 w-2 rounded-full bg-rose-500" /> : null}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">No requests</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mbp-enter space-y-4" style={{ animationDelay: '320ms' }}>
          {loadingRequests ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-base font-semibold text-[#1c2e4a]">Loading booking requests...</p>
            </div>
          ) : null}
          {requestsError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 shadow-sm">
              {requestsError}
            </div>
          ) : null}
          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <FileText className="mx-auto h-8 w-8 text-[#6a7f9f]" />
              <p className="mt-2 text-base font-semibold text-[#1c2e4a]">No booking requests for selected filters</p>
            </div>
          ) : (
            filteredRequests.map((request) => <BookingCard key={request.id} request={request} />)
          )}
        </section>
      </div>
    </main>
    <style jsx>{`
      .mbp-enter {
        animation: mbpFadeIn 520ms ease-out both;
      }

      @keyframes mbpFadeIn {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mbp-enter {
          animation: none;
        }
      }
    `}</style>
    </>
  );
}
