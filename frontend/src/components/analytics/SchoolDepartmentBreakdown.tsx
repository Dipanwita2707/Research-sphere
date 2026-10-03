'use client';

import React from 'react';
import { Building2, GraduationCap, ChevronRight, ChevronDown } from 'lucide-react';
import { ui } from './theme';

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

const num = (n: number, strong = false) =>
  n === 0
    ? 'text-stone-300 dark:text-gray-600'
    : strong
      ? 'font-medium text-stone-900 dark:text-white'
      : 'text-stone-700 dark:text-gray-200';

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
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
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
      <div className={`${ui.card} p-10 text-center text-sm text-stone-400 dark:text-gray-500`}>
        No data for this period.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${ui.card}`}>
      <div className={ui.cardHeader}>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <h3 className={ui.title}>School and department breakdown</h3>
            <p className={ui.subtitle}>Expand a school to see its departments.</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 dark:bg-gray-900/40">
            <tr>
              <th className={ui.th}>Name</th>
              <th className={`${ui.th} text-right`}>Applications</th>
              <th className={`${ui.th} text-right`}>Approved</th>
              <th className={`${ui.th} text-right`}>Approval rate</th>
              <th className={`${ui.th} text-right`}>Approved amount</th>
              <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
            {schoolWise.map((school) => {
              const isExpanded = expandedSchools.has(school.schoolId);
              const schoolDepts = deptsBySchool[school.schoolId] || [];
              const approvalRate = school.totalApplications > 0
                ? ((school.totalApproved / school.totalApplications) * 100).toFixed(1)
                : '0.0';

              return (
                <React.Fragment key={school.schoolId}>
                  <tr
                    className="cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40"
                    onClick={() => toggle(school.schoolId)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-stone-400 dark:text-gray-500">
                          {schoolDepts.length > 0 && (
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            />
                          )}
                        </span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300">
                          <GraduationCap className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-medium text-stone-900 dark:text-gray-100">{school.schoolName}</span>
                        {schoolDepts.length > 0 && (
                          <span className="text-xs tabular-nums text-stone-400 dark:text-gray-500">
                            {schoolDepts.length} dept{schoolDepts.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${num(school.totalApplications, true)}`}>{school.totalApplications}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${num(school.totalApproved, true)}`}>{school.totalApproved}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${num(school.totalApplications > 0 ? school.totalApproved : 0)}`}>{approvalRate}%</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${num(school.totalIncentive, true)}`}>
                      ₹{school.totalIncentive.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {onSchoolClick && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSchoolClick(school.schoolId); }}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          View
                          <ChevronRight className="h-3.5 w-3.5" />
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
                          className="cursor-pointer bg-stone-50/60 transition-colors hover:bg-stone-100/70 dark:bg-gray-900/30 dark:hover:bg-gray-700/40"
                          onClick={() => onDepartmentClick?.(dept.departmentId, school.schoolId)}
                        >
                          <td className="py-2.5 pl-14 pr-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-gray-500" />
                              <span className="text-stone-700 dark:text-gray-200">{dept.departmentName}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${num(dept.totalApplications)}`}>{dept.totalApplications}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${num(dept.totalApproved)}`}>{dept.totalApproved}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${num(dept.totalApplications > 0 ? dept.totalApproved : 0)}`}>{deptRate}%</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${num(dept.totalIncentive)}`}>
                            ₹{dept.totalIncentive.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {onDepartmentClick && <ChevronRight className="ml-auto h-4 w-4 text-stone-300 dark:text-gray-600" />}
                          </td>
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
