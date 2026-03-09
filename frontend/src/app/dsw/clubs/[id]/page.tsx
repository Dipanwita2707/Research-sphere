"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { ClubMember } from "@/features/dsw/types";
import {
  ArrowLeft,
  Users,
  UserCheck,
  Mail,
  Calendar,
  FileText,
  Activity,
  Target,
  Zap,
  Clock,
  Hash,
  Plus,
  Search,
  X,
  Crown,
  Layers,
  BookOpen,
  BarChart2,
  Shield,
  ChevronRight,
  Star,
  CalendarDays,
  Pencil,
  Trash2,
  ExternalLink,
  MapPin,
} from "lucide-react";
import {
  useClub,
  useAddMember,
  useRemoveMember,
  useUpdateMemberRole,
  useClubEvents,
  useApplyToClub,
  useMyClubApplications,
  useClubApplications,
  useReviewClubApplication,
} from "@/features/dsw/hooks";
import { ClubStatusBadge } from "@/features/dsw/components/ClubStatusBadge";
import { getErrorMessage } from "@/shared/utils/errorHandler";
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import {
  CLUB_MEMBER_ROLES,
  CLUB_MEMBER_ROLE_OPTIONS,
  DEFAULT_MEMBER_ROLE,
  type ClubMemberRole,
} from "@/features/dsw/constants";
import { useAuthStore } from "@/shared/auth/authStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMemberName(member: ClubMember): string {
  return (
    member.student?.studentLogin?.displayName ||
    member.student?.studentLogin?.firstName ||
    (member.student?.employeeDetails?.displayName ?? undefined) ||
    member.student?.email?.split("@")[0] ||
    "Unknown"
  );
}

function getMemberRole(member: ClubMember): ClubMemberRole {
  // Backend stores role in metadata.role and also lifts it to member.role
  const r = (member.role ?? (member.metadata?.role as string | undefined)) as
    | ClubMemberRole
    | undefined;
  if (r && CLUB_MEMBER_ROLES[r]) return r;
  return DEFAULT_MEMBER_ROLE;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: ClubMemberRole }) {
  const cfg = CLUB_MEMBER_ROLES[role];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}
    >
      <span aria-hidden="true">{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
}

// ─── MemberCard ───────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  "from-[#03396c] to-[#011f4b]",
  "from-[#005b96] to-[#03396c]",
  "from-[#6497b1] to-[#005b96]",
  "from-[#011f4b] to-[#03396c]",
  "from-[#b3cde0] to-[#6497b1]",
  "from-[#005b96] to-[#011f4b]",
];

function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]!;
}

function MemberCard({
  member,
  canManage,
  onRemove,
  onEdit,
}: {
  member: ClubMember;
  canManage: boolean;
  onRemove?: (memberId: string) => void;
  onEdit?: (member: ClubMember) => void;
}) {
  const role = getMemberRole(member);
  const name = getMemberName(member);

  return (
    <div className="group flex items-start gap-3 p-3.5 rounded-xl bg-white border border-[#b3cde0] hover:border-[#6497b1] hover:shadow-ev transition-all duration-200">
      {/* Avatar */}
      <div
        className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm`}
      >
        {getInitials(name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ev-900 truncate leading-tight">
          {name}
        </p>
        <p className="text-xs text-ev-400 truncate mt-0.5">
          {member.student?.email || member.student?.uid || "—"}
        </p>
        <div className="mt-1.5">
          <RoleBadge role={role} />
        </div>
      </div>

      {/* Action buttons (managers only, shown on hover) */}
      {canManage && (
        <div className="sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 flex-shrink-0 transition-all">
          {onEdit && (
            <button
              onClick={() => onEdit(member)}
              className="p-1.5 rounded-lg text-ev-400 hover:text-ev-700 hover:bg-ev-50 transition-all"
              title="Edit role"
              type="button"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(member.id)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              title="Remove member"
              type="button"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TeamSection ──────────────────────────────────────────────────────────────

interface TeamSectionProps {
  title: string;
  subtitle: string;
  emoji: string;
  accentBorderClass: string;
  members: ClubMember[];
  canManage: boolean;
  onRemove?: (id: string) => void;
  onEdit?: (member: ClubMember) => void;
}

function TeamSection({
  title,
  subtitle,
  emoji,
  accentBorderClass,
  members,
  canManage,
  onRemove,
  onEdit,
}: TeamSectionProps) {
  if (members.length === 0) return null;

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-3 pb-2 border-b-2 ${accentBorderClass}`}
      >
        <span className="text-xl" aria-hidden="true">
          {emoji}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ev-900">
            {title}
          </h3>
          <p className="text-xs text-ev-400">{subtitle}</p>
        </div>
        <span className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-ev-50 text-ev-700">
          {members.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {members.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            canManage={canManage}
            onRemove={onRemove}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

// ─── InfoChip ─────────────────────────────────────────────────────────────────

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-ev-50 border border-[#b3cde0]">
      <span className="text-ev-400 flex-shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide font-medium text-ev-400">
          {label}
        </p>
        <p className="text-sm font-semibold text-ev-900 truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── EditMemberModal ──────────────────────────────────────────────────────────

function EditMemberModal({
  clubId,
  member,
  onClose,
}: {
  clubId: string;
  member: ClubMember;
  onClose: () => void;
}) {
  const currentRole = getMemberRole(member);
  const [selectedRole, setSelectedRole] = useState<ClubMemberRole>(currentRole);
  const [errorMsg, setErrorMsg] = useState("");
  const updateRole = useUpdateMemberRole(clubId);
  const name = getMemberName(member);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === currentRole) {
      onClose();
      return;
    }
    setErrorMsg("");
    try {
      await updateRole.mutateAsync({ memberId: member.id, role: selectedRole });
      onClose();
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setErrorMsg(
        anyErr?.response?.data?.message ||
          anyErr?.message ||
          "Failed to update role.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b3cde0] bg-ev-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ev-50 border border-[#b3cde0] flex items-center justify-center">
              <Pencil className="w-4 h-4 text-ev-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ev-900">Edit Member Role</h2>
              <p className="text-xs text-ev-400">{name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="ev-btn-ghost"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Role Selector */}
          <div>
            <label className="block text-sm font-medium text-ev-800 mb-2">
              Select New Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CLUB_MEMBER_ROLE_OPTIONS.map((opt) => {
                const cfg = CLUB_MEMBER_ROLES[opt.value];
                const isSelected = selectedRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRole(opt.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      isSelected
                        ? `${cfg.className} border-current shadow-sm`
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                    }`}
                  >
                    <span
                      className="text-base leading-none flex-shrink-0"
                      aria-hidden="true"
                    >
                      {opt.emoji}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role Description */}
          <div
            className={`flex items-start gap-2.5 p-3 rounded-xl text-xs ${CLUB_MEMBER_ROLES[selectedRole].className}`}
          >
            <span
              className="text-lg leading-none mt-0.5 flex-shrink-0"
              aria-hidden="true"
            >
              {CLUB_MEMBER_ROLES[selectedRole].emoji}
            </span>
            <div>
              <span className="font-bold">
                {CLUB_MEMBER_ROLES[selectedRole].label}:
              </span>{" "}
              {CLUB_MEMBER_ROLES[selectedRole].description}
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
              {errorMsg}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 ev-btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateRole.isPending || selectedRole === currentRole}
              className="flex-1 ev-btn disabled:opacity-60"
            >
              {updateRole.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4" />
                  Save Role
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── AddMemberModal ───────────────────────────────────────────────────────────

interface AddMemberModalProps {
  clubId: string;
  onClose: () => void;
}

function AddMemberModal({
  clubId,
  onClose,
  presetRole,
}: AddMemberModalProps & { presetRole?: ClubMemberRole }) {
  const [studentId, setStudentId] = useState("");
  const [selectedRole, setSelectedRole] = useState<ClubMemberRole>(
    presetRole ?? DEFAULT_MEMBER_ROLE,
  );
  const [errorMsg, setErrorMsg] = useState("");

  const addMember = useAddMember(clubId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) {
      setErrorMsg("Please enter a Student ID or email.");
      return;
    }
    setErrorMsg("");
    try {
      await addMember.mutateAsync({
        studentId: studentId.trim(),
        role: selectedRole,
      });
      onClose();
    } catch (err: unknown) {
      const anyErr = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setErrorMsg(
        anyErr?.response?.data?.message ||
          anyErr?.message ||
          "Failed to add member.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-ev-lg border border-[#b3cde0] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b3cde0] bg-ev-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ev-50 border border-[#b3cde0] flex items-center justify-center">
              <Users className="w-4 h-4 text-ev-700" />
            </div>
            <h2 className="text-base font-bold text-ev-900">Add Member</h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="ev-btn-ghost"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Student ID Input */}
          <div>
            <label
              htmlFor="studentIdInput"
              className="block text-sm font-medium text-ev-800 mb-1.5"
            >
              Student ID / Email
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ev-400" />
              <input
                id="studentIdInput"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. S2024001 or student@sgt.ac.in"
                className="ev-input pl-9"
              />
            </div>
          </div>

          {/* Assign Role */}
          <div>
            <label className="block text-sm font-medium text-ev-800 mb-2">
              Assign Role
              <span className="ml-2 text-xs font-normal text-ev-400">
                (default: 🙋 Volunteer)
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CLUB_MEMBER_ROLE_OPTIONS.map((opt) => {
                const cfg = CLUB_MEMBER_ROLES[opt.value];
                const isSelected = selectedRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRole(opt.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      isSelected
                        ? `${cfg.className} border-current shadow-sm`
                        : "border-[#b3cde0] text-ev-800 hover:border-[#6497b1] bg-white"
                    }`}
                  >
                    <span
                      className="text-base leading-none flex-shrink-0"
                      aria-hidden="true"
                    >
                      {opt.emoji}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role Description */}
          <div
            className={`flex items-start gap-2.5 p-3 rounded-xl text-xs ${CLUB_MEMBER_ROLES[selectedRole].className}`}
          >
            <span
              className="text-lg leading-none mt-0.5 flex-shrink-0"
              aria-hidden="true"
            >
              {CLUB_MEMBER_ROLES[selectedRole].emoji}
            </span>
            <div>
              <span className="font-bold">
                {CLUB_MEMBER_ROLES[selectedRole].label}:
              </span>{" "}
              {CLUB_MEMBER_ROLES[selectedRole].description}
            </div>
          </div>

          {/* Error add member */}
          {errorMsg && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
              {errorMsg}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 ev-btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMember.isPending}
              className="flex-1 ev-btn disabled:opacity-60"
            >
              {addMember.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Member
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "overview" | "team" | "details" | "applications" | "events";

interface ConfirmDeleteState {
  memberId: string;
  memberName: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClubDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;

  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") as TabKey | null;
  const validTabs: TabKey[] = ["overview", "team", "details", "applications", "events"];
  const activeTab: TabKey =
    rawTab && validTabs.includes(rawTab) ? rawTab : "overview";

  const setActiveTab = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );
  const [showAddMember, setShowAddMember] = useState(false);
  const [defaultRole, setDefaultRole] =
    useState<ClubMemberRole>(DEFAULT_MEMBER_ROLE);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [roleFilter, setRoleFilter] = useState<ClubMemberRole | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState | null>(
    null,
  );
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [reviewActionId, setReviewActionId] = useState<string | null>(null);

  const { user: currentUser } = useAuthStore();
  const normalizedUserRole = String(
    currentUser?.userType ?? (currentUser as any)?.role ?? "",
  ).toLowerCase();
  const isStudentUser = normalizedUserRole === "student";
  const isAdminUser = normalizedUserRole === "admin" || normalizedUserRole === "superadmin";
  const { data: response, isLoading, error } = useClub(clubId);
  const { data: clubEvents = [], isLoading: eventsLoading, error: eventsError } = useClubEvents(clubId);
  const { data: myApplications = [] } = useMyClubApplications();
  const { data: clubApplications = [] } = useClubApplications(clubId);
  const removeMember = useRemoveMember(clubId);
  const updateMemberRole = useUpdateMemberRole(clubId);
  const applyToClub = useApplyToClub();
  const reviewClubApplication = useReviewClubApplication(clubId);

  const club = response?.success ? response.data : null;
  const errorMessage = error ? getErrorMessage(error) : null;

  // Active members only
  const activeMembers = useMemo(
    () => (club?.members ?? []).filter((m) => m.isActive),
    [club?.members],
  );

  // Group by tier
  const leadershipMembers = useMemo(
    () =>
      activeMembers.filter(
        (m) => CLUB_MEMBER_ROLES[getMemberRole(m)]?.tier === 1,
      ),
    [activeMembers],
  );

  const supportMembers = useMemo(
    () =>
      activeMembers.filter((m) => {
        const t = CLUB_MEMBER_ROLES[getMemberRole(m)]?.tier;
        return t === 2;
      }),
    [activeMembers],
  );

  const volunteerMembers = useMemo(
    () => activeMembers.filter((m) => getMemberRole(m) === "volunteer"),
    [activeMembers],
  );

  // Only the club's own chairperson, faculty facilitator, or a system admin can manage members/roles.
  const canManage = !!(
    currentUser &&
    (
      currentUser.id === club?.chairpersonId ||
      currentUser.id === club?.facultyFacilitatorId ||
      isAdminUser
    )
  );

  const isMember = !!(
    currentUser &&
    activeMembers.some((m) => m.studentId === currentUser.id)
  );

  const myApplication = currentUser
    ? myApplications.find((a) => a.clubId === clubId)
    : undefined;

  const canApplyToClub =
    isStudentUser &&
    !canManage &&
    !isMember &&
    (!myApplication || myApplication.status === "rejected");

  // Filtered member groups — respects roleFilter when set
  const filteredLeadership = roleFilter
    ? leadershipMembers.filter((m) => getMemberRole(m) === roleFilter)
    : leadershipMembers;
  const filteredSupport = roleFilter
    ? supportMembers.filter((m) => getMemberRole(m) === roleFilter)
    : supportMembers;
  const filteredVolunteers = roleFilter
    ? volunteerMembers.filter((m) => getMemberRole(m) === roleFilter)
    : volunteerMembers;

  const handleRemove = useCallback(
    (memberId: string) => {
      const m = activeMembers.find((x) => x.id === memberId);
      if (m) {
        setConfirmDelete({ memberId, memberName: getMemberName(m) });
      }
    },
    [activeMembers],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;
    removeMember.mutate(
      { memberId: confirmDelete.memberId },
      { onSettled: () => setConfirmDelete(null) },
    );
  }, [confirmDelete, removeMember]);

  const handleEdit = useCallback((member: ClubMember) => {
    setEditingMember(member);
  }, []);

  const handleApplyToClub = async () => {
    try {
      setApplyError(null);
      await applyToClub.mutateAsync({ clubId });
      setShowApplyModal(false);
    } catch (err) {
      setApplyError(getErrorMessage(err));
    }
  };

  const handleReview = async (
    applicationId: string,
    decision: "approved" | "rejected",
  ) => {
    try {
      setReviewActionId(`${applicationId}:${decision}`);
      await reviewClubApplication.mutateAsync({ applicationId, decision });
    } finally {
      setReviewActionId(null);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) return <PageSkeleton message="Loading club details…" />;

  // ── Error / Not Found ────────────────────────────────────────────────────────
  if (errorMessage || !club) {
    return (
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-ev-400 hover:text-ev-900 mb-6 transition-colors"
          type="button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="ev-card p-12 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-lg font-bold text-ev-900 mb-2">
            {errorMessage || "Club Not Found"}
          </h3>
          <p className="text-ev-400 text-sm">
            The club you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have permission to view it.
          </p>
        </div>
      </div>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────────
  const facultyName =
    club.facultyFacilitator?.employeeDetails?.displayName ||
    club.facultyFacilitator?.employeeDetails?.firstName ||
    club.facultyFacilitator?.email ||
    "Not assigned";

  const chairpersonName =
    club.chairperson?.studentLogin?.displayName ||
    club.chairperson?.studentLogin?.firstName ||
    club.chairperson?.email ||
    "Not assigned";

  const targetGroupLabel = club.targetStudentGroup?.length
    ? club.targetStudentGroup.map((g) => g.toUpperCase()).join(", ")
    : "All Students";

  const meetingLabelMap: Record<string, string> = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    half_yearly: "Half-Yearly",
    annually: "Annually",
    event_based: "Event-Based",
  };
  const meetingLabel =
    meetingLabelMap[club.meetingFrequency] ?? club.meetingFrequency;

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      key: "overview",
      label: "Overview",
      icon: <BarChart2 className="w-4 h-4" />,
    },
    { key: "team", label: "Team", icon: <Users className="w-4 h-4" /> },
    {
      key: "details",
      label: "Details",
      icon: <FileText className="w-4 h-4" />,
    },
    ...(canManage
      ? [{
          key: "applications" as TabKey,
          label: "Club Application Requests",
          icon: <Users className="w-4 h-4" />,
        }]
      : []),
    {
      key: "events",
      label: "Events",
      icon: <CalendarDays className="w-4 h-4" />,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          clubId={club.id}
          presetRole={defaultRole}
          onClose={() => {
            setShowAddMember(false);
            setDefaultRole(DEFAULT_MEMBER_ROLE);
          }}
        />
      )}

      {/* Edit Member Role Modal */}
      {editingMember && (
        <EditMemberModal
          clubId={club.id}
          member={editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}

      {showApplyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowApplyModal(false)}
        >
          <div className="ev-modal w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ev-900">Apply to {club.name}</h3>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="ev-btn-ghost"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadOnlyField
                label="Full Name"
                value={`${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim() || currentUser?.student?.displayName || currentUser?.username || "-"}
              />
              <ReadOnlyField label="Email" value={currentUser?.email || "-"} />
              <ReadOnlyField label="Mobile Number" value={currentUser?.employeeDetails?.phone || "-"} />
              <ReadOnlyField label="Program" value={currentUser?.student?.program || "-"} />
              <ReadOnlyField label="Course" value={currentUser?.student?.registrationNo || currentUser?.student?.studentId || "-"} />
            </div>

            {applyError && (
              <p className="text-sm text-red-600">{applyError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="ev-btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyToClub}
                disabled={applyToClub.isPending}
                className="ev-btn disabled:opacity-60"
              >
                {applyToClub.isPending ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) =>
            e.target === e.currentTarget && setConfirmDelete(null)
          }
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-ev border border-[#b3cde0] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ev-900">
                  Remove Member
                </h3>
                <p className="text-xs text-ev-400">
                  Remove{" "}
                  <span className="font-semibold">
                    {confirmDelete.memberName}
                  </span>{" "}
                  from this club?
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 ev-btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={removeMember.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {removeMember.isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-5 pb-10">
        {/* Back */}
        <button
          onClick={() => router.back()}
          type="button"
          className="flex items-center gap-1.5 text-sm text-ev-400 hover:text-ev-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clubs
        </button>

        {/* ── Hero Header ────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#011f4b] to-[#005b96] text-white shadow-ev-lg">
          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-96 sm:h-96 rounded-full bg-white/[0.02] pointer-events-none" />

          <div className="relative px-6 sm:px-8 pt-6 sm:pt-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                {/* Category chip */}
                {club.category && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold text-indigo-100 mb-3">
                    <Layers className="w-3 h-3" />
                    {club.category.name}
                  </div>
                )}

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-2">
                  {club.name}
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-sm text-indigo-200">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />
                    {club.clubId}
                  </span>
                  <span className="text-indigo-400">·</span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {club.academicSession}
                  </span>
                  <span className="text-indigo-400">·</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {activeMembers.length}{" "}
                    {activeMembers.length === 1 ? "Member" : "Members"}
                  </span>
                </div>
              </div>

              {/* Status + actions */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <ClubStatusBadge status={club.status} size="md" />
                {myApplication && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-white/20 border border-white/30">
                    Application: {myApplication.status}
                  </span>
                )}
                {canApplyToClub && (
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/90 hover:bg-emerald-500 rounded-xl text-sm font-bold text-white border border-emerald-300/40 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Apply to Club
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-sm font-bold text-white border border-white/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Member
                  </button>
                )}
              </div>
            </div>

            {/* Quick stats strip */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pb-6">
              {[
                {
                  icon: <Users className="w-4 h-4" />,
                  label: "Members",
                  value: String(activeMembers.length),
                },
                {
                  icon: <Zap className="w-4 h-4" />,
                  label: "Activities / yr",
                  value: String(club.estimatedAnnualActivityCount ?? "—"),
                },
                {
                  icon: <Clock className="w-4 h-4" />,
                  label: "Meetings",
                  value: meetingLabel,
                },
                {
                  icon: <Target className="w-4 h-4" />,
                  label: "Target",
                  value: targetGroupLabel,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-xl px-3.5 py-3"
                >
                  <span className="text-indigo-200 flex-shrink-0">
                    {s.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-indigo-300 uppercase tracking-wide font-semibold">
                      {s.label}
                    </p>
                    <p className="text-sm font-bold text-white truncate">
                      {s.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-ev-50 border border-[#b3cde0] rounded-xl overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-white text-ev-700 shadow-ev"
                  : "text-ev-400 hover:text-ev-700 hover:bg-white/70"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW TAB                                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Purpose */}
            <div className="ev-card p-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-ev-900 mb-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-ev-50">
                  <FileText className="w-3.5 h-3.5 text-ev-700" />
                </span>
                Purpose
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                {club.purpose || "No purpose specified."}
              </p>
            </div>

            {/* Faculty + Chairperson side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Faculty Facilitator */}
              <div className="ev-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                    <UserCheck className="w-4 h-4 text-amber-500" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Faculty Facilitator
                    </h2>
                    <p className="text-xs text-ev-400">
                      Club mentor &amp; advisor
                    </p>
                  </div>
                </div>
                {club.facultyFacilitator ? (
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(facultyName)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}
                    >
                      {getInitials(facultyName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                        {facultyName}
                      </p>
                      {club.facultyFacilitator?.email && (
                        <a
                          href={`mailto:${club.facultyFacilitator.email}`}
                          className="flex items-center gap-1 text-xs text-ev-600 hover:underline mt-0.5 truncate"
                        >
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          {club.facultyFacilitator.email}
                        </a>
                      )}
                      {club.facultyFacilitator?.uid && (
                        <p className="text-xs text-ev-400 mt-0.5">
                          UID: {club.facultyFacilitator.uid}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Not assigned</p>
                )}
              </div>

              {/* Chairperson */}
              <div className="ev-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                    <Crown className="w-4 h-4 text-purple-500" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Chairperson
                    </h2>
                    <p className="text-xs text-ev-400">
                      Student head of the club
                    </p>
                  </div>
                </div>
                {club.chairperson ? (
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(chairpersonName)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}
                    >
                      {getInitials(chairpersonName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                        {chairpersonName}
                      </p>
                      {club.chairperson.email && (
                        <a
                          href={`mailto:${club.chairperson.email}`}
                          className="flex items-center gap-1 text-xs text-ev-600 hover:underline mt-0.5 truncate"
                        >
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          {club.chairperson.email}
                        </a>
                      )}
                      {club.chairperson.uid && (
                        <p className="text-xs text-ev-400 mt-0.5">
                          UID: {club.chairperson.uid}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Not assigned</p>
                )}
              </div>
            </div>

            {/* Activity Types */}
            {club.expectedActivityTypes?.length > 0 && (
              <div className="ev-card p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-ev-900 mb-4">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-ev-50">
                    <Activity className="w-3.5 h-3.5 text-ev-700" />
                  </span>
                  Expected Activity Types
                </h2>
                <div className="flex flex-wrap gap-2">
                  {club.expectedActivityTypes.map((act) => (
                    <span
                      key={act}
                      className="px-3 py-1.5 bg-ev-50 text-ev-700 rounded-lg text-xs font-semibold border border-[#b3cde0]"
                    >
                      {act}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="ev-card p-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-ev-900 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-ev-50">
                  <Calendar className="w-3.5 h-3.5 text-ev-700" />
                </span>
                Timeline
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InfoChip
                  icon={<Calendar className="w-4 h-4" />}
                  label="Created"
                  value={new Date(club.createdAt).toLocaleDateString()}
                />
                <InfoChip
                  icon={<Calendar className="w-4 h-4" />}
                  label="Last Updated"
                  value={new Date(club.updatedAt).toLocaleDateString()}
                />
                {club.approvedAt && (
                  <InfoChip
                    icon={<Calendar className="w-4 h-4" />}
                    label="Approved"
                    value={new Date(club.approvedAt).toLocaleDateString()}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TEAM TAB                                                            */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "team" && (
          <div className="ev-card p-5 sm:p-6 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ev-900">
                  Club Team
                </h2>
                <p className="text-xs text-ev-400 mt-0.5">
                  {activeMembers.length} active{" "}
                  {activeMembers.length === 1 ? "member" : "members"}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setDefaultRole("volunteer");
                    setShowAddMember(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ev-700 hover:bg-ev-800 text-white text-sm font-bold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Member
                </button>
              )}
            </div>

            {activeMembers.length === 0 ? (
              <div className="text-center py-12 text-ev-400">
                <div className="text-5xl mb-3">👥</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  No members yet
                </p>
                <p className="text-xs text-ev-400 mt-1">
                  Members will appear here once added to the club.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Role Filter */}
                <div className="p-4 bg-ev-50 rounded-xl border border-[#b3cde0]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-ev-400 uppercase tracking-wide">
                      Filter by Role
                    </p>
                    {roleFilter && (
                      <button
                        type="button"
                        onClick={() => setRoleFilter(null)}
                        className="flex items-center gap-1 text-xs text-ev-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      Object.entries(CLUB_MEMBER_ROLES) as [
                        ClubMemberRole,
                        (typeof CLUB_MEMBER_ROLES)[ClubMemberRole],
                      ][]
                    )
                      .filter(([k]) => k !== "chairperson")
                      .map(([key, cfg]) => {
                        const isActive = roleFilter === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setRoleFilter(
                                isActive ? null : (key as ClubMemberRole),
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
                              isActive
                                ? `${cfg.className} border-current ring-2 ring-offset-1 ring-current shadow-sm scale-105`
                                : `${cfg.className} border-transparent opacity-60 hover:opacity-100 hover:scale-105`
                            }`}
                          >
                            <span aria-hidden="true">{cfg.emoji}</span>
                            {cfg.label}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {filteredLeadership.length > 0 && (
                  <TeamSection
                    title="Leadership Team"
                    subtitle="Heads responsible for specific domains"
                    emoji="🏆"
                    accentBorderClass="border-[#b3cde0]"
                    members={filteredLeadership}
                    canManage={canManage}
                    onRemove={handleRemove}
                    onEdit={handleEdit}
                  />
                )}

                {filteredSupport.length > 0 && (
                  <TeamSection
                    title="Core & Coordination"
                    subtitle="Active contributors and domain coordinators"
                    emoji="⚙️"
                    accentBorderClass="border-[#b3cde0]"
                    members={filteredSupport}
                    canManage={canManage}
                    onRemove={handleRemove}
                    onEdit={handleEdit}
                  />
                )}

                {filteredVolunteers.length > 0 && (
                  <TeamSection
                    title="Volunteers"
                    subtitle="Event helpers and junior contributors"
                    emoji="🙋"
                    accentBorderClass="border-[#b3cde0]/40"
                    members={filteredVolunteers}
                    canManage={canManage}
                    onRemove={handleRemove}
                    onEdit={handleEdit}
                  />
                )}

                {/* No results for active filter */}
                {roleFilter &&
                  filteredLeadership.length === 0 &&
                  filteredSupport.length === 0 &&
                  filteredVolunteers.length === 0 && (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-2">
                        {CLUB_MEMBER_ROLES[roleFilter].emoji}
                      </div>
                      <p className="text-sm font-semibold text-ev-400">
                        No{" "}
                        <span className="font-bold">
                          {CLUB_MEMBER_ROLES[roleFilter].label}
                        </span>{" "}
                        members yet
                      </p>
                      <button
                        type="button"
                        onClick={() => setRoleFilter(null)}
                        className="mt-2 text-xs text-ev-600 hover:underline"
                      >
                        Clear filter
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* DETAILS TAB                                                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "details" && (
          <div className="space-y-5">
            {/* Governance */}
            <div className="ev-card p-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-ev-900 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-ev-50">
                  <Shield className="w-3.5 h-3.5 text-ev-700" />
                </span>
                Governance &amp; Operations
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoChip
                  icon={<Clock className="w-4 h-4" />}
                  label="Meeting Frequency"
                  value={meetingLabel}
                />
                <InfoChip
                  icon={<Zap className="w-4 h-4" />}
                  label="Annual Activities"
                  value={String(club.estimatedAnnualActivityCount ?? "—")}
                />
                <InfoChip
                  icon={<Target className="w-4 h-4" />}
                  label="Target Group"
                  value={targetGroupLabel}
                />
                {club.expectedStudentStrength && (
                  <InfoChip
                    icon={<Users className="w-4 h-4" />}
                    label="Expected Strength"
                    value={String(club.expectedStudentStrength)}
                  />
                )}
              </div>
            </div>

            {/* Contact & Social */}
            {(club.proposedEmail ||
              (club.socialMediaHandles &&
                Object.keys(club.socialMediaHandles).length > 0)) && (
              <div className="ev-card p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-ev-900 mb-4">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-ev-50">
                    <Mail className="w-3.5 h-3.5 text-ev-600" />
                  </span>
                  Contact &amp; Social
                </h2>
                <div className="space-y-2">
                  {club.proposedEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a
                        href={`mailto:${club.proposedEmail}`}
                        className="text-sm text-ev-600 hover:underline"
                      >
                        {club.proposedEmail}
                      </a>
                    </div>
                  )}
                  {club.socialMediaHandles &&
                    Object.entries(club.socialMediaHandles).map(
                      ([platform, handle]) => (
                        <div key={platform} className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 capitalize w-20">
                            {platform}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {handle}
                          </span>
                        </div>
                      ),
                    )}
                </div>
              </div>
            )}

            {/* Compliance */}
            <div className="ev-card p-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-ev-900 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <Star className="w-3.5 h-3.5 text-emerald-500" />
                </span>
                Compliance
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${club.codeOfConductAccepted ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-500"}`}
                  >
                    {club.codeOfConductAccepted ? "✓" : "✗"}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Code of Conduct Accepted
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${club.antiDiscriminationAccepted ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-500"}`}
                  >
                    {club.antiDiscriminationAccepted ? "✓" : "✗"}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Anti-Discrimination Policy Accepted
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* APPLICATIONS TAB                                                    */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "applications" && canManage && (
          <div className="ev-card p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-ev-900">Club Application Requests</h2>
              <p className="text-xs text-ev-400 mt-0.5">
                Review and accept or reject student join requests.
              </p>
            </div>

            {clubApplications.length === 0 ? (
              <div className="text-center py-12 text-ev-400">
                <div className="text-5xl mb-3">📭</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No application requests yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-ev-400 border-b border-[#b3cde0]">
                      <th className="py-2 pr-3">Student</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Mobile</th>
                      <th className="py-2 pr-3">Program/Course</th>
                      <th className="py-2 pr-3">Applied On</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-0 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clubApplications.map((app) => {
                      const approveId = `${app.id}:approved`;
                      const rejectId = `${app.id}:rejected`;
                      const isPending = app.status === "pending";
                      return (
                        <tr key={app.id} className="border-b border-[#b3cde0]/40">
                          <td className="py-3 pr-3 font-medium text-ev-900">{app.applicantName}</td>
                          <td className="py-3 pr-3 text-ev-700">{app.email || "-"}</td>
                          <td className="py-3 pr-3 text-ev-700">{app.mobileNumber || "-"}</td>
                          <td className="py-3 pr-3 text-ev-700">{[app.program, app.course].filter(Boolean).join(" / ") || "-"}</td>
                          <td className="py-3 pr-3 text-ev-700">{new Date(app.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 pr-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                              app.status === "approved"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : app.status === "rejected"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="py-3 pr-0">
                            {isPending ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReview(app.id, "approved")}
                                  disabled={reviewActionId === approveId || reviewActionId === rejectId}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
                                >
                                  {reviewActionId === approveId ? "Accepting..." : "Accept"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReview(app.id, "rejected")}
                                  disabled={reviewActionId === approveId || reviewActionId === rejectId}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                                >
                                  {reviewActionId === rejectId ? "Rejecting..." : "Reject"}
                                </button>
                              </div>
                            ) : (
                              <p className="text-right text-xs text-ev-400">Reviewed</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* EVENTS TAB                                                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "events" && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                  </span>
                  Club Events
                </h2>
                <p className="text-xs text-ev-400 mt-0.5 ml-9">
                  All events organised by {club.name}
                </p>
              </div>
            </div>

            {eventsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : eventsError ? (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">Failed to load events: {(eventsError as Error)?.message}</p>
              </div>
            ) : clubEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-[#b3cde0] p-14 text-center shadow-ev">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-ev-50 mx-auto mb-4">
                  <CalendarDays className="w-8 h-8 text-ev-400" />
                </div>
                <h3 className="text-base font-bold text-ev-900 mb-1">No events yet</h3>
                <p className="text-sm text-ev-400 max-w-xs mx-auto">
                  Events created from notings linked to this club will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {clubEvents.map((event) => {
                  const isPast = new Date(event.endDate) < new Date();
                  const canManageEvent =
                    isAdminUser ||
                    (!!currentUser?.id && (
                      event.createdById === currentUser.id ||
                      currentUser.id === club?.chairpersonId
                    ));
                  const eventTargetPath = canManageEvent
                    ? `/events/${event.eventId}/management`
                    : `/events/${event.eventId}`;
                  const statusColor =
                    event.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : event.status === "draft" ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
                  return (
                    <div
                      key={event.id}
                      onClick={() => router.push(eventTargetPath)}
                      className="group flex items-center gap-4 bg-white border border-[#b3cde0] rounded-xl p-4 cursor-pointer hover:border-[#6497b1] hover:shadow-ev transition-all"
                    >
                      {/* Date badge */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-ev-50 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-ev-700 uppercase">
                          {new Date(event.startDate).toLocaleString("default", { month: "short" })}
                        </span>
                        <span className="text-sm font-black text-ev-800 leading-none">
                          {new Date(event.startDate).getDate()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{event.name}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
                            {event.status}
                          </span>
                          {isPast && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                              Ended
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          <span className="capitalize">{event.eventType.replace(/_/g, " ")}</span>
                          {event.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.venue}
                            </span>
                          )}
                          <span>
                            {new Date(event.startDate).toLocaleDateString()} –{" "}
                            {new Date(event.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ExternalLink className="w-4 h-4 text-ev-300 group-hover:text-ev-700 transition-colors flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ev-400 mb-1">{label}</label>
      <input
        value={value || "-"}
        readOnly
        className="w-full px-3 py-2 rounded-lg border border-[#b3cde0] bg-ev-50 text-sm text-ev-800"
      />
    </div>
  );
}
