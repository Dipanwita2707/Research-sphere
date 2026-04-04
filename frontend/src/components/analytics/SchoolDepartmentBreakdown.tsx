'use client';

import React from 'react';
import { Building2, GraduationCap, ChevronRight } from 'lucide-react';

export interface SchoolBreakdownRow {
  schoolId: string;
  schoolName: string;
  totalApplications: number;
  totalApproved: number;
  totalIncentive: number;
  departments?: DepartmentBreakdownRow[];
}

export interface DepartmentBreakdownRow {
  departmentId: string;
  departmentName: string;
  schoolId?: string;
  schoolName?: string;
  totalApplicants?: number;
  totalApplications: number;
  totalApproved: number;
  totalIncentive: number;
}

interface Props {
  schoolWise: SchoolBreakdownRow[];
  departmentWise: DepartmentBreakdownRow[];
  onSchoolClick?: (schoolId: string) => void;
  onDepartmentClick?: (departmentId: string, schoolId?: string) => void;
}

export default function SchoolDepartmentBreakdown({
  schoolWise,
  departmentWise,
  onSchoolClick,
  onDepartmentClick,
}: Props) {
  const [expandedSchools, setExpandedSchools] = React.useState<Set<string>>(new Set());

  const toggle = (schoolId: string) => {
    setExpandedSchools((prev) => {
      const next = new Set(prev);
      next.has(schoolId) ? next.delete(schoolId) : next.add(schoolId);
      return next;
    });
  };

  // Group departments by school
  const deptsBySchool = React.useMemo(() => {
    const map: Record<string, DepartmentBreakdownRow[]> = {};
    departmentWise.forEach((d) => {
      const key = d.schoolId || 'unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [departmentWise]);

  if (!schoolWise.length && !departmentWise.length) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
        No school or department data available for the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 shadow-sm">
      <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-200">
          <GraduationCap className="w-4 h-4" />
          School &amp; Department Breakdown
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Expand a school to inspect department performance inside the same scope.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/90 dark:bg-gray-700/80 text-left">
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Name</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Applications</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Approved</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Approval %</th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Approved Amount</th>
              <th className="px-5 py-3 font-medium text-gray-500 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {schoolWise.map((school) => {
              const isExpanded = expandedSchools.has(school.schoolId);
              const schoolDepts = deptsBySchool[school.schoolId] || [];
              const approvalRate = school.totalApplications > 0
                ? ((school.totalApproved / school.totalApplications) * 100).toFixed(1)
                : '0.0';

              return (
                <React.Fragment key={school.schoolId}>
                  <tr
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                    onClick={() => toggle(school.schoolId)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{school.schoolName}</span>
                        {schoolDepts.length > 0 && (
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800 dark:text-slate-200">{school.totalApplications}</td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-600">{school.totalApproved}</td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400">{approvalRate}%</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                      ₹{school.totalIncentive.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {onSchoolClick && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSchoolClick(school.schoolId); }}
                          className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>

                  {isExpanded &&
                    schoolDepts.map((dept) => {
                      const deptRate = dept.totalApplications > 0
                        ? ((dept.totalApproved / dept.totalApplications) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr
                          key={dept.departmentId}
                          className="cursor-pointer bg-slate-50/60 dark:bg-gray-700/30 transition-colors hover:bg-sky-50/40 dark:hover:bg-blue-900/10"
                          onClick={() => onDepartmentClick?.(dept.departmentId, school.schoolId)}
                        >
                          <td className="px-5 py-2.5 pl-12">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-700 dark:text-slate-300">{dept.departmentName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right text-slate-700 dark:text-slate-300">{dept.totalApplications}</td>
                          <td className="px-5 py-2.5 text-right text-emerald-600">{dept.totalApproved}</td>
                          <td className="px-5 py-2.5 text-right text-slate-600 dark:text-slate-400">{deptRate}%</td>
                          <td className="px-5 py-2.5 text-right text-slate-700 dark:text-slate-300">
                            ₹{dept.totalIncentive.toLocaleString('en-IN')}
                          </td>
                          <td className="px-5 py-2.5" />
                        </tr>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

