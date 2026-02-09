'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Lock, 
  Unlock, 
  Save, 
  AlertCircle, 
  Calendar, 
  MapPin, 
  Users, 
  IndianRupee,
  Clock,
  FileText,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

export default function ManageEventPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Unlocked editable fields
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [maxCapacity, setMaxCapacity] = useState<number | ''>('');
  const [registrationFee, setRegistrationFee] = useState<number | ''>('');
  const [registrationStartDate, setRegistrationStartDate] = useState('');
  const [registrationEndDate, setRegistrationEndDate] = useState('');

  useEffect(() => {
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const data = await eventService.getEvent(eventId);
      setEvent(data);
      
      // Initialize form with current values
      setDescription(data.description || '');
      setVenue(data.venue || '');
      setMaxCapacity(data.maxCapacity || '');
      setRegistrationFee(data.registrationFee || '');
      setRegistrationStartDate(data.registrationStartDate?.split('T')[0] || '');
      setRegistrationEndDate(data.registrationEndDate?.split('T')[0] || '');
    } catch (error: any) {
      toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to load event'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!event) return;

    // Validation
    if (!venue.trim()) {
      toast({ type: 'error', message: 'Venue is required' });
      return;
    }

    if (maxCapacity && maxCapacity < 1) {
      toast({ type: 'error', message: 'Max capacity must be at least 1' });
      return;
    }

    if (event.paymentType === 'paid' && (!registrationFee || registrationFee < 1)) {
      toast({ type: 'error', message: 'Registration fee is required for paid events' });
      return;
    }

    if (registrationStartDate && registrationEndDate) {
      if (new Date(registrationEndDate) < new Date(registrationStartDate)) {
        toast({ type: 'error', message: 'Registration end date must be after start date' });
        return;
      }
    }

    try {
      setSaving(true);
      const updateData: any = {
        description: description.trim(),
        venue: venue.trim(),
        maxCapacity: maxCapacity ? Number(maxCapacity) : null,
      };

      if (event.paymentType === 'paid') {
        updateData.registrationFee = registrationFee ? Number(registrationFee) : null;
      }

      if (registrationStartDate) {
        updateData.registrationStartDate = registrationStartDate;
      }
      if (registrationEndDate) {
        updateData.registrationEndDate = registrationEndDate;
      }

      await eventService.updateEvent(eventId, updateData);
      toast({ type: 'success', message: 'Event updated successfully' });
      loadEvent(); // Reload to get updated data
    } catch (error: any) {
      toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to update event'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Event Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">The event you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    published: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    ongoing: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    completed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event Details
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Manage Event
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Update event details and configuration
              </p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusColors[event.status]}`}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                Important: Locked Fields from Noting
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Event name, type, dates, and payment type were set during noting approval and cannot be modified. 
                Only description, venue, capacity, and registration details can be updated.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Locked Fields - Read Only */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-6">
              <div className="bg-gradient-to-r from-red-500 to-pink-600 px-5 py-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Locked Fields
                </h3>
              </div>
              <div className="p-5 space-y-4">
                {/* Noting Reference */}
                {event.notingId && (
                  <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Created from Noting
                    </label>
                    <Link
                      href={`/noting/${event.notingId}`}
                      className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View Noting
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Event Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Event Name
                  </label>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {event.name}
                    </p>
                  </div>
                </div>

                {/* Event Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Event Type
                  </label>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-xs font-medium">
                      {event.eventType}
                    </span>
                  </div>
                </div>

                {/* Event Dates */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Event Dates
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Start</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {new Date(event.startDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">End</p>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {new Date(event.endDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Payment Type
                  </label>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-500 shrink-0" />
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      event.paymentType === 'free' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                    }`}>
                      {event.paymentType.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Event ID */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Event ID
                  </label>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {event.eventId}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Unlock className="w-4 h-4" />
                  Editable Fields
                </h3>
              </div>
              <div className="p-6 space-y-6">
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Event Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    placeholder="Provide a detailed description of the event..."
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This will be visible to attendees on the event page
                  </p>
                </div>

                {/* Venue */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Venue <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="e.g., Main Auditorium, Seminar Hall 1"
                      required
                    />
                  </div>
                </div>

                {/* Max Capacity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maximum Capacity
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(e.target.value ? Number(e.target.value) : '')}
                      min="1"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Maximum number of attendees allowed to register
                  </p>
                </div>

                {/* Registration Fee - Only for paid events */}
                {event.paymentType === 'paid' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Registration Fee <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        value={registrationFee}
                        onChange={(e) => setRegistrationFee(e.target.value ? Number(e.target.value) : '')}
                        min="1"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                        placeholder="Enter amount in INR"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Registration Period */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Registration Start Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        value={registrationStartDate}
                        onChange={(e) => setRegistrationStartDate(e.target.value)}
                        max={event.startDate.split('T')[0]}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Registration End Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        value={registrationEndDate}
                        onChange={(e) => setRegistrationEndDate(e.target.value)}
                        min={registrationStartDate}
                        max={event.startDate.split('T')[0]}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                  Define when attendees can register for the event. Leave empty to allow registration anytime.
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Changes
                      </>
                    )}
                  </button>
                  <Link
                    href={`/events/${eventId}`}
                    className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
