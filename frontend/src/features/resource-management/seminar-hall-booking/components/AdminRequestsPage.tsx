'use client';

import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Filter, Mail, Phone, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { AdminBookingRequest, AdminBookingStatus } from '../data/mockAdminRequests';
import { mockAdminBookingRequests } from '../data/mockAdminRequests';

const statusLabelMap: Record<AdminBookingStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancel_pending: 'Cancel Pending',
  cancelled: 'Cancelled',
  reschedule_pending: 'Reschedule Pending',
  rescheduled: 'Rescheduled',
};

const statusPillClassMap: Record<AdminBookingStatus, string> = {
  pending: 'border-amber-200 bg-amber-100 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-100 text-rose-700',
  cancel_pending: 'border-orange-200 bg-orange-100 text-orange-700',
  cancelled: 'border-slate-300 bg-slate-200 text-slate-700',
  reschedule_pending: 'border-indigo-200 bg-indigo-100 text-indigo-700',
  rescheduled: 'border-cyan-200 bg-cyan-100 text-cyan-700',
};

const requestTypeLabelMap: Record<AdminBookingRequest['requestKind'], string> = {
  new_booking: 'New Booking Request',
  cancel_request: 'Cancellation Request',
  reschedule_request: 'Reschedule Request',
};

function RequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: AdminBookingRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isActionable = request.status === 'pending' || request.status === 'cancel_pending' || request.status === 'reschedule_pending';

  return (
    <article className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#011f4b]">{request.roomName}</h3>
          <p className="mt-1 text-sm font-medium text-[#266CA9]">
            {request.blockName} · {request.roomType === 'seminar_hall' ? 'Seminar Hall' : 'Auditorium'}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#0F2573]">{requestTypeLabelMap[request.requestKind]}</p>
        </div>
        <span className={['inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusPillClassMap[request.status]].join(' ')}>
          {statusLabelMap[request.status]}
        </span>
      </header>

      <div className="mt-4 grid gap-2 text-sm text-[#03396c] md:grid-cols-2">
        <p className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#266CA9]" />
          {request.bookingDate}
        </p>
        <p className="inline-flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-[#266CA9]" />
          {request.timeSlot}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm text-[#03396c]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#266CA9]">Requested by</p>
        <p className="mt-1 font-semibold text-[#011f4b]">{request.requesterName}</p>
        <p className="mt-1 inline-flex items-center gap-2 text-xs">
          <Mail className="h-3.5 w-3.5" />
          {request.requesterEmail}
        </p>
        <p className="mt-1 inline-flex items-center gap-2 text-xs">
          <Phone className="h-3.5 w-3.5" />
          {request.requesterPhone}
        </p>
        {request.department ? <p className="mt-1 text-xs"><span className="font-semibold text-[#0F2573]">Department:</span> {request.department}</p> : null}
      </div>

      {request.requestKind === 'cancel_request' ? (
        <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          <p className="text-xs font-semibold uppercase tracking-wide">Cancellation details</p>
          <p className="mt-1">Original booking: {request.originalBookingDate ?? request.bookingDate} · {request.originalTimeSlot ?? request.timeSlot}</p>
        </div>
      ) : null}

      {request.requestKind === 'reschedule_request' ? (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
          <p className="text-xs font-semibold uppercase tracking-wide">Reschedule details</p>
          <p className="mt-1">From: {request.originalBookingDate ?? '-'} · {request.originalTimeSlot ?? '-'}</p>
          <p className="mt-1">To: {request.requestedBookingDate ?? request.bookingDate} · {request.requestedTimeSlot ?? request.timeSlot}</p>
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-blue-100 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#266CA9]">Purpose</p>
        <p className="mt-1 text-sm text-[#03396c]">{request.purpose}</p>
      </div>

      {request.additionalRequirements ? (
        <div className="mt-3 rounded-xl border border-blue-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#266CA9]">Additional requirements</p>
          <p className="mt-1 text-sm text-[#03396c]">{request.additionalRequirements}</p>
        </div>
      ) : null}

      {request.adminRemark ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin remark</p>
          <p className="mt-1 text-sm text-slate-700">{request.adminRemark}</p>
        </div>
      ) : null}

      {isActionable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onApprove(request.id)}
            className="inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Approve request
          </button>
          <button
            type="button"
            onClick={() => onReject(request.id)}
            className="inline-flex items-center rounded-lg border border-rose-300 bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            Reject request
          </button>
        </div>
      ) : null}

      <footer className="mt-4 border-t border-blue-100 pt-3 text-xs text-[#266CA9]">{request.createdAtLabel}</footer>
    </article>
  );
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminBookingRequest[]>(mockAdminBookingRequests);
  const [statusFilter, setStatusFilter] = useState<'all' | AdminBookingStatus>('all');

  const summary = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((x) => x.status === 'pending' || x.status === 'cancel_pending' || x.status === 'reschedule_pending').length,
      bookingPending: requests.filter((x) => x.status === 'pending').length,
      cancelPending: requests.filter((x) => x.status === 'cancel_pending').length,
      reschedulePending: requests.filter((x) => x.status === 'reschedule_pending').length,
      approved: requests.filter((x) => x.status === 'approved').length,
      cancelled: requests.filter((x) => x.status === 'cancelled').length,
      rescheduled: requests.filter((x) => x.status === 'rescheduled').length,
      rejected: requests.filter((x) => x.status === 'rejected').length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((item) => item.status === statusFilter);
  }, [requests, statusFilter]);

  const handleApprove = (id: string) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.id === id
          ? request.requestKind === 'cancel_request'
            ? {
                ...request,
                status: 'cancelled',
                adminRemark: 'Cancellation approved by admin. Room slot has been released.',
              }
            : request.requestKind === 'reschedule_request'
              ? {
                  ...request,
                  status: 'rescheduled',
                  adminRemark: 'Reschedule approved. New date and time slot confirmed.',
                }
              : {
                  ...request,
                  status: 'approved',
                  adminRemark: 'Approved by block admin. Resource team notified.',
                }
          : request,
      ),
    );
  };

  const handleReject = (id: string) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.id === id
          ? request.requestKind === 'cancel_request'
            ? {
                ...request,
                status: 'approved',
                adminRemark: 'Cancellation rejected by admin. Original booking remains approved.',
              }
            : request.requestKind === 'reschedule_request'
              ? {
                  ...request,
                  status: 'approved',
                  adminRemark: 'Reschedule rejected by admin. Original approved slot remains active.',
                }
              : {
                  ...request,
                  status: 'rejected',
                  adminRemark: 'Rejected due to time-slot conflict with another approved request.',
                }
          : request,
      ),
    );
  };

  return (
    <>
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#eaf4ff_0%,#eef5ff_35%,#f8fafc_70%,#f4f7ff_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="abp-orb abp-orb-one" aria-hidden="true" />
      <div className="abp-orb abp-orb-two" aria-hidden="true" />
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="abp-enter rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-md backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#011f4b] sm:text-4xl">Admin Booking Requests</h1>
              <p className="mt-1 text-base text-[#266CA9]">Review and approve/reject booking, cancellation, and reschedule requests.</p>
            </div>
            <Link
              href="/resource-management/seminar-hall-booking"
              className="inline-flex items-center rounded-xl border border-[#0F2573] bg-gradient-to-r from-[#041D56] to-[#0F2573] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to room browser
            </Link>
          </div>
        </header>

        <section className="abp-enter grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={{ animationDelay: '90ms' }}>
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

        <section className="abp-enter rounded-2xl border border-blue-100 bg-white/85 p-4 shadow-sm sm:p-5" style={{ animationDelay: '160ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center text-sm font-semibold text-[#011f4b]">
              <Filter className="mr-2 h-4 w-4 text-[#266CA9]" />
              Filter by status
            </p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'cancel_pending', 'reschedule_pending', 'approved', 'cancelled', 'rescheduled', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                    statusFilter === status
                      ? 'border-[#0F2573] bg-gradient-to-r from-[#041D56] to-[#0F2573] text-white'
                      : 'border-blue-100 bg-white text-[#03396c] hover:border-[#266CA9] hover:bg-blue-50',
                  ].join(' ')}
                >
                  {status === 'all' ? 'All' : statusLabelMap[status]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="abp-enter space-y-4" style={{ animationDelay: '220ms' }}>
          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-sm">
              <p className="text-base font-semibold text-[#011f4b]">No requests found for this status.</p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </section>
      </div>
    </main>
    <style jsx>{`
      .abp-enter {
        animation: abpFadeIn 520ms ease-out both;
      }

      .abp-orb {
        position: absolute;
        border-radius: 999px;
        pointer-events: none;
        filter: blur(50px);
        opacity: 0.3;
      }

      .abp-orb-one {
        width: 290px;
        height: 290px;
        top: -70px;
        right: -60px;
        background: radial-gradient(circle, #95c9f7 0%, #c4dff8 64%, rgba(196, 223, 248, 0) 100%);
        animation: abpFloatOne 13s ease-in-out infinite;
      }

      .abp-orb-two {
        width: 250px;
        height: 250px;
        bottom: 8%;
        left: -70px;
        background: radial-gradient(circle, #a7ddd3 0%, #cceae4 64%, rgba(204, 234, 228, 0) 100%);
        animation: abpFloatTwo 15s ease-in-out infinite;
      }

      @keyframes abpFadeIn {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes abpFloatOne {
        0%,
        100% {
          transform: translate3d(0, 0, 0);
        }
        50% {
          transform: translate3d(-15px, 12px, 0);
        }
      }

      @keyframes abpFloatTwo {
        0%,
        100% {
          transform: translate3d(0, 0, 0);
        }
        50% {
          transform: translate3d(18px, -10px, 0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .abp-enter,
        .abp-orb-one,
        .abp-orb-two {
          animation: none;
        }
      }
    `}</style>
    </>
  );
}
