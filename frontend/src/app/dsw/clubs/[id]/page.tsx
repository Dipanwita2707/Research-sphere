'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  UserCheck,
  Mail,
  Calendar,
  FileText,
  Shield,
  Activity,
} from 'lucide-react';
import { useClub } from '@/features/dsw/hooks';
import { ClubStatusBadge } from '@/features/dsw/components/ClubStatusBadge';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

export default function ClubDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;

  const { data: response, isLoading, error } = useClub(clubId);
  const club = response?.success ? response.data : null;
  const errorMessage = error ? getErrorMessage(error) : null;

  if (isLoading) {
    return <PageSkeleton message="Loading club details..." />;
  }

  if (errorMessage || !club) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {errorMessage || 'Club Not Found'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            The club you&apos;re looking for doesn&apos;t exist or you don&apos;t have
            permission to view it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Clubs
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {club.name}
              </h1>
              <ClubStatusBadge status={club.status} size="md" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Club ID: {club.clubId}
            </p>
            {club.category && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                <FileText className="w-4 h-4" />
                {club.category.name}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => {
                // TODO: Add edit functionality
                alert('Edit functionality coming soon');
              }}
            >
              Edit Club
            </button>
          </div>
        </div>
      </div>

      {/* Club Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Purpose */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700 md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Purpose
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {club.purpose || 'No purpose specified'}
          </p>
        </div>

        {/* Faculty Facilitator */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Faculty Facilitator
          </h2>
          {club.facultyFacilitator ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-16">
                  Name:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {club.facultyFacilitator.employeeDetails?.displayName ||
                    club.facultyFacilitator.employeeDetails?.firstName ||
                    'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${club.facultyFacilitator.email}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  {club.facultyFacilitator.email}
                </a>
              </div>
              {club.facultyFacilitator.uid && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-16">
                    UID:
                  </span>
                  <span className="text-gray-900 dark:text-white text-sm">
                    {club.facultyFacilitator.uid}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Not assigned</p>
          )}
        </div>

        {/* Vice Chairperson */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Vice Chairperson
          </h2>
          {club.viceChairperson ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-16">
                  Name:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {club.viceChairperson.studentLogin?.displayName ||
                    club.viceChairperson.studentLogin?.firstName ||
                    'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${club.viceChairperson.email}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  {club.viceChairperson.email}
                </a>
              </div>
              {club.viceChairperson.uid && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-16">
                    UID:
                  </span>
                  <span className="text-gray-900 dark:text-white text-sm">
                    {club.viceChairperson.uid}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Not assigned</p>
          )}
        </div>

        {/* Members */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700 md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Members
            {club.members && club.members.length > 0 && (
              <span className="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
                {club.members.length}
              </span>
            )}
          </h2>
          {club.members && club.members.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {club.members.map((member: { id: string; student?: { studentLogin?: { displayName?: string; firstName?: string }; email?: string }; role?: string }) => (
                <div
                  key={member.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {member.student?.studentLogin?.displayName ||
                      member.student?.studentLogin?.firstName ||
                      'Unknown'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {member.student?.email || 'No email'}
                  </p>
                  {member.role && (
                    <span className="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs">
                      {member.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No members yet</p>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700 md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Created
              </p>
              <p className="text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(club.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Last Updated
              </p>
              <p className="text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(club.updatedAt).toLocaleDateString()}
              </p>
            </div>
            {club.approvedAt && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Approved
                </p>
                <p className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(club.approvedAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
