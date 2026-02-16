'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Shield,
  Calendar,
  MapPin,
  Clock,
  Users,
  QrCode,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Search,
  Filter,
  History,
  Radio,
  Tag,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';

interface VolunteerAssignment {
  id: string;
  eventId: string;
  role?: string;
  canScanQr: boolean;
  assignedGate?: string;
  assignedAt: string;
  event: {
    id: string;
    eventId: string;
    name: string;
    eventType: string;
    description?: string;
    startDate: string;
    endDate: string;
    venue?: string;
    status: string;
    bannerImageUrl?: string;
    currentRegistrations: number;
    maxCapacity?: number;
  } | null;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  seminar: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  workshop: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  fest: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  conference: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  competition: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  cultural: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  technical: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  sports: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  published: { label: 'Published', color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  ongoing: { label: 'Live Now', color: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  completed: { label: 'Completed', color: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-500' },
  cancelled: { label: 'Cancelled', color: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
};

export default function VolunteerDashboardPage() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<VolunteerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const data = await eventService.getMyVolunteerAssignments();
        setAssignments(data);
      } catch (error: any) {
        toast({ type: 'error', message: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (!a.event) return false;
      const matchesSearch =
        !search ||
        a.event.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.event.venue && a.event.venue.toLowerCase().includes(search.toLowerCase())) ||
        (a.role && a.role.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || a.event.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assignments, search, statusFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const active = assignments.filter(
      (a) => a.event && (a.event.status === 'published' || a.event.status === 'ongoing')
    ).length;
    const upcoming = assignments.filter(
      (a) => a.event && new Date(a.event.startDate) > now
    ).length;
    const completed = assignments.filter(
      (a) => a.event && a.event.status === 'completed'
    ).length;
    return { total: assignments.length, active, upcoming, completed };
  }, [assignments]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventStatus = (event: VolunteerAssignment['event']) => {
    if (!event) return 'draft';
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    if (event.status === 'completed' || event.status === 'cancelled') return event.status;
    if (now >= start && now <= end) return 'ongoing';
    return event.status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading your volunteer duties..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-gradient-to-br from-sgt-600 to-blue-600 rounded-xl">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Volunteer Dashboard</h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your volunteer assignments, scan QR codes, and track your activity
              </p>
            </div>
            <Link
              href="/events/volunteer/activity"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sgt-600 to-blue-600 text-white rounded-lg hover:from-sgt-700 hover:to-blue-700 transition-all font-medium shadow-sm"
            >
              <History className="h-4 w-4" />
              Activity History
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Assigned', value: stats.total, icon: Shield, color: 'from-blue-500 to-blue-600' },
            { label: 'Active Events', value: stats.active, icon: Radio, color: 'from-green-500 to-green-600' },
            { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'from-amber-500 to-amber-600' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'from-gray-500 to-gray-600' },
          ].map((stat) => (
            <div key={stat.label} className={CARD + ' p-4'}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event name, venue, or your role..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-600 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Assignments Grid */}
        {filteredAssignments.length === 0 ? (
          <div className={CARD + ' p-12 text-center'}>
            {assignments.length === 0 ? (
              <>
                <Shield className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Volunteer Assignments Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-4">
                  You haven&apos;t been assigned as a volunteer for any events yet. Event organizers can assign you as a volunteer from their event management panel.
                </p>
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sgt-600 text-white rounded-lg hover:bg-sgt-700 transition"
                >
                  Browse Events
                </Link>
              </>
            ) : (
              <>
                <Filter className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  No matching assignments
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Try adjusting your search or filter criteria
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredAssignments.map((assignment) => {
              if (!assignment.event) return null;
              const eventStatus = getEventStatus(assignment.event);
              const statusConf = STATUS_CONFIG[eventStatus] || STATUS_CONFIG.draft;
              const isLive = eventStatus === 'ongoing';
              const isUpcoming = new Date(assignment.event.startDate) > new Date();
              const capacityPercent = assignment.event.maxCapacity
                ? Math.round((assignment.event.currentRegistrations / assignment.event.maxCapacity) * 100)
                : null;

              return (
                <Link
                  key={assignment.id}
                  href={`/events/volunteer/${assignment.event.id}`}
                  className={`${CARD} hover:shadow-sgt-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden group`}
                >
                  {/* Color bar */}
                  <div className={`h-1.5 w-full ${isLive ? 'bg-gradient-to-r from-green-500 to-emerald-500' : isUpcoming ? 'bg-gradient-to-r from-sgt-600 to-blue-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'}`} />
                  
                  <div className="p-5">
                    {/* Status + Type */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusConf.dot} ${isLive ? 'animate-pulse' : ''}`} />
                        <span className={`text-xs font-semibold ${statusConf.color}`}>{statusConf.label}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${EVENT_TYPE_COLORS[assignment.event.eventType] || EVENT_TYPE_COLORS.other}`}>
                        {assignment.event.eventType.charAt(0).toUpperCase() + assignment.event.eventType.slice(1)}
                      </span>
                    </div>

                    {/* Event Name */}
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 line-clamp-2 group-hover:text-sgt-600 dark:group-hover:text-blue-400 transition-colors">
                      {assignment.event.name}
                    </h3>

                    {/* Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span>
                          {formatDate(assignment.event.startDate)} at {formatTime(assignment.event.startDate)}
                        </span>
                      </div>
                      {assignment.event.venue && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          <span className="line-clamp-1">{assignment.event.venue}</span>
                        </div>
                      )}
                      {capacityPercent !== null && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Users className="h-4 w-4 flex-shrink-0 text-gray-400" />
                          <span>
                            {assignment.event.currentRegistrations}/{assignment.event.maxCapacity} registered ({capacityPercent}%)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Volunteer Info */}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {assignment.role && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-sgt-100 dark:bg-sgt-900/30 text-sgt-700 dark:text-sgt-300 rounded-full">
                              <Tag className="h-3 w-3" />
                              {assignment.role}
                            </span>
                          )}
                          {assignment.canScanQr && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                              <QrCode className="h-3 w-3" />
                              Scanner
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-sgt-600 dark:group-hover:text-blue-400 transition-colors" />
                      </div>
                      {assignment.assignedGate && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          Gate: {assignment.assignedGate}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
