"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Target,
  Shield,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Save,
} from "lucide-react";
import { useClubFormStore, ClubFormData } from "../stores/useClubFormStore";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClubCategory {
  id: string;
  name: string;
  description: string | null;
  icon?: string;
  parentId?: string;
  children?: ClubCategory[];
}

interface PersonSuggestion {
  uid: string;
  id?: string;
  name: string;
  department: string;
  designation: string;
  role: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
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

const MEETING_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-Yearly" },
  { value: "annually", label: "Annually" },
  { value: "event_based", label: "Event-Based" },
];

const TARGET_GROUPS = [
  { value: "all", label: "All Students" },
  { value: "ug", label: "UG" },
  { value: "pg", label: "PG" },
  { value: "phd", label: "PhD" },
];

const STEPS = [
  { num: 1, title: "Club Details", icon: Target },
  { num: 2, title: "People & Operations", icon: Users },
  { num: 3, title: "Declarations", icon: Shield },
];

// ─── Validation Helpers ───────────────────────────────────────────────────────
/** Strip anything that isn't a printable text character (keeps letters, spaces, punctuation) */
const sanitizeText = (val: string) => val.replace(/[^\w\s.,\-'&()/:]/g, "");

/** Only allow numeric digits */
const sanitizePositiveInt = (val: string) => val.replace(/[^0-9]/g, "");

/** Only allow characters valid in an email */
const sanitizeEmail = (val: string) => val.replace(/[^a-zA-Z0-9._%+\-@]/g, "");

/** Allow alphanumeric + common handle chars for social media */
const sanitizeSocialHandle = (val: string) =>
  val.replace(/[^a-zA-Z0-9._\-@/https:]/g, "");

/** Allow alphanumeric + slash for academic session format e.g. 2025-26 or 2025-2026 */
const sanitizeSession = (val: string) => val.replace(/[^0-9\-/]/g, "");

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

const isValidAcademicSession = (session: string) =>
  /^\d{4}[-/]\d{2,4}$/.test(session.trim());

// ─── Error Field Component ─────────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {msg}
    </p>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClubCreationForm({ disabled }: { disabled?: boolean }) {
  const value = useClubFormStore((state) => state.data);
  const setField = useClubFormStore((state) => state.setField);

  // ── Persisted UI state (lives in Zustand + sessionStorage, survives refresh) ──
  const currentStep = useClubFormStore((state) => state.currentStep);
  const setCurrentStep = useClubFormStore((state) => state.setCurrentStep);
  const selectedMainCategory = useClubFormStore(
    (state) => state.selectedMainCategory,
  );
  const setSelectedMainCategory = useClubFormStore(
    (state) => state.setSelectedMainCategory,
  );

  const [mainCategories, setMainCategories] = useState<ClubCategory[]>([]);
  const [subCategories, setSubCategories] = useState<ClubCategory[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name?: string;
    uid?: string;
  } | null>(null);

  // Search states
  const [facultyQuery, setFacultyQuery] = useState("");
  const [facultyResults, setFacultyResults] = useState<PersonSuggestion[]>([]);
  const [facultyLoading, setFacultyLoading] = useState(false);

  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<PersonSuggestion[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);

  // ── Load categories ──
  // Auto-fetch current logged-in user for Chairperson display
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth-storage");
      if (raw) {
        const parsed = JSON.parse(raw);
        const user = parsed?.state?.user;
        if (user) {
          const fullName =
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.username ||
            "Current User";
          setCurrentUser({
            id: user.id,
            name: fullName,
            uid: user.uid || user.username,
          });
        }
      }
    } catch (_) { }
  }, []);

  useEffect(() => {
    fetch("/api/v1/dsw/categories?hierarchical=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setMainCategories(
            data.data.filter(
              (c: ClubCategory) => !c.parentId || c.children?.length,
            ),
          );
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedMainCategory) {
      const mc = mainCategories.find((c) => c.id === selectedMainCategory);
      setSubCategories(mc?.children || []);
    } else {
      setSubCategories([]);
    }
  }, [selectedMainCategory, mainCategories]);

  // ── Field updater ──
  const set = useCallback(
    <K extends keyof ClubFormData>(field: K, val: ClubFormData[K]) => {
      setField(field, val);
      setErrors((prev) => {
        const e = { ...prev };
        delete e[field];
        return e;
      });
    },
    [setField],
  );

  const addError = (field: string, msg: string) =>
    setErrors((prev) => ({ ...prev, [field]: msg }));

  // ── Step validation ──
  const validateStep = (step: number): boolean => {
    const errs: Record<string, string> = {};

    if (step === 1) {
      if (!value.clubName?.trim()) errs.clubName = "Club name is required";
      else if (value.clubName.trim().length < 3)
        errs.clubName = "Club name must be at least 3 characters";
      else if (value.clubName.trim().length > 100)
        errs.clubName = "Club name must not exceed 100 characters";

      if (!value.clubCategoryId)
        errs.clubCategoryId = "Please select a specific club category";

      if (!value.purpose?.trim()) errs.purpose = "Purpose is required";
      else if (value.purpose.trim().length < 50)
        errs.purpose = `Purpose must be at least 50 characters (currently ${value.purpose.trim().length})`;
      else if (value.purpose.trim().length > 2000)
        errs.purpose = "Purpose must not exceed 2000 characters";

      if (!value.academicSession?.trim())
        errs.academicSession = "Academic session is required";
      else if (!isValidAcademicSession(value.academicSession))
        errs.academicSession =
          "Format must be YYYY-YY or YYYY-YYYY (e.g. 2025-26 or 2025-2026)";

      if (!value.targetStudentGroup?.length)
        errs.targetStudentGroup = "Select at least one target group";

      if (!value.expectedActivityTypes?.length)
        errs.expectedActivityTypes = "Select at least one activity type";
    }

    if (step === 2) {
      if (!value.facultyFacilitatorId)
        errs.facultyFacilitatorId = "Faculty Facilitator is required";

      if (!value.initialMembers?.length)
        errs.initialMembers = "Add at least one initial member";
      else if (value.initialMembers.length > 50)
        errs.initialMembers = "Cannot add more than 50 initial members";

      if (!value.meetingFrequency)
        errs.meetingFrequency = "Meeting frequency is required";

      const count = value.estimatedAnnualActivityCount ?? 0;
      if (!count || count < 1)
        errs.estimatedAnnualActivityCount =
          "Must be at least 1 activity per year";
      else if (count > 365)
        errs.estimatedAnnualActivityCount =
          "Cannot exceed 365 activities per year";

      const strength = value.expectedStudentStrength;
      if (strength !== null && strength !== undefined && strength < 2)
        errs.expectedStudentStrength =
          "If provided, must be at least 2 students";
      if (strength !== null && strength !== undefined && strength > 10000)
        errs.expectedStudentStrength = "Cannot exceed 10,000 students";
    }

    if (step === 3) {
      if (!value.codeOfConductAccepted)
        errs.codeOfConductAccepted = "You must accept the Code of Conduct";
      if (!value.antiDiscriminationAccepted)
        errs.antiDiscriminationAccepted =
          "You must accept the Anti-Discrimination declaration";

      if (
        value.proposedEmail?.trim() &&
        !isValidEmail(value.proposedEmail.trim())
      )
        errs.proposedEmail =
          "Enter a valid email address (e.g. club@sgtuniversity.org)";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) setCurrentStep((p) => Math.min(3, p + 1));
  };
  const handlePrev = () => {
    setErrors({});
    setCurrentStep((p) => Math.max(1, p - 1));
  };

  const toggle = (arr: string[] | undefined, item: string) => {
    const cur = arr || [];
    return cur.includes(item) ? cur.filter((i) => i !== item) : [...cur, item];
  };

  // ── Search utilities ──
  const searchPeople = async (
    query: string,
    role: "faculty" | "student",
    setResults: (r: PersonSuggestion[]) => void,
    setLoading: (b: boolean) => void,
  ) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/users/suggestions/${encodeURIComponent(query)}?role=${role}`,
      );
      const data = await res.json();
      if (data.success) setResults(data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const t = setTimeout(
      () =>
        searchPeople(
          facultyQuery,
          "faculty",
          setFacultyResults,
          setFacultyLoading,
        ),
      300,
    );
    return () => clearTimeout(t);
  }, [facultyQuery]);

  useEffect(() => {
    const t = setTimeout(
      () =>
        searchPeople(
          memberQuery,
          "student",
          setMemberResults,
          setMemberLoading,
        ),
      300,
    );
    return () => clearTimeout(t);
  }, [memberQuery]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* ── Step Header ── */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        {/* Draft auto-saved badge */}
        <div className="flex justify-end mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-medium">
            <Save className="w-3 h-3" />
            Draft auto-saved
          </span>
        </div>
        <div className="flex items-center justify-center gap-0">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const active = currentStep === step.num;
            const done = currentStep > step.num;
            return (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center min-w-[72px]">
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center
                    ${done ? "bg-green-500 border-green-500" : active ? "bg-white border-white text-blue-600" : "bg-blue-500 border-blue-400 opacity-50 text-white"}`}
                  >
                    {done ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`text-[11px] mt-1 text-center leading-tight ${active ? "text-white font-semibold" : "text-white/55"}`}
                  >
                    {step.title}
                  </span>
                </div>
                {step.num < 3 && (
                  <div
                    className={`w-14 h-0.5 mx-1 mb-4 ${done ? "bg-green-400" : "bg-blue-400 opacity-30"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Form Body ── */}
      <div className="p-6 space-y-5">
        {/* ════════════ STEP 1 – Club Details ════════════ */}
        {currentStep === 1 && (
          <>
            {/* Club Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Club Name <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-2">
                  (letters, numbers, spaces, punctuation only)
                </span>
              </label>
              <input
                type="text"
                maxLength={100}
                value={value.clubName || ""}
                onChange={(e) => set("clubName", sanitizeText(e.target.value))}
                disabled={disabled}
                className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.clubName ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                placeholder="Enter club name (unique, max 100 chars)"
              />
              <div className="flex justify-between items-start mt-0.5">
                <FieldError msg={errors.clubName} />
                <span className="text-xs text-gray-400 ml-auto">
                  {(value.clubName || "").length}/100
                </span>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Club Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Main Category
                  </label>
                  <select
                    value={selectedMainCategory}
                    onChange={(e) => {
                      setSelectedMainCategory(e.target.value);
                      set("clubCategoryId", "");
                    }}
                    disabled={disabled}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select main category…</option>
                    {mainCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedMainCategory && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Specific Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={value.clubCategoryId || ""}
                      onChange={(e) => set("clubCategoryId", e.target.value)}
                      disabled={disabled}
                      className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 ${errors.clubCategoryId ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                    >
                      <option value="">Select specific type…</option>
                      {subCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon ? `${c.icon} ` : ""}
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <FieldError msg={errors.clubCategoryId} />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purpose / Objective <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-2">
                  (50–2000 chars)
                </span>
              </label>
              <textarea
                value={value.purpose || ""}
                onChange={(e) => set("purpose", sanitizeText(e.target.value))}
                disabled={disabled}
                maxLength={2000}
                rows={4}
                className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 resize-y ${errors.purpose ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                placeholder="Describe the club's purpose and objectives (minimum 50 characters)…"
              />
              <div className="flex justify-between items-start mt-0.5">
                <FieldError msg={errors.purpose} />
                <span
                  className={`text-xs ml-auto ${(value.purpose?.length || 0) < 50 ? "text-orange-500" : "text-gray-400"}`}
                >
                  {value.purpose?.length || 0}/2000
                </span>
              </div>
            </div>

            {/* Academic Session */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Academic Session <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-2">
                  (YYYY-YY or YYYY-YYYY)
                </span>
              </label>
              <input
                type="text"
                maxLength={9}
                value={value.academicSession || ""}
                onChange={(e) =>
                  set("academicSession", sanitizeSession(e.target.value))
                }
                disabled={disabled}
                className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 ${errors.academicSession ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                placeholder="e.g. 2025-26"
              />
              <FieldError msg={errors.academicSession} />
            </div>

            {/* Target Group */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Student Group <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-2">
                  (select one or more)
                </span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TARGET_GROUPS.map((opt) => {
                  const checked = (value.targetStudentGroup || []).includes(
                    opt.value,
                  );
                  return (
                    <label
                      key={opt.value}
                      className={`cursor-pointer border-2 rounded-lg p-2 text-center text-sm select-none transition-colors ${checked ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-gray-300 dark:border-gray-600 hover:border-blue-300"}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        value={opt.value}
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          set(
                            "targetStudentGroup",
                            toggle(value.targetStudentGroup, opt.value),
                          )
                        }
                      />
                      <span className="font-medium">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
              <FieldError msg={errors.targetStudentGroup} />
            </div>

            {/* Activity Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expected Activity Types <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-2">
                  (select one or more)
                </span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ACTIVITY_TYPES.map((a) => {
                  const checked = (value.expectedActivityTypes || []).includes(
                    a,
                  );
                  return (
                    <label
                      key={a}
                      className={`flex items-center gap-1.5 p-2 border rounded-lg cursor-pointer text-sm select-none transition-colors ${checked ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-600 hover:border-blue-300"}`}
                    >
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded accent-blue-600"
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          set(
                            "expectedActivityTypes",
                            toggle(value.expectedActivityTypes, a),
                          )
                        }
                      />
                      <span>{a}</span>
                    </label>
                  );
                })}
              </div>
              <FieldError msg={errors.expectedActivityTypes} />
            </div>
          </>
        )}

        {/* ════════════ STEP 2 – People & Operations ════════════ */}
        {currentStep === 2 && (
          <>
            {/* Chairperson – auto-assigned read-only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Club Chairperson{" "}
                <span className="text-xs font-normal text-gray-400">
                  (you — auto-assigned as the club head)
                </span>
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm flex-shrink-0">
                  {currentUser?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {currentUser?.name || "Loading…"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {currentUser?.uid || currentUser?.id || ""} · Club
                    Chairperson
                  </p>
                </div>
                <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  Chairperson
                </span>
              </div>
            </div>

            {/* Faculty Facilitator */}
            <SearchField
              label="Faculty Facilitator"
              required
              selectedId={value.facultyFacilitatorId}
              selectedLabel="Faculty Facilitator"
              onClear={() => {
                set("facultyFacilitatorId", "");
                setFacultyQuery("");
                setFacultyResults([]);
              }}
              query={facultyQuery}
              onQueryChange={setFacultyQuery}
              results={facultyResults}
              loading={facultyLoading}
              onSelect={(p) => {
                set("facultyFacilitatorId", p.uid);
                setFacultyQuery("");
                setFacultyResults([]);
              }}
              error={errors.facultyFacilitatorId}
              placeholder="Search by Faculty ID or name…"
              disabled={disabled}
            />

            {/* Initial Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Club Members <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-2">
                  ({(value.initialMembers || []).length}/50 added)
                </span>
              </label>

              {/* Added members list */}
              {(value.initialMembers || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(value.initialMembers || []).map((id, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-full text-xs text-blue-800 dark:text-blue-200"
                    >
                      {id}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          set(
                            "initialMembers",
                            (value.initialMembers || []).filter(
                              (_, j) => j !== i,
                            ),
                          )
                        }
                        className="text-blue-500 hover:text-red-500 leading-none"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Member search */}
              {(value.initialMembers || []).length < 50 && (
                <div className="relative">
                  <input
                    type="text"
                    value={memberQuery}
                    onChange={(e) =>
                      setMemberQuery(sanitizeText(e.target.value))
                    }
                    disabled={disabled}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 ${errors.initialMembers ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                    placeholder="Search students to add as members…"
                  />
                  {memberLoading && (
                    <Dropdown>
                      <div className="p-3 space-y-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
                      </div>
                    </Dropdown>
                  )}
                  {memberResults.length > 0 && (
                    <Dropdown>
                      {memberResults.map((s) => {
                        const already = (value.initialMembers || []).includes(
                          s.uid,
                        );
                        const isChairperson =
                          currentUser?.uid === s.uid ||
                          currentUser?.id === s.uid;

                        if (isChairperson) return null;

                        return (
                          <button
                            key={s.uid}
                            type="button"
                            disabled={disabled || already}
                            onClick={() => {
                              if (!already) {
                                set("initialMembers", [
                                  ...(value.initialMembers || []),
                                  s.uid,
                                ]);
                                setMemberQuery("");
                                setMemberResults([]);
                              }
                            }}
                            className={`w-full text-left px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0 ${already ? "opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-700/40" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {s.name}{" "}
                              {already && (
                                <span className="text-xs text-gray-400">
                                  (already added)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {s.uid} · {s.department}
                            </p>
                          </button>
                        );
                      })}
                    </Dropdown>
                  )}
                </div>
              )}
              <FieldError msg={errors.initialMembers} />
            </div>

            {/* Meeting Frequency + Numbers side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Meeting Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Meeting Frequency <span className="text-red-500">*</span>
                </label>
                <div className="space-y-1.5">
                  {MEETING_FREQUENCIES.map((f) => (
                    <label
                      key={f.value}
                      className={`flex items-center gap-2.5 px-3 py-2 border-2 rounded-lg cursor-pointer text-sm select-none transition-colors ${value.meetingFrequency === f.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-600 hover:border-blue-300"}`}
                    >
                      <input
                        type="radio"
                        name="freq"
                        value={f.value}
                        className="accent-blue-600"
                        disabled={disabled}
                        checked={value.meetingFrequency === f.value}
                        onChange={() =>
                          set(
                            "meetingFrequency",
                            f.value as ClubFormData["meetingFrequency"],
                          )
                        }
                      />
                      <span className="font-medium">{f.label}</span>
                    </label>
                  ))}
                </div>
                <FieldError msg={errors.meetingFrequency} />
              </div>

              {/* Numeric fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estimated Annual Activities{" "}
                    <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      (1–365, numbers only)
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={3}
                    value={value.estimatedAnnualActivityCount || ""}
                    onChange={(e) => {
                      const raw = sanitizePositiveInt(e.target.value);
                      if (raw === "") {
                        set("estimatedAnnualActivityCount", 0);
                        return;
                      }
                      const n = Math.min(365, Math.max(0, parseInt(raw)));
                      set("estimatedAnnualActivityCount", n);
                    }}
                    disabled={disabled}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 ${errors.estimatedAnnualActivityCount ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                    placeholder="e.g. 12"
                  />
                  <FieldError msg={errors.estimatedAnnualActivityCount} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expected Student Strength
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      (optional, numbers only)
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={5}
                    value={value.expectedStudentStrength ?? ""}
                    onChange={(e) => {
                      const raw = sanitizePositiveInt(e.target.value);
                      if (raw === "") {
                        set("expectedStudentStrength", null);
                        return;
                      }
                      const n = Math.min(10000, parseInt(raw));
                      set("expectedStudentStrength", n);
                    }}
                    disabled={disabled}
                    className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 ${errors.expectedStudentStrength ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                    placeholder="Approximate members"
                  />
                  <FieldError msg={errors.expectedStudentStrength} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════ STEP 3 – Declarations ════════════ */}
        {currentStep === 3 && (
          <>
            {/* Declarations */}
            <div
              className={`rounded-lg border p-4 space-y-4 ${errors.codeOfConductAccepted || errors.antiDiscriminationAccepted ? "border-red-300 bg-red-50 dark:bg-red-900/10" : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"}`}
            >
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Required Declarations
              </h4>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={value.codeOfConductAccepted || false}
                  disabled={disabled}
                  onChange={(e) =>
                    set("codeOfConductAccepted", e.target.checked)
                  }
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Code of Conduct <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    I declare that all club activities will adhere to the
                    university&apos;s code of conduct and disciplinary
                    guidelines.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={value.antiDiscriminationAccepted || false}
                  disabled={disabled}
                  onChange={(e) =>
                    set("antiDiscriminationAccepted", e.target.checked)
                  }
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Anti-Discrimination Declaration{" "}
                    <span className="text-red-500">*</span>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    I declare this club will not discriminate based on race,
                    religion, gender, caste, or any other protected
                    characteristic.
                  </p>
                </div>
              </label>

              {(errors.codeOfConductAccepted ||
                errors.antiDiscriminationAccepted) && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Both declarations must
                    be accepted to submit.
                  </p>
                )}
            </div>

            {/* Optional */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Optional Information
              </h4>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proposed Club Email
                  <span className="text-gray-400 font-normal ml-1">
                    (valid email format only)
                  </span>
                </label>
                <input
                  type="email"
                  value={value.proposedEmail || ""}
                  onChange={(e) =>
                    set("proposedEmail", sanitizeEmail(e.target.value))
                  }
                  disabled={disabled}
                  maxLength={100}
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 ${errors.proposedEmail ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
                  placeholder="club@sgtuniversity.org"
                />
                <FieldError msg={errors.proposedEmail} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Social Media Handles
                  <span className="text-gray-400 font-normal ml-1">
                    (handles / URLs only)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    ["facebook", "instagram", "twitter", "linkedin"] as const
                  ).map((p) => (
                    <input
                      key={p}
                      type="text"
                      maxLength={100}
                      value={value.socialMediaHandles?.[p] || ""}
                      onChange={(e) =>
                        set("socialMediaHandles", {
                          ...value.socialMediaHandles,
                          [p]: sanitizeSocialHandle(e.target.value),
                        })
                      }
                      disabled={disabled}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder={p.charAt(0).toUpperCase() + p.slice(1)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-2.5">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Club Name, Category, Purpose and Academic
                Session are <strong>immutable after approval</strong>. Changes
                require a new noting request.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentStep === 1 || disabled}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        <span className="text-xs text-gray-500">Step {currentStep} of 3</span>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentStep === 3 || disabled}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Small Sub-Components ─────────────────────────────────────────────────────

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
      {children}
    </div>
  );
}

interface SearchFieldProps {
  label: string;
  required?: boolean;
  selectedId?: string;
  selectedLabel: string;
  onClear: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: PersonSuggestion[];
  loading: boolean;
  onSelect: (p: PersonSuggestion) => void;
  error?: string;
  placeholder: string;
  disabled?: boolean;
}

function SearchField({
  label,
  required,
  selectedId,
  selectedLabel,
  onClear,
  query,
  onQueryChange,
  results,
  loading,
  onSelect,
  error,
  placeholder,
  disabled,
}: SearchFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {selectedId ? (
        <div
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${error ? "border-red-300" : "border-green-300 dark:border-green-700"} bg-green-50 dark:bg-green-900/20`}
        >
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedId}
            </p>
            <p className="text-xs text-gray-500">{selectedLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(sanitizeText(e.target.value))}
            disabled={disabled}
            className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 pr-10 ${error ? "border-red-400" : "border-gray-300 dark:border-gray-600"}`}
            placeholder={placeholder}
          />
          {loading && (
            <Dropdown>
              <div className="p-3 space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse" />
              </div>
            </Dropdown>
          )}
          {results.length > 0 && (
            <Dropdown>
              {results.map((p) => (
                <button
                  key={p.uid}
                  type="button"
                  onClick={() => onSelect(p)}
                  disabled={disabled}
                  className="w-full text-left px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.uid} · {p.department} · {p.designation}
                  </p>
                </button>
              ))}
            </Dropdown>
          )}
        </div>
      )}
      <FieldError msg={error} />
    </div>
  );
}
