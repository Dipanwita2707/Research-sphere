'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Calendar, MapPin, Users, DollarSign, Loader2, 
  UserPlus, Clock
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

const EVENT_TYPE_LABELS: Record<string, string> = {
  seminar: 'Seminar',
  workshop: 'Workshop',
  fest: 'Fest',
  conference: 'Conference',
  competition: 'Competition',
  cultural: 'Cultural',
  technical: 'Technical',
  sports: 'Sports',
  other: 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  published: { label: 'Published', color: 'bg-blue-100 text-blue-800' },
  ongoing: { label: 'Ongoing', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { toast } = useToast();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const authStr = localStorage.getItem('auth-storage');
      if (authStr) {
        const auth = JSON.parse(authStr);
        setCurrentUserId(auth?.state?.user?.id ?? null);
      }
    } catch {}
  }, []);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const data = await eventService.getEventById(id);
      setEvent(data);
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to load event' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isCreator = event?.createdBy?.id === currentUserId;
  const isRegistered = !!event?.userRegistration;
  const canRegister = event?.status === 'published' && !isCreator && !isRegistered;
  const isDraft = event?.status === 'draft';

  const handleRegister = async () => {
    if (!event) return;
    
    setRegistering(true);
    try {
      const registration = await eventService.registerForEvent(event.id);
      toast({ type: 'success', message: 'Successfully registered for event! Check your QR code in My Registrations.' });
      fetchEvent(); // Refresh event data
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to register' });
    } finally {
      setRegistering(false);
    }
  };

  // Redirect draft events to management page
  useEffect(() => {
    if (event && event.status === 'draft' && isCreator) {
      toast({ 
        type: 'info', 
        message: 'This event is in draft status. Redirecting to management page...' 
      });
      router.push(`/events/${event.id}/manage`);
    }
  }, [event, isCreator, router, toast]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isUpcoming = event && new Date(event.startDate) > new Date();
  const isOngoing = event && new Date(event.startDate) <= new Date() && new Date(event.endDate) >= new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Event not found</h2>
          <Link href="/events" className="text-blue-600 hover:underline">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Browse Events
          </Link>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${STATUS_CONFIG[event.status]?.color}`}>
                  {STATUS_CONFIG[event.status]?.label}
                </span>
                {isUpcoming && event.status === 'published' && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                    Upcoming
                  </span>
                )}
                {isOngoing && (
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-amber-100 text-amber-800">
                    Live Now
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{event.name}</h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">{EVENT_TYPE_LABELS[event.eventType]}</p>
              
              {/* Creator Badge - Informational Only */}
              {isCreator && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    You are the organizer of this event
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-400">•</span>
                  <Link href="/events/my-events" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                    Manage in My Created Events
                  </Link>
                </div>
              )}
            </div>
            
            {/* Primary Action - Register or View QR */}
            <div className="flex items-center gap-3">
              {isRegistered && (
                <>
                  <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-semibold text-green-900 dark:text-green-300">Registered</span>
                    </div>
                  </div>
                  <Link
                    href="/events/registrations"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-lg font-semibold shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    View QR Code
                  </Link>
                </>
              )}
              {canRegister && (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-lg font-semibold shadow-lg"
                >
                  {registering ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                  Register for Event
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Event Details Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Details */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Event Details</h2>
            
            {event.description && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h3>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Date & Time</p>
                  <p className="text-gray-900 dark:text-white">{formatDate(event.startDate)}</p>
                  {event.startDate !== event.endDate && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      to {formatDate(event.endDate)}
                    </p>
                  )}
                </div>
              </div>
              
              {event.venue && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Venue</p>
                    <p className="text-gray-900 dark:text-white">{event.venue}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Registration Fee</p>
                  <p className="text-gray-900 dark:text-white">
                    {event.paymentType === 'free' ? 'Free' : `₹${event.registrationFee}`}
                  </p>
                </div>
              </div>
              
              {(event.registrationStartDate || event.registrationEndDate) && (
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Registration Period</p>
                    {event.registrationStartDate && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        From: {formatDateShort(event.registrationStartDate)}
                      </p>
                    )}
                    {event.registrationEndDate && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Until: {formatDateShort(event.registrationEndDate)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Registration Stats</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Registrations</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {event.currentRegistrations}
                    </span>
                  </div>
                  {event.maxCapacity && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (event.currentRegistrations / event.maxCapacity) * 100)}%` }}
                      />
                    </div>
                  )}
                  {event.maxCapacity && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Capacity: {event.currentRegistrations} / {event.maxCapacity}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* User Registration Card - Show if registered */}
            {isRegistered && event.userRegistration && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border-2 border-green-200 dark:border-green-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-300">Your Registration</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Registration ID</p>
                    <p className="text-sm font-mono text-green-900 dark:text-green-300">{event.userRegistration.registrationId}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Status</p>
                    <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded">
                      {event.userRegistration.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div>
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Registered On</p>
                    <p className="text-sm text-green-900 dark:text-green-300">
                      {formatDateShort(event.userRegistration.registeredAt)}
                    </p>
                  </div>
                  
                  <Link
                    href="/events/registrations"
                    className="mt-4 block w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-center rounded-lg font-medium transition-colors"
                  >
                    View QR Code & Ticket
                  </Link>
                </div>
              </div>
            )}

            {event.createdBy && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Creator</h3>
                <p className="text-gray-900 dark:text-white font-medium">{event.createdBy.name}</p>
                {event.createdBy.email && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{event.createdBy.email}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Browse Events is for viewing and registering only - no management tools */}
      </div>
    </div>
  );
}
