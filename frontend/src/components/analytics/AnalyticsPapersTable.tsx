'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import {
  drdAnalyticsService,
  type ContributionRecord,
  type TrackerPubType,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { logger } from '@/shared/utils/logger';

const PAGE_SIZE = 15;

const TABS: Array<{ key: string; label: string; pubType?: TrackerPubType }> = [
  { key: 'all', label: 'All' },
  { key: 'research_paper', label: 'Research', pubType: 'research_paper' },
  { key: 'book', label: 'Book', pubType: 'book' },
  { key: 'book_chapter', label: 'Book Chapter', pubType: 'book_chapter' },
  { key: 'conference_paper', label: 'Conference', pubType: 'conference_paper' },
  { key: 'ipr', label: 'IPR / Patent', pubType: 'ipr' },
  { key: 'grant_proposal', label: 'Grants', pubType: 'grant_proposal' },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  submitted:               { bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-700 dark:text-blue-300',    label: 'Submitted' },
  under_review:            { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', label: 'Under Review' },
  under_drd_review:        { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', label: 'DRD Review' },
  changes_required:        { bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-300',  label: 'Changes Required' },
  resubmitted:             { bg: 'bg-cyan-100 dark:bg-cyan-900/40',    text: 'text-cyan-700 dark:text-cyan-300',    label: 'Resubmitted' },
  recommended:             { bg: 'bg-teal-100 dark:bg-teal-900/40',    text: 'text-teal-700 dark:text-teal-300',    label: 'Recommended' },
  recommended_to_head:     { bg: 'bg-teal-100 dark:bg-teal-900/40',    text: 'text-teal-700 dark:text-teal-300',    label: 'Recommended' },
  drd_head_approved:       { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Head Approved' },
  submitted_to_govt:       { bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-700 dark:text-blue-300',    label: 'Submitted to Govt' },
  govt_application_filed:  { bg: 'bg-sky-100 dark:bg-sky-900/40',      text: 'text-sky-700 dark:text-sky-300',      label: 'Govt Filed' },
  published:               { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Published' },
  approved:                { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Approved' },
  completed:               { bg: 'bg-green-100 dark:bg-green-900/40',  text: 'text-green-700 dark:text-green-300',  label: 'Completed' },
  rejected:                { bg: 'bg-red-100 dark:bg-red-900/40',      text: 'text-red-700 dark:text-red-300',      label: 'Rejected' },
  drd_rejected:            { bg: 'bg-red-100 dark:bg-red-900/40',      text: 'text-red-700 dark:text-red-300',      label: 'DRD Rejected' },
  drd_head_rejected:       { bg: 'bg-red-100 dark:bg-red-900/40',      text: 'text-red-700 dark:text-red-300',      label: 'Head Rejected' },
  govt_rejected:           { bg: 'bg-red-100 dark:bg-red-900/40',      text: 'text-red-700 dark:text-red-300',      label: 'Govt Rejected' },
  pending_mentor_approval: { bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-300',  label: 'Mentor Approval' },
};

const PUB_TYPE_LABEL: Record<TrackerPubType, string> = {
  research_paper:   'Research',
  book:             'Book',
  book_chapter:     'Book Chapter',
  conference_paper: 'Conference',
  ipr:              'IPR / Patent',
  grant_proposal:   'Grant',
};

const PUB_TYPE_COLOR: Record<TrackerPubType, string> = {
  research_paper:   'text-blue-600 dark:text-blue-400',
  book:             'text-violet-600 dark:text-violet-400',
  book_chapter:     'text-purple-600 dark:text-purple-400',
  conference_paper: 'text-amber-600 dark:text-amber-400',
  ipr:              'text-rose-600 dark:text-rose-400',
  grant_proposal:   'text-emerald-600 dark:text-emerald-400',
};

export interface PapersTableScope {
  type: 'school' | 'department';
  id: string;
}

interface Props {
  scope?: PapersTableScope | null;
  fromDate: string;
  toDate: string;
  /** If provided, overrides internal tab state (used when parent has category filter) */
  initialTab?: string;
}

export function AnalyticsPapersTable({ scope, fromDate, toDate, initialTab }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab ?? 'all');
  const [page, setPage] = useState(0);
  const [records, setRecords] = useState<ContributionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const tab = TABS.find((t) => t.key === activeTab);
      const res = await drdAnalyticsService.getContributionsList({
        from: fromDate,
        to: toDate,
        publicationType: tab?.pubType,
        schoolId: scope?.type === 'school' ? scope.id : undefined,
        departmentId: scope?.type === 'department' ? scope.id : undefined,
      });
      if (res?.data) {
        setRecords(res.data.records ?? []);
      } else {
        setRecords([]);
      }
    } catch (err) {
      logger.error('AnalyticsPapersTable: failed to load contributions', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fromDate, toDate, scope]);

  useEffect(() => {
    setPage(0);
    fetchRecords();
  }, [fetchRecords]);

  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const slice = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showSchoolCol = !scope;
  const showDeptCol = scope?.type !== 'department';

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Papers & Trackers
            <span className="ml-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {records.length}
            </span>
          </h3>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(0); }}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : slice.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400 dark:text-slate-500">
          <FileText className="w-8 h-8" />
          <p className="text-sm">No papers found for the selected filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-gray-700 text-left">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">#</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Title</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Author</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Type</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Status</th>
                {showSchoolCol && (
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">School</th>
                )}
                {showDeptCol && (
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Department</th>
                )}
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {slice.map((rec, i) => {
                const statusMeta = STATUS_BADGE[rec.status] ?? { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', label: rec.status };
                const pubColor = PUB_TYPE_COLOR[rec.publicationType] ?? 'text-slate-500';
                const dateStr = rec.submittedAt || rec.updatedAt;
                return (
                  <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 align-middle">
                    <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">
                      {page * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <button
                        onClick={() => {
                          if (rec.publicationType === 'ipr') router.push(`/ipr/applications/${rec.id}`);
                          else if (rec.publicationType === 'grant_proposal') router.push(`/research/grant/${rec.id}`);
                          else router.push(`/research/contribution/${rec.id}`);
                        }}
                        className="font-medium text-slate-900 dark:text-slate-100 hover:text-sky-700 dark:hover:text-sky-400 hover:underline text-left leading-snug"
                      >
                        {rec.title}
                      </button>
                      {rec.applicationNumber && (
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{rec.applicationNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/drd/analytics/applicant/people/${rec.userId}`)}
                        className="text-slate-700 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-400 hover:underline text-sm text-left"
                      >
                        {rec.userName}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${pubColor}`}>
                        {PUB_TYPE_LABEL[rec.publicationType] ?? rec.publicationType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.bg} ${statusMeta.text}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    {showSchoolCol && (
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate">
                        {rec.schoolName || '—'}
                      </td>
                    )}
                    {showDeptCol && (
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate">
                        {rec.departmentName || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {dateStr
                        ? new Date(dateStr).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-4 py-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, records.length)} of {records.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg p-1.5 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg p-1.5 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
