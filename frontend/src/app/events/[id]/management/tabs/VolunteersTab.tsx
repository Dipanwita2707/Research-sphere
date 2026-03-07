'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Shield, QrCode, MapPin, UserPlus, Search, Loader2,
  XCircle, Plus, CheckCircle2, Eye, Trash2,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, EventVolunteer } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { CARD, CARD_HEADER } from './constants';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  department?: string;
  uid?: string;
}

// ── Props ────────────────────────────────────────────────────────
interface VolunteersTabProps {
  eventId: string;
  event: Event;
  volunteers: EventVolunteer[];
  onVolunteersChange: (volunteers: EventVolunteer[]) => void;
}

export default function VolunteersTab({
  eventId,
  event,
  volunteers,
  onVolunteersChange,
}: VolunteersTabProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ── Form state ─────────────────────────────────────────────────
  const [volunteerSearchQuery, setVolunteerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');
  const [volunteerRole, setVolunteerRole] = useState('');
  const [assignedGate, setAssignedGate] = useState('');
  const [canScanQr, setCanScanQr] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // ── Club Members ───────────────────────────────────────────────
  const [clubInfo, setClubInfo] = useState<{ id: string; clubId: string; name: string } | null>(null);
  const [clubMembers, setClubMembers] = useState<{ id: string; uid: string; email: string; name: string; alreadyAssigned: boolean }[]>([]);
  const [clubMembersLoading, setClubMembersLoading] = useState(false);

  const loadClubMembers = useCallback(async () => {
    if (!eventId) return;
    try {
      setClubMembersLoading(true);
      const data = await eventService.getClubMembers(eventId);
      setClubInfo(data.club);
      setClubMembers(data.members);
    } catch {
      setClubInfo(null);
      setClubMembers([]);
    } finally {
      setClubMembersLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if ((event as any).club) {
      loadClubMembers();
    }
  }, [event, loadClubMembers]);

  // ── Search ─────────────────────────────────────────────────────
  const handleSearchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) { setSearchResults([]); return; }
    try {
      setSearching(true);
      const results = await eventService.searchStudentsForVolunteer(query.trim());
      setSearchResults(results.map(r => ({
        id: r.id,
        name: r.name || r.uid || 'Unknown',
        email: r.email || '',
        department: r.department,
        uid: r.uid,
      })));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUserId(user.id);
    setSelectedUserName(user.name);
    setVolunteerSearchQuery('');
    setSearchResults([]);
  };

  // ── Assign ─────────────────────────────────────────────────────
  const handleAssignVolunteer = async () => {
    if (!selectedUserId) { toast({ type: 'error', message: 'Please select a user' }); return; }
    if (!volunteerRole.trim()) { toast({ type: 'error', message: 'Please specify a role' }); return; }
    try {
      setAssigning(true);
      await eventService.assignVolunteer(eventId, {
        userId: selectedUserId,
        role: volunteerRole.trim(),
        assignedGate: assignedGate.trim() || undefined,
        canScanQr,
      });
      toast({ type: 'success', message: 'Volunteer assigned successfully' });
      setSelectedUserId('');
      setSelectedUserName('');
      setVolunteerRole('');
      setAssignedGate('');
      setCanScanQr(false);
      const updated = await eventService.getVolunteers(eventId);
      onVolunteersChange(updated);
      if (clubInfo) loadClubMembers();
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setAssigning(false);
    }
  };

  // ── Remove / Toggle ────────────────────────────────────────────
  const handleRemoveVolunteer = async (volunteerId: string) => {
    if (!confirm('Are you sure you want to remove this volunteer?')) return;
    try {
      await eventService.removeVolunteer(eventId, volunteerId);
      toast({ type: 'success', message: 'Volunteer removed successfully' });
      const updated = await eventService.getVolunteers(eventId);
      onVolunteersChange(updated);
      if (clubInfo) loadClubMembers();
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    }
  };

  const handleToggleQrPermission = async (volunteerId: string, currentStatus: boolean) => {
    try {
      await eventService.updateVolunteer(eventId, volunteerId, { canScanQr: !currentStatus });
      toast({ type: 'success', message: `QR scanning permission ${!currentStatus ? 'granted' : 'revoked'}` });
      const updated = await eventService.getVolunteers(eventId);
      onVolunteersChange(updated);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column — Form */}
      <div className="lg:col-span-1 space-y-4">
        {/* Club Members Quick Pick */}
        {clubInfo && (
          <div className={`${CARD} overflow-hidden`}>
            <div className={CARD_HEADER}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                {clubInfo.name} Members
                <span className="ml-auto text-xs font-normal px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-full">
                  Quick pick
                </span>
              </h3>
            </div>
            <div className="p-3">
              {clubMembersLoading ? (
                <div className="flex items-center justify-center py-5">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span className="ml-2 text-sm text-gray-500">Loading…</span>
                </div>
              ) : clubMembers.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">No active club members found</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {clubMembers.map((member) => (
                    <button
                      key={member.id}
                      disabled={member.alreadyAssigned}
                      onClick={() => {
                        if (!member.alreadyAssigned) {
                          setSelectedUserId(member.id);
                          setSelectedUserName(member.name);
                          setVolunteerSearchQuery('');
                          setSearchResults([]);
                        }
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        member.alreadyAssigned
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50 cursor-not-allowed'
                          : selectedUserId === member.id
                            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600 ring-1 ring-emerald-400'
                            : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        selectedUserId === member.id
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {member.name}
                          {member.uid && <span className="text-gray-400 font-normal ml-1">· {member.uid}</span>}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {member.alreadyAssigned ? (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full">Added</span>
                        ) : selectedUserId === member.id ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Plus className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assign Volunteer Form */}
        <div className={`${CARD} overflow-hidden sticky top-24`}>
          <div className={CARD_HEADER}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-sgt-500" />
              Assign Volunteer
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Student picker */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                {clubInfo ? 'Search any student' : 'Student'} <span className="text-red-500 normal-case">*</span>
              </label>
              {selectedUserId ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-sgt-50 dark:bg-sgt-900/20 border border-sgt-300 dark:border-sgt-700 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-sgt-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {selectedUserName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{selectedUserName}</span>
                  <button onClick={() => { setSelectedUserId(''); setSelectedUserName(''); }} className="text-gray-400 hover:text-red-500 transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={volunteerSearchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVolunteerSearchQuery(val);
                        if (!val) { setSearchResults([]); if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); return; }
                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                        searchDebounceRef.current = setTimeout(() => handleSearchUsers(val), 300);
                      }}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                      placeholder="Search by UID, name or email…"
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-sgt-500" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border-b border-gray-100 dark:border-gray-600 last:border-b-0 flex items-center gap-2.5"
                        >
                          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.name}{user.uid && <span className="text-gray-400 font-normal ml-1">· {user.uid}</span>}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.email}{user.department && ` · ${user.department}`}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Role <span className="text-red-500 normal-case">*</span>
              </label>
              <input
                type="text"
                value={volunteerRole}
                onChange={(e) => setVolunteerRole(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                placeholder="e.g. Entry Manager, Support Staff"
              />
            </div>

            {/* Assigned Gate */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Assigned Gate <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={assignedGate}
                  onChange={(e) => setAssignedGate(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                  placeholder="e.g. Gate A, Main Entry"
                />
              </div>
            </div>

            {/* QR Permission */}
            <label className="flex items-center gap-3 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-sgt-400 dark:hover:border-sgt-500 hover:bg-sgt-50/40 dark:hover:bg-sgt-900/10 transition-all">
              <input
                type="checkbox"
                checked={canScanQr}
                onChange={(e) => setCanScanQr(e.target.checked)}
                className="w-4 h-4 text-sgt-600 focus:ring-sgt-500 rounded"
              />
              <QrCode className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Allow QR Scanning</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Can scan attendee entry/exit QR codes</p>
              </div>
            </label>

            {/* Assign Button */}
            <button
              onClick={handleAssignVolunteer}
              disabled={assigning || !selectedUserId || !volunteerRole.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sgt-600 hover:bg-sgt-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assigning ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Assigning…</>
              ) : (
                <><UserPlus className="w-4 h-4" />Assign Volunteer</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column — Volunteers List */}
      <div className="lg:col-span-2">
        <div className={CARD}>
          <div className={`${CARD_HEADER} flex items-center justify-between gap-3`}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-sgt-500" />
              Volunteers
              <span className="px-2 py-0.5 text-xs font-semibold bg-sgt-100 dark:bg-sgt-900/30 text-sgt-700 dark:text-sgt-300 rounded-full">
                {volunteers.length}
              </span>
            </h3>
            {volunteers.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                  {volunteers.filter(v => v.canScanQr).length} QR enabled
                </span>
                {volunteers.some(v => v.assignedGate) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    {volunteers.filter(v => v.assignedGate).length} gated
                  </span>
                )}
              </div>
            )}
          </div>

          {volunteers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No volunteers yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Use the form on the left to assign your first volunteer.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {volunteers.map((volunteer) => {
                const initials = (volunteer.user?.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                const isManager = volunteer.role === 'event_manager';
                return (
                  <div key={volunteer.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors group">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      isManager
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-sgt-100 dark:bg-sgt-900/30 text-sgt-700 dark:text-sgt-300'
                    }`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{volunteer.user?.name || 'Unknown'}</span>
                        {volunteer.user?.uid && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{volunteer.user.uid}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          isManager
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-sgt-100 text-sgt-700 dark:bg-sgt-900/30 dark:text-sgt-300'
                        }`}>
                          {isManager ? '👑 Manager' : volunteer.role || 'Volunteer'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                        <span className="truncate">{volunteer.user?.email || '—'}</span>
                        {volunteer.assignedGate && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <MapPin className="w-3 h-3" />{volunteer.assignedGate}
                          </span>
                        )}
                        {volunteer.assignedAt && (
                          <span className="text-gray-400 dark:text-gray-500">
                            Added {new Date(volunteer.assignedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleQrPermission(volunteer.id, volunteer.canScanQr); }}
                        title={volunteer.canScanQr ? 'Disable QR scanning' : 'Enable QR scanning'}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          volunteer.canScanQr
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        {volunteer.canScanQr ? 'QR On' : 'QR Off'}
                      </button>
                      <button
                        onClick={() => router.push(`/events/${eventId}/volunteers/${volunteer.id}`)}
                        title="View activity log"
                        className="p-1.5 text-gray-400 hover:text-sgt-600 dark:hover:text-sgt-400 hover:bg-sgt-50 dark:hover:bg-sgt-900/20 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!isManager && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveVolunteer(volunteer.id); }}
                          title="Remove volunteer"
                          className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
