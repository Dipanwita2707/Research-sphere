'use client';

import React from 'react';
import { Award, Users, Calendar, UserCheck, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMyClubs } from '@/features/dsw/hooks';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

export default function MyClubsPage() {
  const router = useRouter();
  const { data: response, isLoading, error } = useMyClubs();
  const clubs = response?.success ? response.data ?? [] : [];
  const errorMessage = error ? getErrorMessage(error) : null;

  if (isLoading) {
    return <PageSkeleton message="Loading your clubs..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">My Clubs</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {clubs.length === 0
            ? 'You are not part of any clubs yet'
            : `You are part of ${clubs.length} club${clubs.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
        </div>
      )}

      {clubs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
          <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            You&apos;re Not Part of Any Club Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Join clubs to connect with like-minded students and participate in activities.
          </p>
          <button
            onClick={() => router.push('/dsw/clubs')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Users className="w-5 h-5" />
            Browse All Clubs
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {clubs.map((club) => (
            <div
              key={club.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/dsw/clubs/${club.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {club.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{club.clubId}</p>
                </div>
                <Crown className="w-5 h-5 text-yellow-500" />
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {club.purpose}
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{club._count?.members || 0} members</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Session {club.academicSession}</span>
                </div>
                {club.facultyFacilitator && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <UserCheck className="w-4 h-4" />
                    <span className="truncate">
                      Faculty: {club.facultyFacilitator.employeeDetails?.firstName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
