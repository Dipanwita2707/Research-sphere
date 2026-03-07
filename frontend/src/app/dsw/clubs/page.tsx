"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Calendar,
  UserCheck,
  Mail,
  Clock,
  X,
  CheckCircle,
  ArrowRight,
  FileText,
  Send,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApplyToClub, useClubs, useMyClubApplications } from "@/features/dsw/hooks";
import { ClubStatusBadge } from "@/features/dsw/components/ClubStatusBadge";
import { ClubFilters } from "@/features/dsw/types";
import { getErrorMessage } from "@/shared/utils/errorHandler";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import { useAuthStore } from "@/shared/auth/authStore";

export default function AllClubsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<ClubFilters>({
    page: 1,
    limit: 20,
  });
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);

  // Pending submission banner state
  const [pendingBanner, setPendingBanner] = useState<{
    show: boolean;
    notingId: string;
    clubName: string;
  } | null>(null);

  // Read query params on mount to show the pending banner
  useEffect(() => {
    const submitted = searchParams.get("submitted");
    const notingId = searchParams.get("notingId");
    const clubName = searchParams.get("clubName");

    if (submitted === "true" && notingId) {
      setPendingBanner({ show: true, notingId, clubName: clubName || "" });

      // Clean up the URL without triggering a re-render/navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("submitted");
      url.searchParams.delete("notingId");
      url.searchParams.delete("clubName");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, [searchParams]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      search: debouncedSearch || undefined,
      page: 1,
    }));
  }, [debouncedSearch]);

  const { data: response, isLoading, error } = useClubs(filters);
  const { data: myApplications = [] } = useMyClubApplications();
  const applyToClub = useApplyToClub();
  const { user } = useAuthStore();
  const normalizedUserRole = String(
    user?.userType ?? (user as any)?.role ?? "",
  ).toLowerCase();
  const isStudentUser = normalizedUserRole === "student";
  const clubs = response?.success ? (response.data ?? []) : [];
  const total = response?.pagination?.total ?? 0;
  const errorMessage = error ? getErrorMessage(error) : null;

  const applicationMap = useMemo(() => {
    const map = new Map<string, "pending" | "approved" | "rejected">();
    myApplications.forEach((app) => {
      if (!map.has(app.clubId)) {
        map.set(app.clubId, app.status);
      }
    });
    return map;
  }, [myApplications]);

  const profileData = useMemo(() => {
    const fullName =
      `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() ||
      user?.student?.displayName ||
      user?.username ||
      "";

    return {
      fullName,
      email: user?.email || "",
      mobileNumber: user?.employeeDetails?.phone || "",
      program: user?.student?.program || "",
      course: user?.student?.registrationNo || user?.student?.studentId || "",
    };
  }, [user]);

  const handleApply = async () => {
    if (!selectedClubId) {
      setApplyError("Please select a club first.");
      return;
    }

    try {
      setApplyError(null);
      await applyToClub.mutateAsync({ clubId: selectedClubId });
      setShowApplyModal(false);
      setSelectedClubId("");
    } catch (err) {
      setApplyError(getErrorMessage(err));
    }
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status === "all" ? undefined : (status as ClubFilters["status"]),
      page: 1,
    }));
  };

  if (isLoading) {
    return <PageSkeleton message="Loading clubs..." />;
  }

  return (
    <div className="space-y-6">
      {/* ── Pending Club Request Banner ── */}
      {pendingBanner?.show && (
        <div className="relative bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-5 shadow-sm">
          {/* Dismiss button */}
          <button
            onClick={() => setPendingBanner(null)}
            className="absolute top-3 right-3 p-2.5 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            {/* Icon */}
            <div className="flex-shrink-0 w-11 h-11 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">
                  Club Creation Request Submitted
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                  <Clock className="w-3 h-3" />
                  Pending Approval
                </span>
              </div>

              {pendingBanner.clubName && (
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Club:{" "}
                  <span className="font-semibold">
                    {pendingBanner.clubName}
                  </span>
                </p>
              )}

              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Your request has been sent to the Faculty Facilitator for
                review. It will then go through the full approval chain before
                your club is officially created.
              </p>

              {/* Approval chain */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs mb-3">
                {[
                  { label: "Faculty", done: true },
                  { label: "HOD" },
                  { label: "Dean" },
                  { label: "DSW" },
                  { label: "Higher Authority" },
                ].map((step, i, arr) => (
                  <React.Fragment key={step.label}>
                    <span
                      className={`px-2.5 py-1 rounded-full font-medium ${
                        step.done
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700"
                          : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {step.done && <span className="mr-1">✓</span>}
                      {step.label}
                    </span>
                    {i < arr.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-amber-400 dark:text-amber-600 flex-shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Noting ID + track link */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-md">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="font-mono font-medium">
                    {pendingBanner.notingId}
                  </span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Your club will appear here automatically once all approvals
                  are received.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            All Clubs
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Showing {clubs.length} of {total} clubs
          </p>
        </div>

        {isStudentUser && (
          <button
            type="button"
            onClick={() => setShowApplyModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sgt-600 hover:bg-sgt-700 text-white rounded-lg font-semibold text-sm"
          >
            <Send className="w-4 h-4" />
            Apply to Clubs
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clubs by name, purpose, or ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            onChange={(e) => handleStatusFilter(e.target.value)}
            value={filters.status || "all"}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Clubs Grid */}
      {clubs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Clubs Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No clubs match your current filters. Try adjusting your search
            criteria.
          </p>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {club.clubId}
                  </p>
                  {applicationMap.get(club.id) && (
                    <p className="mt-1 text-xs font-semibold text-sgt-600 dark:text-sgt-300">
                      Application: {applicationMap.get(club.id)}
                    </p>
                  )}
                </div>
                <ClubStatusBadge status={club.status} size="sm" />
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
                      {club.facultyFacilitator.employeeDetails?.firstName}{" "}
                      {club.facultyFacilitator.employeeDetails?.lastName}
                    </span>
                  </div>
                )}
              </div>

              {club.proposedEmail && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{club.proposedEmail}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > (filters.limit ?? 20) && (
        <div className="flex flex-wrap justify-center items-center gap-2">
          <button
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                page: Math.max(1, (prev.page ?? 1) - 1),
              }))
            }
            disabled={filters.page === 1}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
            Page {filters.page} of {Math.ceil(total / (filters.limit ?? 20))}
          </span>
          <button
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                page: Math.min(
                  Math.ceil(total / (filters.limit ?? 20)),
                  (prev.page ?? 1) + 1,
                ),
              }))
            }
            disabled={
              (filters.page ?? 1) >= Math.ceil(total / (filters.limit ?? 20))
            }
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white"
          >
            Next
          </button>
        </div>
      )}

      {showApplyModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowApplyModal(false);
              setApplyError(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Apply to Club</h3>
              <button
                type="button"
                onClick={() => {
                  setShowApplyModal(false);
                  setApplyError(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Club Selection</label>
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <option value="">Select Club</option>
                {clubs
                  .filter((club) => club.status === "active")
                  .map((club) => {
                    const status = applicationMap.get(club.id);
                    const disabled = status === "pending" || status === "approved";
                    return (
                      <option key={club.id} value={club.id} disabled={disabled}>
                        {club.name}{disabled ? ` (${status})` : ""}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadOnlyField label="Full Name" value={profileData.fullName} />
              <ReadOnlyField label="Email" value={profileData.email} />
              <ReadOnlyField label="Mobile Number" value={profileData.mobileNumber} />
              <ReadOnlyField label="Program" value={profileData.program} />
              <ReadOnlyField label="Course" value={profileData.course} />
            </div>

            {applyError && (
              <p className="text-sm text-red-600 dark:text-red-400">{applyError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowApplyModal(false);
                  setApplyError(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applyToClub.isPending}
                className="px-4 py-2 rounded-lg bg-sgt-600 hover:bg-sgt-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {applyToClub.isPending ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        value={value || "-"}
        readOnly
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm"
      />
    </div>
  );
}
