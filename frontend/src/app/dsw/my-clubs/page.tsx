"use client";

import React from "react";
import {
  Award,
  Users,
  Calendar,
  UserCheck,
  Crown,
  Clock,
  FileText,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMyClubs, useMyClubRequests } from "@/features/dsw/hooks";
import { useEffect, useRef } from "react";
import dswAPI from "@/features/dsw/services/api";
import { ClubStatusBadge } from "@/features/dsw/components/ClubStatusBadge";
import { getErrorMessage } from "@/shared/utils/errorHandler";
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import { DSWMyClubsShimmer } from "@/components/shimmer";
import { ClubCreationRequest } from "@/features/dsw/types";

// ─── Noting status → human-readable label + style ───────────────────────────
const NOTING_STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending Review",
    icon: <Clock className="w-3.5 h-3.5" />,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  draft: {
    label: "Draft",
    icon: <FileText className="w-3.5 h-3.5" />,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="w-3.5 h-3.5" />,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
  withdrawn: {
    label: "Withdrawn",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  },
};

function NotingStatusBadge({ status }: { status: string }) {
  const cfg = NOTING_STATUS_CONFIG[status] ?? {
    label: status,
    icon: <Clock className="w-3.5 h-3.5" />,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Approval chain steps ────────────────────────────────────────────────────
const APPROVAL_STEPS = ["Faculty", "HOD", "Dean", "DSW", "Higher Auth"];

// Maps the backend approval-chain holder role (or final status) to how many
// steps are fully done.  The chain is: Faculty(0) → HOD(1) → Dean(2) → DSW(3) → Higher Auth(4)
function resolveApprovalDoneIndex(req: ClubCreationRequest): number {
  if (req.status === "approved") return APPROVAL_STEPS.length; // all done
  if (req.status === "rejected" || req.status === "withdrawn") {
    // Show progress up to the step where it stopped — derive from lastAction
    // We don't have a dedicated field, so fall back to "at least Faculty done"
    return 1;
  }
  // For pending notings, try to infer current position from currentHolder role.
  // The backend returns currentHolder but not their role directly.
  // As a best-effort heuristic we use lastAction remarks / currentHolder uid
  // patterns; if we can't tell, default to "Faculty approved, now at HOD".
  const remarks = req.lastAction?.remarks ?? "";
  const action = req.lastAction?.action ?? "";
  if (/higher.auth|vc|vice.chancellor/i.test(remarks + action)) return 4;
  if (/dsw/i.test(remarks + action)) return 3;
  if (/dean/i.test(remarks + action)) return 2;
  if (/hod/i.test(remarks + action)) return 1;
  // Default: just submitted, waiting at Faculty
  return 0;
}

function ApprovalChain({ req }: { req: ClubCreationRequest }) {
  const doneIndex = resolveApprovalDoneIndex(req);
  const isRejected = req.status === "rejected" || req.status === "withdrawn";

  return (
    <div className="flex flex-wrap items-center gap-1 mt-2">
      {APPROVAL_STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              i < doneIndex
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : i === doneIndex && !isRejected
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-400 dark:ring-amber-600"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-700/50 dark:text-gray-500"
            }`}
          >
            {i < doneIndex && <span className="mr-0.5">✓</span>}
            {step}
          </span>
          {i < APPROVAL_STEPS.length - 1 && (
            <ArrowRight className="w-3 h-3 text-ev-200 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Pending Request Card ────────────────────────────────────────────────────
function PendingRequestCard({
  req,
  compact = false,
}: {
  req: ClubCreationRequest;
  compact?: boolean;
}) {
  const submittedAt = new Date(req.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-ev p-5 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-ev-900 truncate">
            {req.clubName ?? "Unnamed Club"}
          </h3>
          <p className="text-xs text-ev-400 mt-0.5">
            {req.categoryName ?? "Unknown Category"}{" "}
            {req.clubAcademicSession ? `· ${req.clubAcademicSession}` : ""}
          </p>
        </div>
        <NotingStatusBadge status={req.status} />
      </div>

      {/* Purpose */}
      {req.clubPurpose && (
        <p className="text-sm text-ev-400 line-clamp-2">{req.clubPurpose}</p>
      )}

      {/* Approval chain */}
      <ApprovalChain req={req} />

      {/* Footer meta */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#edf4f8]">
        <div className="flex items-center gap-1.5 text-xs text-ev-400">
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-mono">{req.notingId}</span>
        </div>
        <span className="text-xs text-ev-400">Submitted {submittedAt}</span>
      </div>

      {/* Current holder */}
      {req.currentHolder && (
        <div className="flex items-center gap-1.5 text-xs text-ev-400 -mt-1">
          <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Currently with{" "}
            <span className="font-medium text-ev-800">{req.currentHolder.name}</span>
          </span>
        </div>
      )}

      {/* Last action */}
      {req.lastAction && (
        <div className="bg-ev-50 rounded-lg px-3 py-2 text-xs text-ev-400">
          <span className="font-medium text-ev-800">Last action:</span>{" "}
          {req.lastAction.action}
          {req.lastAction.remarks && (
            <span className="ml-1 text-ev-400">— {req.lastAction.remarks}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function MyClubsPage() {
  const router = useRouter();
  const patchRanRef = useRef(false);

  const {
    data: clubsResponse,
    isLoading: clubsLoading,
    error: clubsError,
    refetch: refetchClubs,
  } = useMyClubs();

  const {
    data: requests,
    isLoading: requestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useMyClubRequests();

  // ── One-time repair for old notings whose student UUID was never stored ──
  // Runs silently on first mount; if it patches anything it re-fetches requests.
  useEffect(() => {
    if (patchRanRef.current) return;
    patchRanRef.current = true;

    dswAPI.clubs
      .patchOldClubRequests()
      .then((res) => {
        if (res?.data?.patched && res.data.patched.length > 0) {
          console.log(
            `[my-clubs] Patched ${res.data.patched.length} old noting(s):`,
            res.data.patched,
          );
          refetchRequests();
        }
      })
      .catch(() => {
        // Silently ignore — patch is best-effort
      });
  }, [refetchRequests]);

  const clubs = clubsResponse?.success ? (clubsResponse.data ?? []) : [];
  const allRequests = requests ?? [];

  // ── Split requests by lifecycle stage ─────────────────────────────────────
  // Active = still moving through the approval chain
  const activeRequests = allRequests.filter(
    (r) => r.status === "pending" || r.status === "draft",
  );
  // Resolved = finished (approved, rejected, withdrawn)
  const resolvedRequests = allRequests.filter(
    (r) =>
      r.status === "approved" ||
      r.status === "rejected" ||
      r.status === "withdrawn",
  );

  // Legacy alias so the rest of the page doesn't need renaming
  const pendingRequests = activeRequests;

  const isLoading = clubsLoading || requestsLoading;
  const clubsErrorMsg = clubsError ? getErrorMessage(clubsError) : null;
  const requestsErrorMsg = requestsError
    ? getErrorMessage(requestsError)
    : null;

  if (isLoading) {
    return <DSWMyClubsShimmer />;
  }

  const hasAnything = clubs.length > 0 || allRequests.length > 0;

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ev-900">My Clubs</h1>
          <p className="mt-1 text-ev-400 text-sm">
            {!hasAnything
              ? "You have no clubs or pending requests yet."
              : `${clubs.length} club${clubs.length !== 1 ? "s" : ""} · ${activeRequests.length} pending request${activeRequests.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { refetchClubs(); refetchRequests(); }}
            className="ev-btn-outline"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => router.push("/dsw/create-club")}
            disabled={activeRequests.length > 0}
            title={
              activeRequests.length > 0
                ? "You already have an active club request"
                : "Create a new club request"
            }
            className="ev-btn disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Club Request
          </button>
        </div>
      </div>

      {/* ── Error Banners ── */}
      {(clubsErrorMsg || requestsErrorMsg) && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-1">
          {clubsErrorMsg && <p className="text-sm text-red-700">Clubs: {clubsErrorMsg}</p>}
          {requestsErrorMsg && <p className="text-sm text-red-700">Requests: {requestsErrorMsg}</p>}
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasAnything && (
        <div className="ev-card p-12 text-center">
          <Award className="w-14 h-14 text-ev-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ev-900 mb-2">Nothing here yet</h3>
          <p className="text-ev-400 text-sm mb-6 max-w-sm mx-auto">
            You haven&apos;t joined any clubs and have no pending club creation
            requests. Browse existing clubs or start a new one.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => router.push("/dsw/clubs")} className="ev-btn-outline">
              <Users className="w-4 h-4" />
              Browse All Clubs
            </button>
            <button onClick={() => router.push("/dsw/create-club")} className="ev-btn">
              <Plus className="w-4 h-4" />
              Create Club Request
            </button>
          </div>
        </div>
      )}

      {/* ═══ SECTION 1 — Pending Club Creation Requests ═══ */}
      {pendingRequests.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-semibold text-ev-900">
                Pending Club Requests
              </h2>
            </div>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              {pendingRequests.length}
            </span>
          </div>

          {/* Info note */}
          <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              These club creation requests are currently going through the
              approval workflow. Your club will be created automatically once
              all approvals are received.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingRequests.map((req) => (
              <PendingRequestCard key={req.id} req={req} />
            ))}
          </div>
        </section>
      )}

      {/* ═══ SECTION 2 — My Clubs ═══ */}
      {clubs.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-ev-700" />
              <h2 className="text-base font-semibold text-ev-900">
                My Active Clubs
              </h2>
            </div>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ev-50 text-ev-700 text-xs font-bold">
              {clubs.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {clubs.map((club) => (
              <div
                key={club.id}
                className="ev-card ev-card-hover p-5 cursor-pointer"
                onClick={() => router.push(`/dsw/clubs/${club.id}`)}
              >
                {/* Club card header */}
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-ev-900 truncate">
                      {club.name}
                    </h3>
                    <p className="text-xs text-ev-400 mt-0.5">
                      {club.clubId}
                    </p>
                  </div>
                  <ClubStatusBadge status={club.status} size="sm" />
                </div>

                {/* Purpose */}
                <p className="text-sm text-ev-400 mb-4 line-clamp-2">
                  {club.purpose}
                </p>

                {/* Meta rows */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-ev-400">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>{club._count?.members ?? 0} members</span>
                  </div>
                  <div className="flex items-center gap-2 text-ev-400">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>Session {club.academicSession}</span>
                  </div>
                  {club.facultyFacilitator && (
                    <div className="flex items-center gap-2 text-ev-400">
                      <UserCheck className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">
                        {club.facultyFacilitator.employeeDetails?.firstName}{" "}
                        {club.facultyFacilitator.employeeDetails?.lastName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Browse hint when only active requests exist ── */}
      {activeRequests.length > 0 && clubs.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-ev-400">
            Want to join an existing club while you wait?{" "}
            <button
              onClick={() => router.push("/dsw/clubs")}
              className="text-ev-700 hover:underline font-medium"
            >
              Browse all clubs →
            </button>
          </p>
        </div>
      )}

      {/* ═══ SECTION 3 — Completed / Resolved Requests ═══ */}
      {resolvedRequests.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-ev-400" />
              <h2 className="text-base font-semibold text-ev-900">
                Completed Requests
              </h2>
            </div>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-ev-50 text-ev-700 text-xs font-bold">
              {resolvedRequests.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resolvedRequests.map((req) => (
              <div
                key={req.id}
                className={`bg-white rounded-xl border shadow-ev p-5 flex flex-col gap-3 opacity-80 ${
                  req.status === "approved"
                    ? "border-green-200"
                    : req.status === "rejected"
                      ? "border-red-200"
                      : "border-[#b3cde0]"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-ev-900 truncate">
                      {req.clubName ?? "Unnamed Club"}
                    </h3>
                    <p className="text-xs text-ev-400 mt-0.5">
                      {req.categoryName ?? "Unknown Category"}
                      {req.clubAcademicSession
                        ? ` · ${req.clubAcademicSession}`
                        : ""}
                    </p>
                  </div>
                  <NotingStatusBadge status={req.status} />
                </div>

                {/* Approval chain (all steps shown as done for approved) */}
                <ApprovalChain req={req} />

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#edf4f8]">
                  <div className="flex items-center gap-1.5 text-xs text-ev-400">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-mono">{req.notingId}</span>
                  </div>
                  <span className="text-xs text-ev-400">
                    {new Date(req.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Last action remark */}
                {req.lastAction && (
                  <div className="bg-ev-50 rounded-lg px-3 py-2 text-xs text-ev-400">
                    <span className="font-medium text-ev-800">
                      Last action:
                    </span>{" "}
                    {req.lastAction.action}
                    {req.lastAction.remarks && (
                      <span className="ml-1 text-ev-400">
                        — {req.lastAction.remarks}
                      </span>
                    )}
                  </div>
                )}

                {/* Status-specific contextual message */}
                {req.status === "approved" && clubs.length === 0 && (
                  <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-3 py-2">
                    ✅ Fully approved — your club is being set up and will
                    appear in "My Active Clubs" shortly. Try refreshing.
                  </p>
                )}
                {req.status === "approved" && clubs.length > 0 && (
                  <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded px-3 py-2">
                    ✅ Club created successfully — see "My Active Clubs" above.
                  </p>
                )}
                {req.status === "rejected" && (
                  <p className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">
                    ❌ This request was rejected. You can submit a new club
                    request if needed.
                  </p>
                )}
                {req.status === "withdrawn" && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded px-3 py-2">
                    ↩ This request was withdrawn.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
