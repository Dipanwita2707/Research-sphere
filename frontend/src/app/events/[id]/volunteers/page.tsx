'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  UserPlus, 
  Trash2, 
  Shield, 
  QrCode, 
  MapPin,
  Loader2,
  AlertCircle,
  Search,
  Users,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, EventVolunteer } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  department?: string;
  uid?: string;
}

export default function VolunteersPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [volunteers, setVolunteers] = useState<EventVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Volunteer form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');
  const [volunteerRole, setVolunteerRole] = useState('');
  const [assignedGate, setAssignedGate] = useState('');
  const [canScanQr, setCanScanQr] = useState(false);

  useEffect(() => {
    loadEventAndVolunteers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const loadEventAndVolunteers = async () => {
    try {
      setLoading(true);
      const [eventData, volunteersData] = await Promise.all([
        eventService.getEvent(eventId),
        eventService.getVolunteers(eventId)
      ]);

      // ── Security: block users who cannot manage this event ──
      if (!(eventData as any).canManage) {
        toast({ type: 'error', message: 'You do not have permission to manage volunteers for this event' });
        router.replace('/events');
        return;
      }

      setEvent(eventData);
      setVolunteers(volunteersData);
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const results = await eventService.searchStudentsForVolunteer(query.trim());
      setSearchResults(results.map(r => ({
        id: r.id,
        name: r.name || r.uid || 'Unknown',
        email: r.email || '',
        department: r.department,
      })));
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUserId(user.id);
    setSelectedUserName(user.name);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAssignVolunteer = async () => {
    if (!selectedUserId) {
      toast({ type: 'error', message: 'Please select a user' });
      return;
    }

    if (!volunteerRole.trim()) {
      toast({ type: 'error', message: 'Please specify a role' });
      return;
    }

    try {
      setAssigning(true);
      await eventService.assignVolunteer(eventId, {
        userId: selectedUserId,
        role: volunteerRole.trim(),
        assignedGate: assignedGate.trim() || undefined,
        canScanQr
      });

      toast({ type: 'success', message: 'Volunteer assigned successfully' });
      
      // Reset form
      setSelectedUserId('');
      setSelectedUserName('');
      setVolunteerRole('');
      setAssignedGate('');
      setCanScanQr(false);
      
      // Reload volunteers
      loadEventAndVolunteers();
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error)
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveVolunteer = async (volunteerId: string) => {
    if (!confirm('Are you sure you want to remove this volunteer?')) {
      return;
    }

    try {
      await eventService.removeVolunteer(eventId, volunteerId);
      toast({ type: 'success', message: 'Volunteer removed successfully' });
      loadEventAndVolunteers();
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error)
      });
    }
  };

  const handleToggleQrPermission = async (volunteerId: string, currentStatus: boolean) => {
    try {
      await eventService.updateVolunteer(eventId, volunteerId, {
        canScanQr: !currentStatus
      });
      toast({ 
        type: 'success', 
        message: `QR scanning permission ${!currentStatus ? 'granted' : 'revoked'}` 
      });
      loadEventAndVolunteers();
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error)
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <CardSkeleton className="w-full max-w-sm mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading volunteers...</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
                Manage Volunteers
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {event.name}
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {volunteers.length}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Volunteers
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assign New Volunteer Form */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Assign Volunteer
                </h3>
              </div>
              <div className="p-5 space-y-4">
                {/* User Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Student <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Students only</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={selectedUserName || searchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        if (!val) {
                          setSelectedUserId('');
                          setSelectedUserName('');
                          setSearchResults([]);
                          if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                          return;
                        }
                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = setTimeout(() => handleSearchUsers(val), 300);
                      }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Search by UID, name or email..."
                      disabled={!!selectedUserId}
                    />
                    {selectedUserId && (
                      <button
                        onClick={() => {
                          setSelectedUserId('');
                          setSelectedUserName('');
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {searching && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                      <Skeleton className="w-5 h-5 rounded-full" />
                    </div>
                  )}
                  {searchResults.length > 0 && !selectedUserId && (
                    <div className="mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.name}
                            {user.uid && <span className="text-gray-500 font-normal ml-1">({user.uid})</span>}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {user.email}
                            {user.department && ` • ${user.department}`}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={volunteerRole}
                    onChange={(e) => setVolunteerRole(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="e.g., Entry Manager, Support Staff"
                  />
                </div>

                {/* Assigned Gate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assigned Gate
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={assignedGate}
                      onChange={(e) => setAssignedGate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="e.g., Gate A, Main Entry"
                    />
                  </div>
                </div>

                {/* QR Scanning Permission */}
                <div>
                  <label className="flex items-center gap-3 p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-all">
                    <input
                      type="checkbox"
                      checked={canScanQr}
                      onChange={(e) => setCanScanQr(e.target.checked)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                    />
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Allow QR Scanning
                      </span>
                    </div>
                  </label>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Grant permission to scan attendee QR codes
                  </p>
                </div>

                {/* Assign Button */}
                <button
                  onClick={handleAssignVolunteer}
                  disabled={assigning || !selectedUserId}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigning ? (
                    <>
                      <Skeleton className="w-5 h-5 rounded-full" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Assign Volunteer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Volunteers List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-5 py-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Current Volunteers ({volunteers.length})
                </h3>
              </div>
              <div className="p-5">
                {volunteers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      No volunteers assigned yet
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Assign volunteers using the form on the left
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {volunteers.map((volunteer) => (
                      <div
                        key={volunteer.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/events/${eventId}/volunteers/${volunteer.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && router.push(`/events/${eventId}/volunteers/${volunteer.id}`)}
                        className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {volunteer.user?.name || 'Unknown User'}
                              </h4>
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-full text-xs font-medium">
                                {volunteer.role}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                                View activity →
                              </span>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                              <p>{volunteer.user?.email || 'No email'}</p>
                              {volunteer.assignedGate && (
                                <p className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {volunteer.assignedGate}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleQrPermission(volunteer.id, volunteer.canScanQr); }}
                                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                    volunteer.canScanQr
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {volunteer.canScanQr ? (
                                    <>
                                      <CheckCircle className="w-3 h-3" />
                                      QR Scanning Enabled
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3" />
                                      QR Scanning Disabled
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveVolunteer(volunteer.id); }}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove volunteer"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
