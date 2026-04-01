"use client";

import React, { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  Hash,
  CreditCard,
  Mail,
  Phone,
  User,
  Briefcase,
} from "lucide-react";
import type { Note } from "@/features/noting-management/types/noting.types";

interface NotingCreatorPanelProps {
  note: Note;
  getDisplayName: (
    obj:
      | {
          uid?: string;
          employeeDetails?: {
            displayName?: string;
            firstName?: string;
            lastName?: string;
          };
          studentLogin?: { displayName?: string };
        }
      | null
      | undefined,
  ) => string;
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 min-w-0">
      <Icon className="w-4 h-4 text-[#6497b1] dark:text-[#b3cde0] shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6497b1] dark:text-[#b3cde0]">
          {label}
        </p>
        <div className="text-base font-medium text-[#011f4b] dark:text-white break-words">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function NotingCreatorPanel({
  note,
  getDisplayName,
}: NotingCreatorPanelProps) {
  const [open, setOpen] = useState(false);
  const cb = note.createdBy;
  const name = getDisplayName(cb);
  const emp = cb?.employeeDetails;
  const stud = cb?.studentLogin;

  const department =
    emp?.primaryDepartment?.departmentName ??
    stud?.program?.department?.departmentName ??
    null;

  const schoolOrFaculty =
    emp?.primarySchool?.facultyName ??
    stud?.program?.department?.faculty?.facultyName ??
    null;

  const mobile =
    emp?.phoneNumber?.trim() ||
    cb?.phone?.trim() ||
    stud?.phone?.trim() ||
    null;

  const email =
    (cb?.email && cb.email.trim()) ||
    (emp?.email && emp.email.trim()) ||
    (stud?.email && stud.email.trim()) ||
    null;

  const idLabel = emp?.empId ? "Employee ID" : "Student ID";
  const idValue = emp?.empId ?? stud?.studentId ?? null;

  return (
    <section
      className="bg-white dark:bg-gray-800 rounded-2xl border border-[#b3cde0]/50 dark:border-[#6497b1]/35 overflow-hidden"
      style={{ boxShadow: "0 2px 12px 0 rgba(0, 91, 150, 0.08)" }}
      aria-labelledby="noting-creator-heading"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="noting-creator-details"
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-[#b3cde0]/45 dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-900/30 hover:bg-[#eef4f8] dark:hover:bg-gray-900/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#005b96]/40 focus-visible:ring-inset"
      >
        <div className="flex-1 min-w-0">
          <h2
            id="noting-creator-heading"
            className="text-base font-bold text-[#011f4b] dark:text-white"
          >
            Creator contact
          </h2>
          <p className="text-sm text-[#6497b1] dark:text-gray-400 mt-0.5">
            {open
              ? "Tap to collapse"
              : "Tap to open — phone, email & department"}
          </p>
          {!open && (
            <p className="text-sm font-semibold text-[#03396c] dark:text-gray-200 mt-1.5 truncate">
              {name}
            </p>
          )}
        </div>
        <span className="shrink-0 text-[#005b96] dark:text-[#6497b1] mt-0.5">
          {open ? (
            <ChevronUp className="w-5 h-5" aria-hidden />
          ) : (
            <ChevronDown className="w-5 h-5" aria-hidden />
          )}
        </span>
      </button>

      {open && (
      <div
        id="noting-creator-details"
        className="p-4 sm:p-5 space-y-4 border-b-0"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-[#b3cde0]/35 dark:bg-[#011f4b]/40 flex items-center justify-center text-[#005b96] dark:text-[#b3cde0] font-bold text-base shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-[#011f4b] dark:text-white leading-tight">
              {name}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {cb?.role && (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold uppercase bg-[#b3cde0]/20 dark:bg-gray-700 text-[#03396c] dark:text-gray-300 border border-[#b3cde0]/40">
                  {cb.role}
                </span>
              )}
              {cb?.uid && (
                <span className="text-xs font-mono text-[#6497b1] dark:text-gray-400 bg-[#f8fafc] dark:bg-gray-900/50 px-2 py-0.5 rounded-md border border-[#b3cde0]/30">
                  {cb.uid}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3.5 pt-2 border-t border-[#b3cde0]/40 dark:border-gray-700">
          <Row icon={User} label="Name">
            {name}
          </Row>

          {department && (
            <Row icon={Building2} label="Department">
              {department}
            </Row>
          )}

          {schoolOrFaculty && (
            <Row icon={GraduationCap} label="School / faculty">
              {schoolOrFaculty}
            </Row>
          )}

          {emp?.designation && (
            <Row icon={Briefcase} label="Designation">
              {emp.designation}
            </Row>
          )}

          {stud?.program?.programName && (
            <Row icon={GraduationCap} label="Program">
              {stud.program.programName}
            </Row>
          )}

          {stud?.section?.sectionCode && (
            <Row icon={Hash} label="Section">
              {stud.section.sectionCode}
            </Row>
          )}

          {idValue && (
            <Row icon={CreditCard} label={idLabel}>
              {idValue}
            </Row>
          )}

          <Row icon={Phone} label="Mobile">
            {mobile ? (
              <a
                href={`tel:${mobile.replace(/\s/g, "")}`}
                className="text-[#005b96] dark:text-[#6497b1] hover:underline font-semibold text-base"
              >
                {mobile}
              </a>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </Row>

          <Row icon={Mail} label="Email">
            {email ? (
              <a
                href={`mailto:${email}`}
                className="text-[#005b96] dark:text-[#6497b1] hover:underline font-semibold text-base break-all"
              >
                {email}
              </a>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </Row>

          <Row icon={Clock} label="Submitted">
            {new Date(note.createdAt).toLocaleString()}
          </Row>
        </div>
      </div>
      )}
    </section>
  );
}
