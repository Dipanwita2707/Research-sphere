'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import {
  drdAnalyticsService,
  type ContributionRecord,
  type TrackerPubType,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { logger } from '@/shared/utils/logger';
import { categoryColor, ui } from './theme';

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

// Status pills: emerald = positive outcome, red = rejected, amber = needs action,
// neutral = still in flight. Every pill carries its text label.
const NEUTRAL = { bg: 'bg-stone-100 dark:bg-gray-700', text: 'text-stone-700 dark:text-gray-200' };
const GOOD = { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' };
const WARN = { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' };
const BAD = { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' };

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  submitted:               { ...NEUTRAL, label: 'Submitted' },
  under_review:            { ...NEUTRAL, label: 'Under review' },
  under_drd_review:        { ...NEUTRAL, label: 'DRD review' },
  changes_required:        { ...WARN,    label: 'Changes required' },
  resubmitted:             { ...NEUTRAL, label: 'Resubmitted' },
  recommended:             { ...GOOD,    label: 'Recommended' },
  recommended_to_head:     { ...GOOD,    label: 'Recommended' },
  drd_head_approved:       { ...GOOD,    label: 'Head approved' },
  submitted_to_govt:       { ...NEUTRAL, label: 'Submitted to govt' },
  govt_application_filed:  { ...NEUTRAL, label: 'Govt filed' },
  published:               { ...GOOD,    label: 'Published' },
  approved:                { ...GOOD,    label: 'Approved' },
  completed:               { ...GOOD,    label: 'Completed' },
  rejected:                { ...BAD,     label: 'Rejected' },
  drd_rejected:            { ...BAD,     label: 'DRD rejected' },
  drd_head_rejected:       { ...BAD,     label: 'Head rejected' },
  govt_rejected:           { ...BAD,     label: 'Govt rejected' },
  pending_mentor_approval: { ...WARN,    label: 'Mentor approval' },
};

const PUB_TYPE_LABEL: Record<TrackerPubType, string> = {
  research_paper:   'Research',
  book:             'Book',
  book_chapter:     'Book Chapter',
  conference_paper: 'Conference',
  ipr:              'IPR / Patent',
  grant_proposal:   'Grant',
};

/** Publication type -> shared entity colour (shown as a swatch, never as text colour). */
const PUB_TYPE_ENTITY: Record<TrackerPubType, string> = {
  research_paper:   'research',
  book:             'book',
  book_chapter:     'book',
  conference_paper: 'conference',
  ipr:              'ipr',
  grant_proposal:   'grants',
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

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className={`overflow-hidden ${ui.card}`}>
      {/* Header */}
      <div className="border-b border-stone-100 px-5 py-4 dark:border-gray-700">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
            <FileText className="h-4 w-4" />
          </div>
          <h3 className={`${ui.title} flex items-center gap-2`}>
            Papers and trackers
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-600 dark:bg-gray-700 dark:text-gray-300">
              {records.length}
            </span>
          </h3>
        </div>

        {/* Category tabs */}
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="inline-flex gap-0.5 rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-700 dark:bg-gray-900/40" role="tablist" aria-label="Publication type">
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setActiveTab(tab.key); setPage(0); }}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber'
                      : 'text-stone-600 hover:text-stone-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading papers">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-6 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
              <div className="h-4 flex-1 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
              <div className="hidden h-4 w-32 animate-pulse rounded bg-stone-100 dark:bg-gray-700 sm:block" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-stone-100 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      ) : slice.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-stone-400 dark:text-gray-500">
          No data for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 dark:bg-gray-900/40">
              <tr>
                <th className={`${ui.th} text-right`}>#</th>
                <th className={ui.th}>Title</th>
                <th className={ui.th}>Author</th>
                <th className={ui.th}>Type</th>
                <th className={ui.th}>Status</th>
                {showSchoolCol && <th className={ui.th}>School</th>}
                {showDeptCol && <th className={ui.th}>Department</th>}
                <th className={ui.th}>Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
              {slice.map((rec, i) => {
                const statusMeta = STATUS_BADGE[rec.status] ?? { ...NEUTRAL, label: rec.status };
                const entity = PUB_TYPE_ENTITY[rec.publicationType];
                return (
                  <tr key={rec.id} className="align-middle transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-stone-400 dark:text-gray-500">
                      {page * PAGE_SIZE + i + 1}
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (rec.publicationType === 'ipr') router.push(`/ipr/applications/${rec.id}`);
                          else if (rec.publicationType === 'grant_proposal') router.push(`/research/grant/${rec.id}`);
                          else router.push(`/research/contribution/${rec.id}`);
                        }}
                        className="text-left font-medium leading-snug text-stone-900 hover:text-wine hover:underline dark:text-gray-100 dark:hover:text-amber"
                      >
                        {rec.title}
                      </button>
                      {rec.applicationNumber && (
                        <p className="mt-0.5 font-mono text-[11px] text-stone-400 dark:text-gray-500">{rec.applicationNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/drd/analytics/applicant/people/${rec.userId}`)}
                        className="text-left text-sm text-stone-700 hover:text-wine hover:underline dark:text-gray-200 dark:hover:text-amber"
                      >
                        {rec.userName}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-stone-700 dark:text-gray-200">
                        {entity && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(entity) }} />}
                        {PUB_TYPE_LABEL[rec.publicationType] ?? rec.publicationType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium ${statusMeta.bg} ${statusMeta.text}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    {showSchoolCol && (
                      <td className="max-w-[140px] truncate px-4 py-3 text-xs text-stone-500 dark:text-gray-400" title={rec.schoolName || undefined}>
                        {rec.schoolName || '—'}
                      </td>
                    )}
                    {showDeptCol && (
                      <td className="max-w-[140px] truncate px-4 py-3 text-xs text-stone-500 dark:text-gray-400" title={rec.departmentName || undefined}>
                        {rec.departmentName || '—'}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-stone-500 dark:text-gray-400">
                      {fmtDate(rec.submittedAt || rec.updatedAt)}
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
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 dark:border-gray-700">
          <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, records.length)} of {records.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium tabular-nums text-stone-600 dark:text-gray-300">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
