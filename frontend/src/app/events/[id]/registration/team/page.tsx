'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, UserPlus, Search, X, Send, Clock,
  AlertCircle, CheckCircle2, XCircle, Loader2, Plus, Trash2,
  Crown, Mail, Info, Eye, ExternalLink, UserMinus, Bell, ArrowRight
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type {
  EventTeam,
  TeamMember,
  TeamInvitation,
  TeamRequest,
  SearchableUser,
  TeamSearchResult
} from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

type TabType = 'create' | 'join';
type SectionType = 'invitations' | 'requests';

interface MemberCardProps {
  member?: TeamMember;
  searchUser?: SearchableUser;
  isLeader?: boolean;
  showRemove?: boolean;
  onRemove?: () => void;
  onInvite?: () => void;
  status?: 'verified' | 'pending' | 'not_added';
  variant?: 'team' | 'search';
}

const MemberCard: React.FC<MemberCardProps> = ({
  member,
  searchUser,
  isLeader,
  showRemove,
  onRemove,
  onInvite,
  status,
  variant = 'team'
}) => {
  const user = member?.user || searchUser;
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`
    : (searchUser?.name || member?.name || 'Unknown');
  const initials = user?.firstName?.[0]
    ? `${user.firstName[0]}${user.lastName?.[0] || ''}`
    : displayName.split(' ').map(n => n[0]).join('').slice(0, 2);

  const getStatusBadge = () => {
    if (isLeader) {
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
          <Crown className="w-3.5 h-3.5" />
          Leader
        </span>
      );
    }

    const memberStatus = status || member?.status;
    if (memberStatus === 'confirmed' || memberStatus === 'verified') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
          <CheckCircle2 className="w-3 h-3" />
          Verified
        </span>
      );
    }
    if (memberStatus === 'pending') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
    return null;
  };

  return (
    <div className="group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner ${isLeader
          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
          {initials.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {displayName}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {user?.email || searchUser?.email}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {getStatusBadge()}

        {variant === 'search' && onInvite && (
          <button
            onClick={onInvite}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            Invite
          </button>
        )}

        {showRemove && onRemove && (
          <button
            onClick={onRemove}
            className="p-2 text-gray-400 hover:text-red-600 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
            title="Remove member"
          >
            <UserMinus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

interface InvitationCardProps {
  invitation: TeamInvitation;
  type: 'sent' | 'received';
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  type,
  onAccept,
  onDecline,
  onCancel
}) => {
  const user = type === 'sent' ? invitation.invitee : invitation.inviter;

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${type === 'sent'
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
          }`}>
          {user?.firstName?.[0]}{user?.lastName?.[0] || ''}
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {type === 'sent'
              ? `${user?.firstName} ${user?.lastName}`
              : `${user?.firstName} ${user?.lastName}`
            }
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
            {type === 'sent' ? 'Invited to team' : 'Invited you to join'}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {invitation.team?.name}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {invitation.status === 'pending' && type === 'received' && (
          <>
            <button
              onClick={onAccept}
              className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Accept
            </button>
            <button
              onClick={onDecline}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all"
            >
              Decline
            </button>
          </>
        )}

        {invitation.status === 'pending' && type === 'sent' && onCancel && (
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Cancel invitation"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {invitation.status !== 'pending' && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${invitation.status === 'accepted'
            ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
            : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
            }`}>
            {invitation.status === 'accepted' ? 'Accepted' : 'Declined'}
          </span>
        )}
      </div>
    </div>
  );
};

interface TeamCardProps {
  team: TeamSearchResult;
  onRequestJoin: () => void;
  hasRequested?: boolean;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onRequestJoin, hasRequested }) => {
  const leaderName = team.leader?.firstName
    ? `${team.leader.firstName} ${team.leader.lastName || ''}`
    : team.leader?.name || 'Unknown Leader';

  return (
    <div className="group flex flex-col p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-blue-600 transition-colors">
            {team.name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700/50">
              <Users className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {(typeof team.memberCount === 'object' ? (team.memberCount as any).current : team.memberCount)}
                {team.maxSize ? `/${team.maxSize}` : (typeof team.memberCount === 'object' && (team.memberCount as any).max ? `/${(team.memberCount as any).max}` : '')} Members
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center border border-amber-200 dark:border-amber-900/50">
          <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Team Leader</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {leaderName}
          </p>
        </div>
      </div>

      <button
        onClick={onRequestJoin}
        disabled={hasRequested}
        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${hasRequested
          ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed border border-dashed border-gray-300 dark:border-gray-600'
          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-600 hover:border-blue-600 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-500 active:bg-blue-50'
          }`}
      >
        {hasRequested ? (
          <span className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Request Pending
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            Request to Join
          </span>
        )}
      </button>
    </div>
  );
};

export default function TeamManagementPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('create');
  const [activeSection, setActiveSection] = useState<SectionType>('invitations');

  // Team state
  const [myTeam, setMyTeam] = useState<EventTeam | null>(null);
  const [teamName, setTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [finalizingTeam, setFinalizingTeam] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchableUser[]>([]);
  const [searching, setSearching] = useState(false);

  // Teams looking for members
  const [availableTeams, setAvailableTeams] = useState<TeamSearchResult[]>([]);
  const [teamsSearchQuery, setTeamsSearchQuery] = useState('');

  // Invitations & Requests
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<TeamInvitation[]>([]);
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<TeamRequest[]>([]);

  // Event settings
  const [eventSettings, setEventSettings] = useState<{
    minTeamSize: number;
    maxTeamSize: number;
    teamRegistrationDeadline?: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load team details if user has one
      try {
        const team = await eventService.getTeamDetails(eventId);
        if (team) {
          setMyTeam(team);
          setTeamName(team.name);
          
          // Set event settings from team data
          if (team.event) {
            setEventSettings({
              minTeamSize: team.event.minTeamSize || 1,
              maxTeamSize: team.event.maxTeamSize || 4,
              teamRegistrationDeadline: team.event.teamRegistrationDeadline,
            });
          }
        }
      } catch (e) {
        // User doesn't have a team yet
      }

      // Load invitations
      try {
        const invitationsData = await eventService.getMyInvitations(eventId);
        setInvitations(invitationsData.received || []);
        setSentInvitations(invitationsData.sent || []);
      } catch (e) {
        console.error('Failed to load invitations', e);
      }

      // Load requests
      try {
        const requestsData = await eventService.getMyRequests(eventId);
        setRequests(requestsData.received || []);
        setSentRequests(requestsData.sent || []);
      } catch (e) {
        console.error('Failed to load requests', e);
      }

      // Load available teams
      try {
        const teams = await eventService.getTeamsLookingForMembers(eventId);
        setAvailableTeams(teams);
      } catch (e) {
        console.error('Failed to load available teams', e);
      }

    } catch (error: any) {
      toast({ type: 'error', message: 'Failed to load team data' });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast({ type: 'error', message: 'Please enter a team name' });
      return;
    }

    setCreatingTeam(true);
    try {
      const team = await eventService.createTeam(eventId, teamName);
      setMyTeam(team);
      toast({ type: 'success', message: 'Team created successfully!' });
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to create team' });
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return;
    }

    setSearching(true);
    try {
      const results = await eventService.searchUsersToInvite(eventId, searchQuery);
      setSearchResults(results);
    } catch (error: any) {
      toast({ type: 'error', message: 'Failed to search users' });
    } finally {
      setSearching(false);
    }
  };

  const handleInviteUser = async (userId: string) => {
    try {
      await eventService.inviteToTeam(eventId, myTeam!.id, userId);
      toast({ type: 'success', message: 'Invitation sent!' });

      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.id !== userId));

      // Refresh sent invitations
      const invitationsData = await eventService.getMyInvitations(eventId);
      setSentInvitations(invitationsData.sent || []);
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to send invitation' });
    }
  };

  const handleRespondToInvitation = async (invitationId: string, accept: boolean) => {
    try {
      await eventService.respondToInvitation(eventId, invitationId, accept);
      toast({ type: 'success', message: accept ? 'Invitation accepted!' : 'Invitation declined' });
      loadData();
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to respond to invitation' });
    }
  };

  const handleRequestJoinTeam = async (teamId: string) => {
    try {
      await eventService.requestToJoinTeam(eventId, teamId);
      toast({ type: 'success', message: 'Join request sent!' });

      // Refresh sent requests
      const requestsData = await eventService.getMyRequests(eventId);
      setSentRequests(requestsData.sent || []);
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to send request' });
    }
  };

  const handleRespondToRequest = async (requestId: string, accept: boolean) => {
    try {
      await eventService.respondToJoinRequest(eventId, requestId, accept);
      toast({ type: 'success', message: accept ? 'Request accepted!' : 'Request declined' });
      loadData();
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to respond to request' });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!myTeam) return;

    try {
      await eventService.removeMemberFromTeam(eventId, myTeam.id, memberId);
      toast({ type: 'success', message: 'Member removed from team' });
      loadData();
    } catch (error: any) {
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to remove member' });
    }
  };

  const handleFinalizeRegistration = async () => {
    if (!myTeam) return;

    // Double-check minimum requirements before submitting
    const currentMembers = myTeam.memberCount?.current || myTeam.members?.length || 0;
    const minRequired = myTeam.memberCount?.min || myTeam.event?.minTeamSize || eventSettings?.minTeamSize || 1;

    console.log('Finalize Check:', {
      currentMembers,
      minRequired,
      teamId: myTeam.teamId,
      members: myTeam.members,
      memberCount: myTeam.memberCount,
    });

    if (currentMembers < minRequired) {
      toast({ 
        type: 'error', 
        message: `Need at least ${minRequired} member(s). Currently ${currentMembers} member(s) in team.` 
      });
      return;
    }

    setFinalizingTeam(true);
    try {
      await eventService.finalizeTeamRegistration(eventId, myTeam.teamId);
      toast({ type: 'success', message: 'Registration completed successfully!' });
      
      // Reload team data to get updated status
      await loadData();
      
      // Navigate back to event page
      setTimeout(() => {
        router.push(`/events/${eventId}`);
      }, 1500);
    } catch (error: any) {
      console.error('Finalize error:', error);
      toast({ type: 'error', message: error.response?.data?.message || 'Failed to finalize registration' });
    } finally {
      setFinalizingTeam(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">Loading team data...</p>
      </div>
    );
  }

  const pendingInvitationsCount = invitations.filter(i => i.status === 'pending').length;
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <Link
              href={`/events/${eventId}/registration`}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors mb-3 group"
            >
              <div className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group-hover:border-blue-200 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
              Back to Personal Info
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Team Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
              {myTeam ? 'Manage your team members and settings.' : 'Create a new team or join an existing one to participate.'}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-2 pl-6 rounded-2xl border border-gray-200/60 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold text-white">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <span className="font-medium text-sm text-gray-900 dark:text-white">Personal Info</span>
            </div>
            <div className="w-8 h-[2px] bg-green-500 rounded-full" />
            <div className={`flex items-center gap-3 pr-4 py-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800`}>
              <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">2</span>
              <span className="font-semibold text-sm">Team Setup</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Main Content - Left Side (8 cols) */}
          <div className="lg:col-span-8 space-y-8">

            {/* Tab Switcher */}
            <div className="bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex gap-1">
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'create'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <Users className="w-4 h-4" />
                My Team / Create
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'join'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <UserPlus className="w-4 h-4" />
                Join Existing Team
              </button>
            </div>

            {/* Create Team Tab Content */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                {!myTeam ? (
                  // Empty State - Create Team Form
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden p-8 text-center">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600 dark:text-blue-400">
                      <Plus className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Start a New Team</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                      Create a team and invite your friends to participate together. You'll be the team leader.
                    </p>

                    <div className="max-w-md mx-auto space-y-4">
                      <div className="text-left">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                          Team Name
                        </label>
                        <input
                          type="text"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none shadow-sm"
                          placeholder="e.g. The Code Warriors"
                        />
                      </div>

                      <button
                        onClick={handleCreateTeam}
                        disabled={creatingTeam || !teamName.trim()}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creatingTeam ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating Team...
                          </>
                        ) : (
                          <>
                            Create Team
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Team Management View
                  <div className="space-y-6">
                    {/* Team Header Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200 dark:shadow-none">
                            {myTeam.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{myTeam.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                                <Crown className="w-3 h-3" />
                                {myTeam.members?.find(m => m.role === 'leader')?.user?.firstName || 'Leader'}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                • Created Just Now
                              </span>
                            </div>
                          </div>
                        </div>

                      {/* Team Status & Actions */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {myTeam.memberCount?.current || myTeam.members?.length || 1}{' '}
                            <span className="text-gray-400 font-normal">
                              / {myTeam.memberCount?.max || myTeam.event?.maxTeamSize || eventSettings?.maxTeamSize || 4}
                            </span>
                          </span>
                        </div>

                        {/* Complete Registration Button - Show when minimum requirements are met but team not finalized */}
                        {myTeam.isLeader && !myTeam.isComplete && 
                         (myTeam.meetsMinimumRequirement !== undefined 
                          ? myTeam.meetsMinimumRequirement 
                          : (myTeam.memberCount?.current || myTeam.members?.length || 0) >= (myTeam.memberCount?.min || myTeam.event?.minTeamSize || eventSettings?.minTeamSize || 1)
                         ) && (
                          <button
                            onClick={handleFinalizeRegistration}
                            disabled={finalizingTeam}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                          >
                            {finalizingTeam ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Completing...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                Complete Registration
                              </>
                            )}
                          </button>
                        )}

                        {/* Completed Badge - Show when team is finalized */}
                        {myTeam.isComplete && (
                          <div className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                              Completed
                            </span>
                          </div>
                        )}
                        </div>
                      </div>

                      {/* Info Banner - Ready to Complete */}
                      {myTeam.isLeader && !myTeam.isComplete && 
                       (myTeam.memberCount?.current || myTeam.members?.length || 1) >= (myTeam.memberCount?.min || myTeam.event?.minTeamSize || eventSettings?.minTeamSize || 1) && (
                        <div className="mx-6 mb-4 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
                          <Info className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                              Ready to Complete Registration
                            </h4>
                            <p className="text-xs text-green-700 dark:text-green-300">
                              Your team meets the minimum requirements ({myTeam.memberCount?.min || myTeam.event?.minTeamSize || eventSettings?.minTeamSize || 1} member(s)). 
                              You can complete the registration now or add more members (up to {myTeam.memberCount?.max || myTeam.event?.maxTeamSize || eventSettings?.maxTeamSize || 4}) before submitting.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Members List */}
                      <div className="p-6">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                          Team Members
                          <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            {myTeam.members?.length}
                          </span>
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                          {myTeam.members?.map((member) => (
                            <MemberCard
                              key={member.id}
                              member={member}
                              isLeader={member.role === 'leader'}
                              showRemove={member.role !== 'leader'}
                              onRemove={() => handleRemoveMember(member.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Invite Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden p-6">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                        Invite New Members
                      </h3>

                      <div className="flex gap-3 mb-6">
                        <div className="relative flex-1 group">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all font-medium"
                            placeholder="Search by name or email..."
                          />
                        </div>
                        <button
                          onClick={handleSearchUsers}
                          disabled={searching || !searchQuery.trim()}
                          className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                        </button>
                      </div>

                      {searchResults.length > 0 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
                          {searchResults.map((user) => (
                            <MemberCard
                              key={user.id}
                              searchUser={user}
                              variant="search"
                              onInvite={() => handleInviteUser(user.id)}
                            />
                          ))}
                        </div>
                      )}

                      {searchQuery && searchResults.length === 0 && !searching && (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No users found matching &ldquo;{searchQuery}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Join Team Tab Content */}
            {activeTab === 'join' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm min-h-[400px]">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Available Teams</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Find a team that is looking for members.
                    </p>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={teamsSearchQuery}
                      onChange={(e) => setTeamsSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                      placeholder="Filter teams..."
                    />
                  </div>
                </div>

                <div className="p-6">
                  {/* Teams Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {availableTeams
                      .filter(t => !teamsSearchQuery || t.name.toLowerCase().includes(teamsSearchQuery.toLowerCase()))
                      .map((team) => (
                        <TeamCard
                          key={team.id}
                          team={team}
                          onRequestJoin={() => handleRequestJoinTeam(team.id)}
                          hasRequested={sentRequests.some(r => r.teamId === team.id && r.status === 'pending')}
                        />
                      ))}
                  </div>

                  {availableTeams.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No teams found</h3>
                      <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                        There are currently no teams actively looking for members. You can try searching again later or create your own team.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Right Side (4 cols) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">

            {/* Finalize Action Card */}
            {myTeam && (
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-lg shadow-green-200 dark:shadow-none text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-20">
                  <CheckCircle2 className="w-40 h-40" />
                </div>
                <h3 className="text-lg font-bold mb-2 relative z-10">Ready to go?</h3>
                <p className="text-green-50 text-sm mb-6 relative z-10 opacity-90">
                  Once your team is ready, complete your registration to secure your spot in the event.
                </p>
                <button
                  onClick={handleFinalizeRegistration}
                  className="w-full py-3 bg-white text-emerald-700 rounded-xl font-bold hover:bg-green-50 active:translate-y-[1px] transition-all flex items-center justify-center gap-2 shadow-sm relative z-10"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Registration
                </button>
              </div>
            )}

            {/* Notifications Panel */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="p-1.5 flex gap-1 border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setActiveSection('invitations')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors relative ${activeSection === 'invitations'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  Invitations
                  {pendingInvitationsCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full inline-block align-middle mb-0.5">
                      {pendingInvitationsCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveSection('requests')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors relative ${activeSection === 'requests'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  Requests
                  {pendingRequestsCount > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full inline-block align-middle mb-0.5">
                      {pendingRequestsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Content Area */}
              <div className="p-4 min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
                {activeSection === 'invitations' && (
                  <div className="space-y-6">
                    {/* Received Invitations */}
                    {invitations.filter(i => i.status === 'pending').length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Inbound
                        </p>
                        {invitations.filter(i => i.status === 'pending').map((inv) => (
                          <InvitationCard
                            key={inv.id}
                            invitation={inv}
                            type="received"
                            onAccept={() => handleRespondToInvitation(inv.id, true)}
                            onDecline={() => handleRespondToInvitation(inv.id, false)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Sent Invitations */}
                    {sentInvitations.filter(i => i.status === 'pending').length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          Outbound (Sent)
                        </p>
                        {sentInvitations.filter(i => i.status === 'pending').map((inv) => (
                          <InvitationCard
                            key={inv.id}
                            invitation={inv}
                            type="sent"
                            onCancel={() => {
                              // Assuming there's a cancel function or we pass null if not supported yet
                              // Based on props it seems supported
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {invitations.length === 0 && sentInvitations.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-48 text-center opacity-60">
                        <Mail className="w-10 h-10 text-gray-300 mb-2" />
                        <p className="text-sm font-medium text-gray-500">No active invitations</p>
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'requests' && (
                  <div className="space-y-6">
                    {/* Received Requests */}
                    {requests.filter(r => r.status === 'pending').length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Needs Approval
                        </p>
                        {requests.filter(r => r.status === 'pending').map((req) => {
                          const requester = req.requester || req.user;
                          const displayName = requester?.firstName
                            ? `${requester.firstName} ${requester.lastName || ''}`
                            : 'Unknown User';
                          const initials = requester?.firstName?.[0]
                            ? `${requester.firstName[0]}${requester.lastName?.[0] || ''}`
                            : 'U';

                          return (
                            <div key={req.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                  {initials.toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{displayName}</p>
                                  <p className="text-[10px] text-gray-500">Requests to join</p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleRespondToRequest(req.id, true)}
                                  className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRespondToRequest(req.id, false)}
                                  className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Sent Requests */}
                    {sentRequests.filter(r => r.status === 'pending').length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Pending Approval
                        </p>
                        {sentRequests.filter(r => r.status === 'pending').map((req) => (
                          <div key={req.id} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between opacity-80">
                            <div>
                              <p className="text-xs font-semibold text-gray-900 dark:text-white">Joining {req.team?.name}</p>
                              <p className="text-[10px] text-amber-500 font-medium">Waiting for leader</p>
                            </div>
                            <Clock className="w-4 h-4 text-amber-400" />
                          </div>
                        ))}
                      </div>
                    )}

                    {requests.length === 0 && sentRequests.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-48 text-center opacity-60">
                        <UserPlus className="w-10 h-10 text-gray-300 mb-2" />
                        <p className="text-sm font-medium text-gray-500">No active requests</p>
                      </div>
                    )}
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
