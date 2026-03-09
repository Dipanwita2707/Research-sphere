'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, QrCode, Download, X, CheckCircle, Clock, XCircle, Users, Search, Ticket as TicketIcon } from 'lucide-react';
import QRCodeGenerator from 'qrcode';
import { eventService } from '@/features/event-management/services/event.service';
import type { EventRegistration } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import TicketModal from '@/components/TicketModal';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { CardSkeleton } from "@/components/skeletons";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Clock },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  waitlisted: { label: 'Waitlisted', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Clock },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  incomplete_team: { label: 'Incomplete Team', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: Users },
};

const REGISTRATION_STATUS_OPTIONS = [
  { id: '', label: 'All Tickets' },
  { id: 'confirmed', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'waitlisted', label: 'Waitlist' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function MyRegistrationsPage() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<EventRegistration | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [addingGuestFor, setAddingGuestFor] = useState<string | null>(null);
  const [guestForm, setGuestForm] = useState({ guestName: '', guestEmail: '', mobileNumber: '', relationship: '' });
  const [submittingGuest, setSubmittingGuest] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const result = await eventService.getMyRegistrations(
        page,
        20,
        statusFilter || undefined,
        debouncedSearch || undefined
      );
      setRegistrations(result.registrations);
      setPagination(result.pagination);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [page, statusFilter, debouncedSearch]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Generate QR code when modal opens
  useEffect(() => {
    if (selectedQR) {
      QRCodeGenerator.toDataURL(selectedQR, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then(setQrDataUrl)
        .catch(err => {
          console.error('QR generation error:', err);
          toast({ type: 'error', message: 'Failed to generate QR code' });
        });
    }
  }, [selectedQR, toast]);

  const downloadQRCode = async (qrCode: string, registration: EventRegistration) => {
    try {
      // Generate QR code as data URL
      const dataUrl = await QRCodeGenerator.toDataURL(qrCode, {
        width: 600,
        margin: 2,
      });

      // Download the image
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${registration.event?.name?.replace(/\s+/g, '_')}_${registration.registrationId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ type: 'success', message: 'QR code downloaded' });
    } catch (error) {
      console.error('Download error:', error);
      toast({ type: 'error', message: 'Failed to download QR code' });
    }
  };

  const handleCreateExtraPass = async (registration: EventRegistration) => {
    const eventId = (registration as any).Event?.id || registration.event?.id;
    if (!eventId) {
      toast({ type: 'error', message: 'Unable to detect event for this registration' });
      return;
    }

    if (!guestForm.guestName.trim() || !guestForm.guestEmail.trim() || !guestForm.mobileNumber.trim() || !guestForm.relationship.trim()) {
      toast({ type: 'error', message: 'Please fill all guest details' });
      return;
    }

    setSubmittingGuest(true);
    try {
      await eventService.createExtraPass(eventId, {
        guestName: guestForm.guestName.trim(),
        guestEmail: guestForm.guestEmail.trim(),
        mobileNumber: guestForm.mobileNumber.trim(),
        relationship: guestForm.relationship.trim(),
      });
      toast({ type: 'success', message: 'Extra pass created successfully' });
      setGuestForm({ guestName: '', guestEmail: '', mobileNumber: '', relationship: '' });
      await fetchRegistrations();
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setSubmittingGuest(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-black font-sans selection:bg-ev-700/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-ev-900 dark:text-white tracking-tight mb-3">
              My Tickets
            </h1>
            <p className="text-sm sm:text-lg text-gray-500 dark:text-gray-400 font-medium max-w-lg">
              Manage your event access. View your passes and entry details.
            </p>
          </div>

          <Link
            href="/events"
            className="group flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-900 border border-[#b3cde0] dark:border-gray-800 rounded-full hover:border-ev-700 dark:hover:border-ev-700 transition-all shadow-ev hover:shadow-md"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-ev-700 dark:group-hover:text-ev-400 transition-colors">
              Explore Events
            </span>
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-ev-50 dark:group-hover:bg-ev-900/30 flex items-center justify-center transition-colors">
              <TicketIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-ev-700 dark:group-hover:text-ev-400" />
            </div>
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full appearance-none rounded-2xl border border-[#b3cde0] dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 pr-10 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-ev outline-none transition focus:border-ev-700 focus:ring-4 focus:ring-ev-700/10"
            >
              {REGISTRATION_STATUS_OPTIONS.map((status) => (
                <option key={status.id || 'all'} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder={statusFilter ? 'Search within selected status' : 'Search all tickets'}
              className="w-full rounded-2xl border border-[#b3cde0] dark:border-gray-800 bg-white dark:bg-gray-900 px-11 py-3 pr-11 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-ev outline-none transition placeholder:text-gray-400 focus:border-ev-700 focus:ring-4 focus:ring-ev-700/10"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Registrations List */}
        {loading ? (
          <PageSkeleton message="Loading your passes..." />
        ) : registrations.length === 0 ? (
          <div className="text-center py-24 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-gray-50/50 to-transparent dark:from-gray-800/20 dark:to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <TicketIcon className="h-10 w-10 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </div>
              <h3 className="text-2xl font-bold text-ev-900 dark:text-white mb-3">No tickets found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto leading-relaxed">
                {searchTerm || statusFilter
                  ? 'No tickets match the selected filter and search.'
                  : "You haven't registered for any events yet. Join an event to see your tickets here."}
              </p>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 px-8 py-3 bg-ev-700 hover:bg-ev-800 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-ev-700/25 active:scale-95"
              >
                Browse Events
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-8 mb-12">
              {registrations.map((registration) => {
                const statusConfig = STATUS_CONFIG[registration.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const eventName = (registration as any).Event?.name || registration.event?.name || 'Event Name';
                const eventDate = (registration as any).Event?.startDate || registration.event?.startDate;
                const eventVenue = (registration as any).Event?.venue || registration.event?.venue;
                const eventType = (registration as any).Event?.eventType || registration.event?.eventType;
                const regId = registration.registrationId;
                const eventAllowsExtraPasses = Boolean((registration as any).Event?.allowExtraPasses ?? registration.event?.allowExtraPasses);
                const maxExtraPasses = Number((registration as any).Event?.maxExtraPassesPerUser ?? registration.event?.maxExtraPassesPerUser ?? 0);
                const summary = registration.extraPassSummary || {
                  extraPassCount: registration.extraPassCount || 0,
                  totalAllowedEntries: registration.totalAllowedEntries || 1,
                  checkedInCount: registration.checkedInCount || 0,
                  remainingEntries: Math.max(0, (registration.totalAllowedEntries || 1) - (registration.checkedInCount || 0)),
                };
                const guests = registration.guests || [];
                const canAddExtraPass = eventAllowsExtraPasses && summary.extraPassCount < maxExtraPasses;
                const registrationEligible = !['cancelled', 'rejected', 'draft', 'waitlisted'].includes(registration.status);

                const getStatusStyles = (status: string) => {
                  switch (status) {
                    case 'confirmed':
                      return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 border border-green-200 dark:border-green-500/30';
                    case 'cancelled':
                    case 'rejected':
                      return 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/30';
                    case 'pending':
                    case 'waitlisted':
                      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30';
                    default:
                      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border border-[#b3cde0] dark:border-gray-700';
                  }
                };

                return (
                  <div
                    key={registration.id}
                    className="group relative bg-white dark:bg-gray-900 rounded-[2rem] border border-[#b3cde0] dark:border-gray-800 shadow-ev hover:shadow-xl transition-all duration-300 overflow-hidden"
                  >
                    {/* Decorative Top Gradient Line */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${registration.status === 'confirmed' ? 'from-green-500 via-emerald-500 to-teal-500' :
                        registration.status === 'cancelled' ? 'from-red-500 to-pink-600' :
                          'from-amber-400 to-orange-500'
                      }`} />

                    <div className="flex flex-col lg:flex-row">
                      {/* Left: Event Info (Ticket Body) */}
                      <div className="flex-1 p-6 lg:p-7 relative">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.4] pointer-events-none" />

                        <div className="relative z-10 flex flex-col h-full justify-between gap-6">

                          {/* Top: Header & Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div>
                              {eventType && (
                                <span className="inline-block px-2.5 py-0.5 mb-2 rounded-md text-[10px] font-bold tracking-wider uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                  {eventType}
                                </span>
                              )}
                              <h3 className="text-xl sm:text-2xl font-black text-ev-900 dark:text-white leading-tight mb-1.5">
                                {eventName}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700" />
                                <span>ID: {regId}</span>
                              </div>
                            </div>

                            <div className={`
                              self-start px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-ev
                              ${getStatusStyles(registration.status)}
                            `}>
                              {StatusIcon && <StatusIcon className="w-3 h-3" />}
                              {statusConfig.label}
                            </div>
                          </div>

                          {/* Middle: Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-[#b3cde0] dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Date & Time</p>
                                <p className="text-sm font-semibold text-ev-900 dark:text-white">
                                  {eventDate ? formatDate(eventDate) : 'TBA'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-[#b3cde0] dark:border-gray-800 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                                <MapPin className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Location</p>
                                <p className="text-sm font-semibold text-ev-900 dark:text-white line-clamp-1">
                                  {eventVenue || 'TBA'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Bottom: Check-in Status or Extra Info */}
                          {registration.hasEntered && registration.enteredAt && (
                            <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400 text-xs font-medium w-fit">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Checked in at {formatDate(registration.enteredAt)}
                            </div>
                          )}

                          <div className="rounded-xl border border-[#b3cde0] dark:border-gray-700 p-3 bg-white/80 dark:bg-gray-900/40">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Group Pass Summary</p>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
                                <p className="text-gray-500">Total People</p>
                                <p className="font-bold text-ev-900 dark:text-gray-100">{summary.totalAllowedEntries}</p>
                              </div>
                              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
                                <p className="text-gray-500">Checked In</p>
                                <p className="font-bold text-ev-900 dark:text-gray-100">{summary.checkedInCount}</p>
                              </div>
                              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
                                <p className="text-gray-500">Remaining</p>
                                <p className="font-bold text-ev-900 dark:text-gray-100">{summary.remainingEntries}</p>
                              </div>
                            </div>

                            {eventAllowsExtraPasses && registrationEligible && (
                              <div className="mt-3">
                                <button
                                  onClick={() => setAddingGuestFor(prev => prev === registration.id ? null : registration.id)}
                                  disabled={!canAddExtraPass}
                                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-ev-700 text-white disabled:bg-gray-300 disabled:text-gray-600"
                                >
                                  Add Extra Pass
                                </button>
                                <p className="text-xs text-gray-500 mt-1">Used: {summary.extraPassCount}/{maxExtraPasses} guest passes</p>
                              </div>
                            )}

                            {addingGuestFor === registration.id && canAddExtraPass && (
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input value={guestForm.guestName} onChange={(e) => setGuestForm(prev => ({ ...prev, guestName: e.target.value }))} placeholder="Guest Name" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800" />
                                <input value={guestForm.guestEmail} onChange={(e) => setGuestForm(prev => ({ ...prev, guestEmail: e.target.value }))} placeholder="Guest Email" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800" />
                                <input value={guestForm.mobileNumber} onChange={(e) => setGuestForm(prev => ({ ...prev, mobileNumber: e.target.value }))} placeholder="Mobile Number" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800" />
                                <input value={guestForm.relationship} onChange={(e) => setGuestForm(prev => ({ ...prev, relationship: e.target.value }))} placeholder="Relationship" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800" />
                                <button
                                  onClick={() => handleCreateExtraPass(registration)}
                                  disabled={submittingGuest}
                                  className="sm:col-span-2 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-900 text-white disabled:opacity-60"
                                >
                                  {submittingGuest ? 'Creating...' : 'Create Guest Pass'}
                                </button>
                              </div>
                            )}

                            {guests.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Guest List</p>
                                <div className="space-y-1 max-h-28 overflow-y-auto">
                                  {guests.map((guest) => (
                                    <div key={guest.id} className="text-xs px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 flex justify-between gap-2">
                                      <span className="font-medium text-gray-800 dark:text-gray-100">{guest.guestName}</span>
                                      <span className="text-gray-500">{guest.relationship}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Divider (Perforation Line) */}
                      <div className="relative hidden lg:block w-[2px]">
                        <div className="absolute top-0 bottom-0 left-0 w-full border-l-2 border-dashed border-gray-300 dark:border-gray-700"></div>
                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-[#F8FAFC] dark:bg-black rounded-full z-20"></div>
                        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-[#F8FAFC] dark:bg-black rounded-full z-20"></div>
                      </div>

                      {/* Right: Actions (Ticket Stub) */}
                      <div className="lg:w-64 bg-gray-50 dark:bg-gray-800/30 p-6 lg:p-7 flex flex-col justify-center items-center gap-4 border-t lg:border-t-0 lg:border-l border-[#b3cde0]/30 dark:border-gray-800">
                        {registration.status === 'confirmed' ? (
                          <>
                            {/* QR Button / Preview */}
                            <button
                              onClick={() => setSelectedQR(registration.qrCode)}
                              className="group/qr w-32 aspect-square bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1.5 hover:border-ev-700 dark:hover:border-ev-700 transition-all cursor-pointer relative overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-ev-50 dark:bg-ev-900/10 opacity-0 group-hover/qr:opacity-100 transition-opacity" />
                              <QrCode className="w-8 h-8 text-gray-400 group-hover/qr:text-ev-700 transition-colors" />
                              <span className="text-[10px] font-bold text-gray-500 group-hover/qr:text-ev-700 uppercase tracking-wide">Show QR</span>
                            </button>

                            <button
                              onClick={() => setSelectedTicket(registration)}
                              className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs shadow-lg shadow-gray-200 dark:shadow-none hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                              <TicketIcon className="w-3.5 h-3.5" />
                              View Pass
                            </button>
                          </>
                        ) : (
                          <div className="text-center p-4 rounded-xl bg-gray-100 dark:bg-gray-800 w-full aspect-square flex flex-col items-center justify-center gap-2">
                            {StatusIcon && <StatusIcon className="w-8 h-8 text-gray-400 opacity-50" />}
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              No Pass<br />({statusConfig.label})
                            </span>
                          </div>
                        )}

                        <Link
                          href={`/events/${(registration as any).Event?.id || registration.event?.id}`}
                          className="text-xs font-semibold text-gray-500 hover:text-ev-900 dark:hover:text-white transition-colors flex items-center gap-1"
                        >
                          View Event Page
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 py-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-6 py-3 border border-[#b3cde0] dark:border-gray-800 rounded-xl font-semibold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-ev"
                >
                  Previous
                </button>

                <span className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-400">
                  {pagination.page} / {pagination.totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-6 py-3 border border-[#b3cde0] dark:border-gray-800 rounded-xl font-semibold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-ev"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Improved QR Code Modal */}
        {selectedQR && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div
              className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-8 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative overflow-hidden border border-[#b3cde0] dark:border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Decorative Header */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-ev-700 to-purple-600" />

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-ev-900 dark:text-white">Entry Pass</h3>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">Scan at gate</p>
                </div>
                <button
                  onClick={() => setSelectedQR(null)}
                  className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-[#b3cde0] mb-6 flex flex-col items-center justify-center relative">
                <div className="absolute top-0 bottom-0 left-0 w-full h-full opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]" />

                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-full aspect-square rounded-lg object-contain relative z-10 mix-blend-multiply dark:mix-blend-normal"
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 w-48">
                    <CardSkeleton className="w-full max-w-sm" />
                  </div>
                )}
                <div className="mt-4 px-3 py-1.5 bg-gray-100 rounded-md font-mono text-xs font-bold text-gray-600 tracking-wider">
                  {selectedQR}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => selectedTicket && downloadQRCode(selectedQR, selectedTicket)}
                  className="w-full py-3 bg-ev-700 text-white rounded-xl font-bold text-sm hover:bg-ev-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-ev-200 dark:shadow-none"
                >
                  <Download className="w-4 h-4" />
                  Download Pass
                </button>
                <button
                  onClick={() => setSelectedQR(null)}
                  className="w-full py-3 bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl font-semibold text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ticket Modal Component */}
        <TicketModal
          registration={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      </div>
    </div>
  );
}
