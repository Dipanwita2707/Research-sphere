"use client";

import React from "react";
import {
  Target,
  Users,
  Shield,
  CheckCircle2,
  XCircle,
  Mail,
  Globe,
  Calendar,
  Hash,
  UserCheck,
  Briefcase,
} from "lucide-react";

// ─── Constants (shared with ClubCreationForm) ─────────────────────────────────
const ACTIVITY_TYPES = [
  "Events",
  "Workshops",
  "Competitions",
  "Awareness Drives",
  "Collaborations",
  "Cultural Programs",
  "Technical Talks",
  "Community Service",
];

const MEETING_FREQUENCIES: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-Yearly",
  annually: "Annually",
  event_based: "Event-Based",
};

const TARGET_GROUPS: Record<string, string> = {
  all: "All Students",
  ug: "UG",
  pg: "PG",
  phd: "PhD",
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ClubDetailsData {
  clubName?: string | null;
  clubCategoryId?: string | null;
  clubPurpose?: string | null;
  clubAcademicSession?: string | null;
  clubTargetStudentGroup?: string[];
  clubMeetingFrequency?: string | null;
  clubExpectedActivityTypes?: string[];
  clubEstimatedAnnualActivityCount?: number | null;
  clubExpectedStudentStrength?: number | null;
  clubFacultyFacilitatorId?: string | null;
  clubChairpersonId?: string | null;
  clubInitialMembers?: string[];
  clubProposedEmail?: string | null;
  clubSocialMediaHandles?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  } | null;
  clubCodeOfConductAccepted?: boolean | null;
  clubAntiDiscriminationAccepted?: boolean | null;
}

export interface ResolvedClubDetails {
  categoryName: string | null;
  parentCategoryName: string | null;
  facultyFacilitator: {
    id: string;
    uid: string;
    name: string;
    department?: string | null;
    designation?: string | null;
  } | null;
  chairperson: {
    id: string;
    uid: string;
    name: string;
    department?: string | null;
    program?: string | null;
  } | null;
  members: { id: string; uid: string; name: string }[];
}

export interface ClubDetailsCardProps {
  mode: "edit" | "view";
  data: ClubDetailsData;
  resolvedDetails?: ResolvedClubDetails | null;
}

// ─── Helper: "Not Provided" fallback ──────────────────────────────────────────
function NotProvided() {
  return (
    <span className="text-ev-400 italic text-sm">
      Not Provided
    </span>
  );
}

// ─── Helper: Section Header ───────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  stepNum,
}: {
  icon: React.ElementType;
  title: string;
  stepNum: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#b3cde0]">
      <div className="w-8 h-8 rounded-lg bg-ev-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-ev-700" />
      </div>
      <div>
        <p className="text-xs text-ev-400 font-medium uppercase tracking-wider">
          Section {stepNum}
        </p>
        <h4 className="text-sm font-semibold text-ev-900 leading-tight">{title}</h4>
      </div>
    </div>
  );
}

// ─── Helper: Field Row ────────────────────────────────────────────────────────
function FieldRow({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="py-3 first:pt-0">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ev-400 uppercase tracking-wider mb-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

// ─── Helper: Chip ─────────────────────────────────────────────────────────────
function Chip({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
        active
          ? "bg-ev-50 text-ev-700 border border-[#b3cde0]"
          : "bg-ev-50 text-ev-400 border border-[#b3cde0]/60"
      }`}
    >
      {label}
    </span>
  );
}

// ─── Helper: Boolean Indicator ────────────────────────────────────────────────
function BooleanIndicator({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
}) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="w-4 h-4" />
        <span className="font-medium">{trueLabel || "Accepted"}</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
        <XCircle className="w-4 h-4" />
        <span className="font-medium">{falseLabel || "Not Accepted"}</span>
      </span>
    );
  }
  return <NotProvided />;
}

// ─── Helper: Person Card ──────────────────────────────────────────────────────
function PersonCard({
  name,
  uid,
  role,
  department,
  extra,
}: {
  name: string;
  uid: string;
  role: string;
  department?: string | null;
  extra?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-ev-50 border border-[#b3cde0] rounded-lg">
      <div className="w-8 h-8 rounded-full bg-white border border-[#b3cde0] flex items-center justify-center text-ev-700 font-bold text-xs flex-shrink-0">
        {name?.charAt(0)?.toUpperCase() || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ev-900 truncate">{name}</p>
        <p className="text-xs text-ev-400 truncate">
          {uid}
          {department ? ` \u00b7 ${department}` : ""}
          {extra ? ` \u00b7 ${extra}` : ""}
        </p>
      </div>
      <span className="text-[10px] bg-white border border-[#b3cde0] text-ev-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0 whitespace-nowrap">
        {role}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ClubDetailsCard({
  mode,
  data,
  resolvedDetails,
}: ClubDetailsCardProps) {
  const isView = mode === "view";

  const socialHandles = data.clubSocialMediaHandles;
  const hasSocialMedia =
    socialHandles &&
    (socialHandles.facebook ||
      socialHandles.instagram ||
      socialHandles.twitter ||
      socialHandles.linkedin);

  return (
    <div className="space-y-4">
      {/* ════════════ SECTION 1 — Club Details ════════════ */}
      <div className="ev-card p-5">
        <SectionHeader icon={Target} title="Club Details" stepNum={1} />

        <div className="space-y-0 divide-y divide-[#edf4f8]">
          {/* Club Name */}
          <FieldRow label="Club Name">
            {data.clubName ? (
              <p className="text-base font-semibold text-ev-900">{data.clubName}</p>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Category */}
          <FieldRow label="Club Category">
            {resolvedDetails?.categoryName ? (
              <div className="flex items-center gap-2 flex-wrap">
                {resolvedDetails.parentCategoryName && (
                  <>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-ev-50 text-ev-700 border border-[#b3cde0]">
                      {resolvedDetails.parentCategoryName}
                    </span>
                    <span className="text-ev-400 text-xs">→</span>
                  </>
                )}
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-ev-50 text-ev-700 border border-[#b3cde0]">
                  {resolvedDetails.categoryName}
                </span>
              </div>
            ) : data.clubCategoryId ? (
              <span className="text-sm text-ev-800">{data.clubCategoryId}</span>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Purpose */}
          <FieldRow label="Purpose / Objective">
            {data.clubPurpose ? (
              <div className="bg-ev-50 px-3 py-2.5 rounded-md border border-[#b3cde0]">
                <p className="text-sm text-ev-800 whitespace-pre-wrap leading-relaxed">
                  {data.clubPurpose}
                </p>
              </div>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Academic Session */}
          <FieldRow label="Academic Session" icon={Calendar}>
            {data.clubAcademicSession ? (
              <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-amber-50 text-amber-800 border border-amber-200">
                {data.clubAcademicSession}
              </span>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Target Student Group */}
          <FieldRow label="Target Student Group">
            {data.clubTargetStudentGroup &&
            data.clubTargetStudentGroup.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TARGET_GROUPS) as string[]).map((key) => {
                  const isSelected = data.clubTargetStudentGroup!.includes(key);
                  return (
                    <Chip
                      key={key}
                      label={TARGET_GROUPS[key]}
                      active={isSelected}
                    />
                  );
                })}
              </div>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Expected Activity Types */}
          <FieldRow label="Expected Activity Types">
            {data.clubExpectedActivityTypes &&
            data.clubExpectedActivityTypes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_TYPES.map((activity) => {
                  const isSelected =
                    data.clubExpectedActivityTypes!.includes(activity);
                  return (
                    <Chip key={activity} label={activity} active={isSelected} />
                  );
                })}
              </div>
            ) : (
              <NotProvided />
            )}
          </FieldRow>
        </div>
      </div>

      {/* ════════════ SECTION 2 — People & Operations ════════════ */}
      <div className="ev-card p-5">
        <SectionHeader icon={Users} title="People & Operations" stepNum={2} />

        <div className="space-y-0 divide-y divide-[#edf4f8]">
          {/* Chairperson */}
          <FieldRow label="Club Chairperson" icon={UserCheck}>
            {resolvedDetails?.chairperson ? (
              <PersonCard
                name={resolvedDetails.chairperson.name}
                uid={resolvedDetails.chairperson.uid}
                role="Chairperson"
                department={resolvedDetails.chairperson.department}
                extra={resolvedDetails.chairperson.program}
              />
            ) : data.clubChairpersonId ? (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                ID: {data.clubChairpersonId}
              </span>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Faculty Facilitator */}
          <FieldRow label="Faculty Facilitator" icon={Briefcase}>
            {resolvedDetails?.facultyFacilitator ? (
              <PersonCard
                name={resolvedDetails.facultyFacilitator.name}
                uid={resolvedDetails.facultyFacilitator.uid}
                role="Facilitator"
                department={resolvedDetails.facultyFacilitator.department}
                extra={resolvedDetails.facultyFacilitator.designation}
              />
            ) : data.clubFacultyFacilitatorId ? (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                ID: {data.clubFacultyFacilitatorId}
              </span>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Initial Members */}
          <FieldRow label="Initial Club Members">
            {resolvedDetails?.members && resolvedDetails.members.length > 0 ? (
              <div>
                <p className="text-xs text-ev-400 mb-2">
                  <span className="font-semibold text-ev-800">{resolvedDetails.members.length}</span>{" "}
                  member{resolvedDetails.members.length !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resolvedDetails.members.map((m) => (
                    <span
                      key={m.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-ev-50 border border-[#b3cde0] rounded-full text-xs text-ev-800"
                        title={`${m.name} (${m.uid})`}
                      >
                        <span className="w-4 h-4 rounded-full bg-ev-200 flex items-center justify-center text-[9px] font-bold text-ev-800 flex-shrink-0">
                          {m.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                        <span className="font-medium truncate max-w-[120px]">{m.name}</span>
                        <span className="text-ev-400 text-[10px]">({m.uid})</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : data.clubInitialMembers &&
              data.clubInitialMembers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.clubInitialMembers.map((uid, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 bg-ev-50 border border-[#b3cde0] rounded-full text-xs text-ev-800"
                  >
                    {uid}
                  </span>
                ))}
              </div>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Meeting Frequency */}
          <FieldRow label="Meeting Frequency">
            {data.clubMeetingFrequency ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MEETING_FREQUENCIES).map(([key, label]) => {
                  const isSelected = data.clubMeetingFrequency === key;
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-colors ${
                        isSelected
                          ? "border-[#005b96] bg-ev-50 text-ev-700"
                          : "border-[#b3cde0] text-ev-400 bg-ev-50"
                      }`}
                    >
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-ev-700 mr-1.5" />
                      )}
                      {label}
                    </span>
                  );
                })}
              </div>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Numeric fields side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3">
            {/* Estimated Annual Activities */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ev-400 uppercase tracking-wider mb-1.5">
                <Hash className="w-3 h-3" />
                Estimated Annual Activities
              </label>
              {data.clubEstimatedAnnualActivityCount != null &&
              data.clubEstimatedAnnualActivityCount > 0 ? (
                <p className="text-lg font-bold text-ev-900">
                  {data.clubEstimatedAnnualActivityCount}
                  <span className="text-xs font-normal text-ev-400 ml-1">per year</span>
                </p>
              ) : (
                <NotProvided />
              )}
            </div>

            {/* Expected Student Strength */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ev-400 uppercase tracking-wider mb-1.5">
                <Users className="w-3 h-3" />
                Expected Student Strength
              </label>
              {data.clubExpectedStudentStrength != null &&
              data.clubExpectedStudentStrength > 0 ? (
                <p className="text-lg font-bold text-ev-900">
                  {data.clubExpectedStudentStrength}
                  <span className="text-xs font-normal text-ev-400 ml-1">students</span>
                </p>
              ) : (
                <NotProvided />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ SECTION 3 — Declarations & Contact ════════════ */}
      <div className="ev-card p-5">
        <SectionHeader icon={Shield} title="Declarations & Contact" stepNum={3} />

        <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700/50">
          {/* Declarations */}
          <div className="py-3 first:pt-0">
            <label className="text-[11px] font-semibold text-ev-400 uppercase tracking-wider mb-3 block">
              Required Declarations
            </label>
            <div className="space-y-3">
              <div className="flex items-start gap-3 px-3 py-2.5 bg-ev-50 rounded-lg border border-[#b3cde0]">
                <BooleanIndicator value={data.clubCodeOfConductAccepted} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ev-900">Code of Conduct</p>
                  <p className="text-xs text-ev-400 mt-0.5">
                    All club activities will adhere to the university&apos;s code
                    of conduct and disciplinary guidelines.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 px-3 py-2.5 bg-ev-50 rounded-lg border border-[#b3cde0]">
                <BooleanIndicator value={data.clubAntiDiscriminationAccepted} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ev-900">Anti-Discrimination Declaration</p>
                  <p className="text-xs text-ev-400 mt-0.5">
                    This club will not discriminate based on race, religion,
                    gender, caste, or any other protected characteristic.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Proposed Email */}
          <FieldRow label="Proposed Club Email" icon={Mail}>
            {data.clubProposedEmail ? (
              <span className="text-sm text-ev-700 font-medium">
                {data.clubProposedEmail}
              </span>
            ) : (
              <NotProvided />
            )}
          </FieldRow>

          {/* Social Media */}
          <FieldRow label="Social Media Handles" icon={Globe}>
            {hasSocialMedia ? (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: "facebook" as const, label: "Facebook" },
                    { key: "instagram" as const, label: "Instagram" },
                    { key: "twitter" as const, label: "Twitter / X" },
                    { key: "linkedin" as const, label: "LinkedIn" },
                  ] as const
                ).map(({ key, label }) => {
                  const val = socialHandles?.[key];
                  if (!val) return null;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-ev-50 rounded-md border border-[#b3cde0]"
                    >
                      <span className="text-[10px] font-semibold text-ev-400 uppercase w-16 flex-shrink-0">
                        {label}
                      </span>
                      <span className="text-sm text-ev-800 truncate">{val}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <NotProvided />
            )}
          </FieldRow>
        </div>
      </div>
    </div>
  );
}
