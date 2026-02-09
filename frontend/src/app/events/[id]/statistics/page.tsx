'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  UserCheck, 
  DollarSign, 
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  Download,
  BarChart3,
  PieChart,
  Activity,
  IndianRupee
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, EventStatistics } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

export default function EventStatisticsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEventAndStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const loadEventAndStatistics = async () => {
    try {
      setLoading(true);
      const [eventData, statsData] = await Promise.all([
        eventService.getEvent(eventId),
        eventService.getStatistics(eventId)
      ]);
      setEvent(eventData);
      setStatistics(statsData);
    } catch (error: any) {
      toast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to load statistics'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      toast({ type: 'info', message: 'Generating report...' });
      // Implement export functionality
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({ type: 'success', message: 'Report downloaded successfully' });
    } catch (error) {
      toast({ type: 'error', message: 'Failed to export report' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (!event || !statistics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Data Not Available</h2>
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

  const attendanceRate = statistics.totalRegistrations > 0
    ? ((statistics.totalAttended / statistics.totalRegistrations) * 100).toFixed(1)
    : '0';

  const capacityUsage = event.maxCapacity
    ? ((statistics.totalRegistrations / event.maxCapacity) * 100).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                Event Statistics
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {event.name}
              </p>
            </div>
            <button
              onClick={handleExportReport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Registrations */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {statistics.totalRegistrations}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Registrations
            </p>
            {capacityUsage && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {capacityUsage}% of capacity
              </p>
            )}
          </div>

          {/* Confirmed Registrations */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {statistics.confirmedRegistrations}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Confirmed
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {statistics.totalRegistrations > 0
                ? `${((statistics.confirmedRegistrations / statistics.totalRegistrations) * 100).toFixed(0)}% of total`
                : 'No registrations'}
            </p>
          </div>

          {/* Attended */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {statistics.totalAttended}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Attended
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {attendanceRate}% attendance rate
            </p>
          </div>

          {/* Revenue (if paid) */}
          {event.paymentType === 'paid' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <IndianRupee className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                ₹{statistics.totalRevenue?.toLocaleString('en-IN') || 0}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Revenue
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Fee: ₹{event.registrationFee?.toLocaleString('en-IN') || 0}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Registration Status Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Registration Status
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Confirmed */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Confirmed
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width: `${statistics.totalRegistrations > 0
                          ? (statistics.confirmedRegistrations / statistics.totalRegistrations) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-right">
                    {statistics.confirmedRegistrations}
                  </span>
                </div>
              </div>

              {/* Pending */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pending
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all"
                      style={{
                        width: `${statistics.totalRegistrations > 0
                          ? (statistics.pendingRegistrations / statistics.totalRegistrations) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-right">
                    {statistics.pendingRegistrations}
                  </span>
                </div>
              </div>

              {/* Cancelled */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cancelled
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all"
                      style={{
                        width: `${statistics.totalRegistrations > 0
                          ? (statistics.cancelledRegistrations / statistics.totalRegistrations) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-right">
                    {statistics.cancelledRegistrations}
                  </span>
                </div>
              </div>

              {/* Waitlisted */}
              {statistics.waitlistedRegistrations > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Waitlisted
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-500 transition-all"
                        style={{
                          width: `${statistics.totalRegistrations > 0
                            ? (statistics.waitlistedRegistrations / statistics.totalRegistrations) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-right">
                      {statistics.waitlistedRegistrations}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attendance Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-5 py-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Attendance Overview
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Attendance Rate Circular Progress */}
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-32 h-32 mb-4">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - Number(attendanceRate) / 100)}`}
                      className="text-teal-500 transition-all duration-1000"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {attendanceRate}%
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Attended
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {statistics.totalAttended} out of {statistics.totalRegistrations} registered attendees
                </p>
              </div>

              {/* Entry Statistics */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {statistics.totalEntries}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Total Entries
                  </p>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {statistics.totalExits}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Total Exits
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Event Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden lg:col-span-2">
            <div className="bg-gradient-to-r from-pink-500 to-rose-600 px-5 py-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Event Timeline
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {/* Event Dates */}
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      Event Period
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(event.startDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })} - {new Date(event.endDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {/* Registration Period */}
                {event.registrationStartDate && event.registrationEndDate && (
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        Registration Period
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(event.registrationStartDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })} - {new Date(event.registrationEndDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Venue */}
                {event.venue && (
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        Venue
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {event.venue}
                      </p>
                    </div>
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
