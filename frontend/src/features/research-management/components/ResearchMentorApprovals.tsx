'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  History,
  Mic,
  RefreshCw,
  User,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { extractErrorMessage } from '@/shared/types/api.types';
import { getResearchDocumentDownloadUrl } from '@/shared/api/api';
import { logger } from '@/shared/utils/logger';
import { researchService, ResearchContribution } from '../services/research.service';

// ---------------------------------------------------------------------------
// Types: the pending endpoint returns the raw Prisma row plus applicantDetails,
// authors, school and department, so a few backend field names are declared
// here that the shared ResearchContribution interface does not carry.
// ---------------------------------------------------------------------------

interface MentorAuthor {
  id: string;
  name: string;
  userId?: string | null;
  uid?: string | null;
  registrationNo?: string | null;
  email?: string | null;
  authorType?: string;
  authorOrder?: number;
  isCorresponding?: boolean;
  isInternal?: boolean;
  affiliation?: string | null;
}

interface StatusHistoryEntry {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  comments?: string | null;
  changedAt?: string;
  createdAt?: string;
  changedBy?: {
    uid?: string;
    employeeDetails?: { displayName?: string; firstName?: string; lastName?: string } | null;
  } | null;
}

export type MentorPendingContribution = Omit<ResearchContribution, 'authors' | 'statusHistory'> & {
  authors?: MentorAuthor[];
  statusHistory?: StatusHistoryEntry[];
  keywords?: string | null;
  publicationDate?: string | null;
  indexingCategories?: string[];
  sdg_goals?: string[];
  revisionCount?: number;
  editors?: string | null;
  nationalInternational?: string | null;
  conferenceSubType?: string | null;
  bookPublicationType?: string | null;
  naasRating?: number | string | null;
};

type DialogState = { mode: 'approve' | 'reject'; item: MentorPendingContribution } | null;

interface DetailState {
  loading: boolean;
  error?: string;
  history?: StatusHistoryEntry[];
}

export interface ResearchMentorApprovalsProps {
  /** Called with the current number of pending contributions after every load or decision. */
  onPendingCountChange?: (count: number) => void;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  research_paper: { label: 'Research Paper', icon: FileText, color: 'bg-wine' },
  book: { label: 'Book', icon: BookOpen, color: 'bg-green-600' },
  book_chapter: { label: 'Book Chapter', icon: BookOpen, color: 'bg-green-600' },
  conference_paper: { label: 'Conference Paper', icon: Mic, color: 'bg-purple-600' },
  grant_proposal: { label: 'Grant Proposal', icon: FileText, color: 'bg-orange-500' },
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_mentor_approval: 'Pending mentor approval',
  submitted: 'Submitted to DRD',
  under_review: 'Under DRD review',
  changes_required: 'Changes requested',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const humanize = (value?: string | null) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()) : '';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const getStudentInfo = (c: MentorPendingContribution) => {
  const details = c.applicantDetails;
  const author = c.authors?.find(
    (a) =>
      (c.applicantUserId && a.userId === c.applicantUserId) ||
      (details?.uid && (a.uid === details.uid || a.registrationNo === details.uid)),
  );
  // Students carry their name on studentLogin; staff applicants on employeeDetails.
  const person = c.applicantUser?.studentLogin || c.applicantUser?.employeeDetails;
  const employeeName = person
    ? person.displayName || [person.firstName, person.lastName].filter(Boolean).join(' ')
    : '';
  const uid = details?.uid || author?.uid || author?.registrationNo || c.applicantUser?.uid || '';
  return {
    name: author?.name || employeeName || uid || 'Unknown student',
    uid,
    email: details?.email || author?.email || c.applicantUser?.email || '',
  };
};

const getVenue = (c: MentorPendingContribution) =>
  c.journalName || c.conferenceName || c.bookTitle || c.proceedingsTitle || c.publisherName || '';

interface DocumentLink {
  name: string;
  size?: number;
  href: string;
  kind: 'manuscript' | 'supporting';
}

const parseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const getDocuments = (c: MentorPendingContribution): DocumentLink[] => {
  const docs: DocumentLink[] = [];
  const manuscript = parseJson(c.manuscriptFilePath);
  if (manuscript) {
    let name = '';
    let size: number | undefined;
    if (typeof manuscript === 'string') {
      name = manuscript.split('/').pop() || 'manuscript';
    } else if (typeof manuscript === 'object') {
      const m = manuscript as { name?: string; s3Key?: string; size?: number };
      name = m.name || m.s3Key?.split('/').pop() || 'manuscript';
      size = m.size;
    }
    if (name) docs.push({ name, size, kind: 'manuscript', href: getResearchDocumentDownloadUrl(c.id, 'manuscript', name) });
  }
  const supporting = parseJson(c.supportingDocsFilePaths) as { files?: Array<{ name?: string; size?: number }> } | null;
  supporting?.files?.forEach((file) => {
    if (!file?.name) return;
    docs.push({
      name: file.name,
      size: file.size,
      kind: 'supporting',
      href: getResearchDocumentDownloadUrl(c.id, 'supporting', file.name),
    });
  });
  return docs;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const changedByName = (entry: StatusHistoryEntry) => {
  const emp = entry.changedBy?.employeeDetails;
  return (
    emp?.displayName ||
    [emp?.firstName, emp?.lastName].filter(Boolean).join(' ') ||
    entry.changedBy?.uid ||
    'Unknown'
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonList() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading pending research contributions">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-testid="research-mentor-skeleton"
          className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-700/70" />
              <div className="flex gap-4">
                <div className="h-4 w-28 rounded bg-gray-100 dark:bg-gray-700/70" />
                <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-700/70" />
                <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-700/70" />
              </div>
              <div className="flex gap-2 pt-1">
                <div className="h-10 flex-1 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-10 w-36 rounded-lg bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

function ContributionDetails({ item, detail }: { item: MentorPendingContribution; detail?: DetailState }) {
  const documents = getDocuments(item);
  const authors = [...(item.authors || [])].sort((a, b) => (a.authorOrder ?? 0) - (b.authorOrder ?? 0));
  const details = item.applicantDetails as (MentorPendingContribution['applicantDetails'] & {
    isPhdWork?: boolean;
    phdTitle?: string;
  }) | undefined;
  const volumeIssue = [item.volume && `Vol. ${item.volume}`, item.issue && `Issue ${item.issue}`, item.pageNumbers && `pp. ${item.pageNumbers}`]
    .filter(Boolean)
    .join(', ');
  const doi = item.doi;
  const history = (detail?.history || []).filter((h) => h.toStatus !== 'draft' || h.fromStatus);

  return (
    <div className="mt-5 space-y-6 border-t border-gray-100 pt-5 dark:border-gray-700" data-testid={`research-details-${item.id}`}>
      {item.abstract && (
        <section>
          <h4 className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-white">Abstract</h4>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">{item.abstract}</p>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Publication details</h4>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Journal" value={item.journalName} />
          <DetailField label="Conference" value={item.conferenceName} />
          <DetailField label="Book" value={item.bookTitle} />
          <DetailField label="Proceedings" value={item.proceedingsTitle} />
          <DetailField label="Publisher" value={item.publisherName} />
          <DetailField label="Volume / issue / pages" value={volumeIssue} />
          <DetailField label="ISSN" value={item.issn} />
          <DetailField label="ISBN" value={item.isbn} />
          <DetailField
            label="DOI"
            value={
              doi ? (
                <a
                  href={/^https?:\/\//i.test(doi) ? doi : `https://doi.org/${doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-wine underline-offset-2 hover:underline dark:text-wine-200"
                >
                  {doi}
                </a>
              ) : undefined
            }
          />
          <DetailField label="Publication date" value={formatDate(item.publicationDate)} />
          <DetailField label="Conference date" value={formatDate(item.conferenceDate)} />
          <DetailField label="Conference location" value={item.conferenceLocation} />
          <DetailField label="National / international" value={humanize(item.nationalInternational)} />
          <DetailField label="Impact factor" value={item.impactFactor != null ? String(item.impactFactor) : undefined} />
          <DetailField label="SJR" value={item.sjr != null ? String(item.sjr) : undefined} />
          <DetailField label="Quartile" value={item.quartile ? String(item.quartile).toUpperCase() : undefined} />
          <DetailField
            label="Indexing"
            value={item.indexingCategories?.length ? item.indexingCategories.map(humanize).join(', ') : undefined}
          />
          <DetailField label="Keywords" value={item.keywords} />
          <DetailField label="SDGs" value={item.sdg_goals?.length ? item.sdg_goals.map(humanize).join(', ') : undefined} />
          <DetailField label="School" value={item.school?.facultyName || item.school?.name} />
          <DetailField label="Department" value={item.department?.departmentName || item.department?.name} />
          <DetailField label="PhD work" value={details?.isPhdWork ? details.phdTitle || 'Yes' : undefined} />
        </dl>
      </section>

      {authors.length > 0 && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <Users className="h-4 w-4 text-wine dark:text-wine-200" aria-hidden="true" />
            Authors ({authors.length})
          </h4>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {authors.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {a.name}
                  {(a.uid || a.registrationNo) && (
                    <span className="ml-2 font-mono text-xs text-gray-500 dark:text-gray-400">{a.uid || a.registrationNo}</span>
                  )}
                </span>
                <span className="flex flex-wrap gap-1.5 text-xs">
                  {a.authorType && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {humanize(a.authorType)}
                    </span>
                  )}
                  {a.isCorresponding && (
                    <span className="rounded-full bg-wine-100 px-2 py-0.5 text-wine dark:bg-wine/30 dark:text-wine-200">Corresponding</span>
                  )}
                  {a.isInternal === false && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">External</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <FileText className="h-4 w-4 text-wine dark:text-wine-200" aria-hidden="true" />
          Documents
        </h4>
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No documents attached.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={`${doc.kind}-${doc.name}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{doc.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {doc.kind === 'manuscript' ? 'Manuscript' : 'Supporting document'}
                    {doc.size ? ` · ${formatSize(doc.size)}` : ''}
                  </span>
                </span>
                <a
                  href={doc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-wine/30 px-3 py-1.5 text-xs font-semibold text-wine hover:bg-wine-100 dark:border-wine-200/40 dark:text-wine-200 dark:hover:bg-wine/20"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <History className="h-4 w-4 text-wine dark:text-wine-200" aria-hidden="true" />
          Timeline
        </h4>
        {detail?.loading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        ) : detail?.error ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Timeline unavailable: {detail.error}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No earlier activity.</p>
        ) : (
          <ol className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {STATUS_LABELS[h.toStatus] || humanize(h.toStatus)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {changedByName(h)} · {formatDate(h.changedAt || h.createdAt)}
                  </span>
                </div>
                {h.comments && <p className="mt-1 whitespace-pre-line text-gray-600 dark:text-gray-300">{h.comments}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex justify-end">
        <Link
          href={`/research/contribution/${item.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-wine hover:underline dark:text-wine-200"
        >
          Open full record
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function DecisionDialog({
  dialog,
  comment,
  onCommentChange,
  onCancel,
  onConfirm,
  showReasonError,
}: {
  dialog: NonNullable<DialogState>;
  comment: string;
  onCommentChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  showReasonError: boolean;
}) {
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isReject = dialog.mode === 'reject';
  const reasonMissing = isReject && !comment.trim();

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const student = getStudentInfo(dialog.item);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
      >
        <h3 id={titleId} className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
          {isReject ? 'Request changes' : 'Approve contribution'}
        </h3>
        <p id={descId} className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          {isReject ? (
            <>
              <span className="font-medium text-gray-900 dark:text-white">&ldquo;{dialog.item.title}&rdquo;</span> will be sent back
              to {student.name} with your reason. They can edit and resubmit it.
            </>
          ) : (
            <>
              <span className="font-medium text-gray-900 dark:text-white">&ldquo;{dialog.item.title}&rdquo;</span> by {student.name} will
              be forwarded to DRD for review.
            </>
          )}
        </p>
        <label htmlFor={`${titleId}-comment`} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
          {isReject ? 'Reason (required)' : 'Comments (optional)'}
        </label>
        <textarea
          id={`${titleId}-comment`}
          ref={textareaRef}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder={isReject ? 'Explain what the student needs to change' : 'Add a note for the student and DRD'}
          rows={isReject ? 4 : 3}
          maxLength={2000}
          aria-invalid={showReasonError && reasonMissing ? true : undefined}
          aria-describedby={showReasonError && reasonMissing ? errorId : undefined}
          className={`w-full rounded-lg border px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 dark:bg-gray-900 dark:text-gray-100 ${
            isReject
              ? 'border-red-300 focus:ring-red-500 dark:border-red-700'
              : 'border-gray-300 focus:ring-wine dark:border-gray-600'
          }`}
        />
        {showReasonError && reasonMissing && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
            Please give the student a reason.
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            aria-disabled={reasonMissing || undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-white ${
              isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            } ${reasonMissing ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {isReject ? <XCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle className="h-4 w-4" aria-hidden="true" />}
            {isReject ? 'Send back to student' : 'Approve and forward'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ResearchMentorApprovals({ onPendingCountChange }: ResearchMentorApprovalsProps) {
  const { addToast } = useToast();
  const [items, setItems] = useState<MentorPendingContribution[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});
  const [dialog, setDialog] = useState<DialogState>(null);
  const [comment, setComment] = useState('');
  const [showReasonError, setShowReasonError] = useState(false);

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoadState('loading');
    setLoadError('');
    try {
      const data = await researchService.getMentorPendingContributions();
      setItems((data || []) as MentorPendingContribution[]);
      setLoadState('ready');
    } catch (err: unknown) {
      logger.error('Error fetching research mentor approvals:', err);
      setLoadError(extractErrorMessage(err, 'Could not load pending research contributions'));
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loadState === 'ready') onPendingCountChange?.(items.length);
  }, [items.length, loadState, onPendingCountChange]);

  const toggleExpand = async (item: MentorPendingContribution) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    if (details[item.id] && !details[item.id].error) return;
    setDetails((prev) => ({ ...prev, [item.id]: { loading: true } }));
    try {
      const response = await researchService.getContributionById(item.id);
      const record = (response?.data || {}) as MentorPendingContribution;
      setDetails((prev) => ({ ...prev, [item.id]: { loading: false, history: record.statusHistory || [] } }));
    } catch (err: unknown) {
      setDetails((prev) => ({ ...prev, [item.id]: { loading: false, error: extractErrorMessage(err) } }));
    }
  };

  const openDialog = (mode: 'approve' | 'reject', item: MentorPendingContribution) => {
    setComment('');
    setShowReasonError(false);
    setDialog({ mode, item });
  };

  const closeDialog = useCallback(() => {
    setDialog(null);
    setComment('');
    setShowReasonError(false);
  }, []);

  const confirmDecision = async () => {
    if (!dialog) return;
    const { mode, item } = dialog;
    const text = comment.trim();
    if (mode === 'reject' && !text) {
      setShowReasonError(true);
      return;
    }

    // Optimistic: drop the item now, put it back where it was if the call fails.
    const index = items.findIndex((i) => i.id === item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (expandedId === item.id) setExpandedId(null);
    closeDialog();

    try {
      if (mode === 'approve') {
        await researchService.mentorApproveContribution(item.id, text || undefined);
        addToast({ type: 'success', title: 'Approved', message: `"${item.title}" was forwarded to DRD for review.` });
      } else {
        await researchService.mentorRejectContribution(item.id, text);
        addToast({ type: 'success', title: 'Sent back', message: `"${item.title}" was returned to the student with your comments.` });
      }
    } catch (err: unknown) {
      logger.error(`Error on research mentor ${mode}:`, err);
      const status = (err as { response?: { status?: number } })?.response?.status;
      addToast({ type: 'error', message: extractErrorMessage(err, `Could not ${mode === 'approve' ? 'approve' : 'send back'} the contribution`) });
      if (status === 400 || status === 404 || status === 409) {
        // The record moved on (another tab, status change): reload the real list.
        load({ silent: true });
      } else {
        setItems((prev) => {
          if (prev.some((i) => i.id === item.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
          return next;
        });
      }
    }
  };

  if (loadState === 'loading') return <SkeletonList />;

  if (loadState === 'error') {
    return (
      <div className="py-12 text-center" role="alert">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" aria-hidden="true" />
        <p className="text-red-600 dark:text-red-400">{loadError}</p>
        <button
          type="button"
          onClick={() => load()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-wine px-4 py-2 font-medium text-wine-fg hover:bg-wine-dark"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center dark:border-gray-600 dark:bg-gray-800/50">
          <UserCheck className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" aria-hidden="true" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">No Pending Approvals</h3>
          <p className="text-gray-500 dark:text-gray-400">All caught up! No student research is waiting for your approval.</p>
        </div>
      ) : (
        <ul className="space-y-4" aria-label="Research contributions pending your approval">
          {items.map((item) => {
            const type = TYPE_CONFIG[item.publicationType] || TYPE_CONFIG.research_paper;
            const TypeIcon = type.icon;
            const student = getStudentInfo(item);
            const venue = getVenue(item);
            const expanded = expandedId === item.id;
            const submitted = formatDate(item.submittedAt || item.createdAt);
            const coAuthors = Math.max((item.authors?.length || 0) - 1, 0);
            return (
              <li
                key={item.id}
                data-testid={`research-pending-${item.id}`}
                className="rounded-xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-blush-line hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-wine"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${type.color}`}>
                    <TypeIcon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {type.label}
                          {venue ? ` · ${venue}` : ''}
                        </p>
                      </div>
                      <span className="self-start whitespace-nowrap rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                        Pending Your Approval
                      </span>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" aria-hidden="true" />
                        <span className="text-gray-700 dark:text-gray-300">{student.name}</span>
                        {student.uid && student.uid !== student.name && (
                          <span className="font-mono text-xs">({student.uid})</span>
                        )}
                      </span>
                      {submitted && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          Submitted {submitted}
                        </span>
                      )}
                      {(item.department?.departmentName || item.school?.facultyName) && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" aria-hidden="true" />
                          {item.department?.departmentName || item.school?.facultyName}
                        </span>
                      )}
                      {coAuthors > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" aria-hidden="true" />
                          {coAuthors} co-author{coAuthors === 1 ? '' : 's'}
                        </span>
                      )}
                      {(item.revisionCount ?? 0) > 0 && (
                        <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                          Revision {item.revisionCount}
                        </span>
                      )}
                      <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-700 dark:text-gray-300">
                        {item.applicationNumber || 'No number yet'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item)}
                        aria-expanded={expanded}
                        aria-controls={`research-details-region-${item.id}`}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-wine/30 px-4 py-2.5 font-medium text-wine transition-colors hover:bg-wine-100 dark:border-wine-200/40 dark:text-wine-200 dark:hover:bg-wine/20"
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                        {expanded ? 'Hide details' : 'View details'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openDialog('approve', item)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                      >
                        <CheckCircle className="h-4 w-4" aria-hidden="true" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => openDialog('reject', item)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Request changes
                      </button>
                    </div>

                    <div id={`research-details-region-${item.id}`}>
                      {expanded && <ContributionDetails item={item} detail={details[item.id]} />}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <DecisionDialog
          dialog={dialog}
          comment={comment}
          onCommentChange={(value) => {
            setComment(value);
            if (value.trim()) setShowReasonError(false);
          }}
          onCancel={closeDialog}
          onConfirm={confirmDecision}
          showReasonError={showReasonError}
        />
      )}
    </div>
  );
}
