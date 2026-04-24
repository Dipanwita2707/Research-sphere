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
};

const statusPillClassMap: Record<AdminBookingStatus, string> = {
  pending: 'border-amber-200 bg-amber-100 text-amber-700',
  approved: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-100 text-rose-700',
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
  const isPending = request.status === 'pending';

  return (
    <article className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#011f4b]">{request.roomName}</h3>
          <p className="mt-1 text-sm font-medium text-[#266CA9]">
            {request.blockName} · {request.roomType === 'seminar_hall' ? 'Seminar Hall' : 'Auditorium'}
          </p>
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
      </div>

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

      {isPending ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onApprove(request.id)}
            className="inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReject(request.id)}
            className="inline-flex items-center rounded-lg border border-rose-300 bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            Reject
          </button>
        </div>
      ) : null}

      <footer className="mt-4 border-t border-blue-100 pt-3 text-xs text-[#266CA9]">{request.createdAtLabel}</footer>
    </article>
  );
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminBookingRequest[]>(mockAdminBookingRequests);
  const [statusFilter, setStatusFilter] = useState<'all' | AdminBookingStatus>('pending');

  const summary = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((x) => x.status === 'pending').length,
      approved: requests.filter((x) => x.status === 'approved').length,
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
          ? {
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
          ? {
              ...request,
              status: 'rejected',
              adminRemark: 'Rejected due to time-slot conflict with another approved request.',
            }
          : request,
      ),
    );
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50 to-slate-100 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-md backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#011f4b] sm:text-4xl">Admin Booking Requests</h1>
              <p className="mt-1 text-base text-[#266CA9]">Review and approve/reject room booking requests by block.</p>
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

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#266CA9]">Total requests</p>
            <p className="mt-1 text-3xl font-bold text-[#011f4b]">{summary.total}</p>
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

        <section className="rounded-2xl border border-blue-100 bg-white/85 p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center text-sm font-semibold text-[#011f4b]">
              <Filter className="mr-2 h-4 w-4 text-[#266CA9]" />
              Filter by status
            </p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
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

        <section className="space-y-4">
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
  );
}
