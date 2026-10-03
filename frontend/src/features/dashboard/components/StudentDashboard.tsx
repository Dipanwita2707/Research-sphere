'use client';

/**
 * Student dashboard.
 *
 * Shows only data the platform actually holds for a student: their account
 * profile, their research submissions, their IPR applications, the work they
 * track in the progress tracker, and their in-app notifications. Every number
 * and list on this page comes from the API; when there is nothing to show the
 * page says so instead of filling the space with sample content.
 */

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FolderOpen,
  GraduationCap,
  Lightbulb,
  ListChecks,
  RefreshCw,
  Settings,
  UserCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import { researchService } from '@/features/research-management/services/research.service';
import { iprService } from '@/features/ipr-management/services/ipr.service';
import progressTrackerService from '@/features/research-management/services/progressTracker.service';
import { notificationService, type Notification } from '@/shared/services/notification.service';
import { getProfileImageUrl } from '@/shared/services/profile.service';
import { cn } from '@/lib/utils';

/* ───────────────────────── Types ───────────────────────── */

interface ResearchItem {
  id: string;
  title: string;
  status: string;
  publicationType: string;
  applicationNumber?: string | null;
  applicantUserId?: string | null;
  journalName?: string | null;
  conferenceName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ResearchSummary {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
}

interface IprItem {
  id: string;
  title: string;
  status: string;
  iprType: string;
  applicationNumber?: string | null;
  applicantUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface IprStats {
  total: number;
  draft: number;
  submitted: number;
  under_review: number;
  changes_required: number;
  approved: number;
  rejected: number;
}

interface AttentionItem {
  id: string;
  kind: 'research' | 'ipr';
  title: string;
  href: string;
  updatedAt?: string;
}

type Tone = 'neutral' | 'info' | 'pending' | 'warning' | 'success' | 'danger';

/* ───────────────────────── Labels & status tones ───────────────────────── */

const PUBLICATION_TYPE_LABELS: Record<string, string> = {
  research_paper: 'Research paper',
  book: 'Book',
  book_chapter: 'Book chapter',
  conference_paper: 'Conference paper',
  grant_proposal: 'Grant proposal',
};

const IPR_TYPE_LABELS: Record<string, string> = {
  patent: 'Patent',
  copyright: 'Copyright',
  trademark: 'Trademark',
  design: 'Design',
};

const STATUS_LABEL_OVERRIDES: Record<string, string> = {
  pending_mentor_approval: 'Awaiting mentor',
  under_review: 'Under review',
  under_drd_review: 'Under DRD review',
  changes_required: 'Changes requested',
  recommended_to_head: 'With DRD head',
  drd_head_approved: 'Approved by DRD head',
  drd_approved: 'Approved by DRD',
  drd_rejected: 'Rejected by DRD',
  drd_head_rejected: 'Rejected by DRD head',
  under_dean_review: 'Under dean review',
  under_finance_review: 'Under finance review',
  submitted_to_govt: 'Sent for filing',
  govt_application_filed: 'Filed with patent office',
  govt_rejected: 'Rejected by patent office',
};

const TONE_BY_STATUS: Record<string, Tone> = {
  draft: 'neutral',
  cancelled: 'neutral',
  pending_mentor_approval: 'pending',
  submitted: 'info',
  resubmitted: 'info',
  under_review: 'info',
  under_drd_review: 'info',
  recommended_to_head: 'info',
  under_dean_review: 'info',
  under_finance_review: 'info',
  changes_required: 'warning',
  approved: 'success',
  completed: 'success',
  drd_head_approved: 'success',
  drd_approved: 'success',
  dean_approved: 'success',
  finance_approved: 'success',
  submitted_to_govt: 'success',
  govt_application_filed: 'success',
  published: 'success',
  rejected: 'danger',
  drd_rejected: 'danger',
  drd_head_rejected: 'danger',
  dean_rejected: 'danger',
  govt_rejected: 'danger',
  finance_rejected: 'danger',
};

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  pending: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  warning: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusLabel(status: string): string {
  return STATUS_LABEL_OVERRIDES[status] ?? humanize(status);
}

function relativeTime(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true });
}

/** Only follow in-app paths from notification metadata; never off-site URLs. */
function safeInternalPath(url?: string): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
  return url;
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ───────────────────────── Data loading ───────────────────────── */

const STALE_TIME = 60 * 1000;

async function fetchResearchOverview(): Promise<{ items: ResearchItem[]; summary: ResearchSummary }> {
  const res = (await researchService.getMyContributions({ page: 1, limit: 5 })) as {
    data?: { contributions?: ResearchItem[]; summary?: Partial<ResearchSummary> };
  };
  const summary = res?.data?.summary ?? {};
  return {
    items: Array.isArray(res?.data?.contributions) ? res.data.contributions : [],
    summary: {
      total: summary.total ?? 0,
      draft: summary.draft ?? 0,
      pending: summary.pending ?? 0,
      approved: summary.approved ?? 0,
      completed: summary.completed ?? 0,
      rejected: summary.rejected ?? 0,
    },
  };
}

async function fetchIprOverview(): Promise<{ items: IprItem[]; stats: IprStats }> {
  const res = await iprService.getMyApplications({ page: 1, limit: 5 });
  const stats = (res?.stats ?? {}) as Partial<IprStats>;
  return {
    items: Array.isArray(res?.data) ? (res.data as unknown as IprItem[]) : [],
    stats: {
      total: stats.total ?? 0,
      draft: stats.draft ?? 0,
      submitted: stats.submitted ?? 0,
      under_review: stats.under_review ?? 0,
      changes_required: stats.changes_required ?? 0,
      approved: stats.approved ?? 0,
      rejected: stats.rejected ?? 0,
    },
  };
}

/** Submissions where a reviewer asked the student (as applicant) for changes. */
async function fetchAttention(userId: string): Promise<AttentionItem[]> {
  const [researchRes, iprRes] = await Promise.all([
    researchService.getMyContributions({ page: 1, limit: 20, status: 'changes_required' }) as Promise<{
      data?: { contributions?: ResearchItem[] };
    }>,
    iprService.getMyApplications({ page: 1, limit: 20, status: 'changes_required' }),
  ]);

  const research = (researchRes?.data?.contributions ?? [])
    .filter((c) => c.status === 'changes_required' && (!c.applicantUserId || c.applicantUserId === userId))
    .map<AttentionItem>((c) => ({
      id: c.id,
      kind: 'research',
      title: c.title,
      href: `/research/contribution/${c.id}`,
      updatedAt: c.updatedAt,
    }));

  const ipr = ((iprRes?.data ?? []) as unknown as IprItem[])
    .filter((a) => a.status === 'changes_required' && (!a.applicantUserId || a.applicantUserId === userId))
    .map<AttentionItem>((a) => ({
      id: a.id,
      kind: 'ipr',
      title: a.title,
      href: `/ipr/applications/${a.id}`,
      updatedAt: a.updatedAt,
    }));

  return [...research, ...ipr].sort(
    (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
  );
}

/* ───────────────────────── Small building blocks ───────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-800', className)} />;
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 flex-shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = TONE_BY_STATUS[status] ?? 'neutral';
  return (
    <span className={cn('inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', TONE_CLASSES[tone])}>
      {statusLabel(status)}
    </span>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
      <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
      <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-wine/40 hover:text-wine dark:border-gray-700 dark:text-gray-200 dark:hover:text-hi"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-peach/50 text-wine dark:bg-wine/20 dark:text-hi">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-wine px-3.5 py-2 text-xs font-semibold text-wine-fg transition-colors hover:bg-wine-dark"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.03)] dark:border-gray-800 dark:bg-gray-900',
        className
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-peach/50 text-wine dark:bg-wine/20 dark:text-hi">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function ViewAllLink({ href, label = 'View all' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-wine hover:text-wine-dark dark:text-hi dark:hover:text-amber-200"
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  loading,
  failed,
  emphasis = false,
}: {
  label: string;
  value?: number;
  hint?: string;
  icon: LucideIcon;
  href: string;
  loading: boolean;
  failed: boolean;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-h-[116px] flex-col rounded-2xl border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgb(var(--brand-primary)/0.10)] focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:bg-gray-900 sm:p-5',
        emphasis
          ? 'border-orange-200 dark:border-orange-900/60'
          : 'border-gray-100 hover:border-wine/20 dark:border-gray-800'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
        <span
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl',
            emphasis
              ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300'
              : 'bg-peach/50 text-wine dark:bg-wine/20 dark:text-hi'
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-auto pt-3">
        {loading ? (
          <Skeleton className="h-8 w-14" />
        ) : (
          <p className="text-3xl font-bold tabular-nums leading-none tracking-tight text-gray-900 dark:text-white">
            {failed || value === undefined ? '—' : value}
          </p>
        )}
        <p className="mt-2 min-h-[1rem] text-xs text-gray-500 dark:text-gray-400">
          {loading ? '' : failed ? 'Could not load' : hint}
        </p>
      </div>
    </Link>
  );
}

function Avatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const [broken, setBroken] = useState(false);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  if (imageUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded photo served by the API, not a static asset
      <img
        src={imageUrl}
        alt=""
        onError={() => setBroken(true)}
        className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover ring-4 ring-white/20 sm:h-20 sm:w-20"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold text-white ring-4 ring-white/10 sm:h-20 sm:w-20 sm:text-2xl"
    >
      {initials}
    </div>
  );
}

/* ───────────────────────── Quick actions ───────────────────────── */

// Every href below is an existing route under src/app.
const QUICK_ACTIONS: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  { href: '/research/apply', label: 'Submit research', description: 'Paper, book, chapter or conference paper', icon: FilePlus2 },
  { href: '/ipr/apply', label: 'File a patent / IPR', description: 'Patent, copyright, trademark or design', icon: Lightbulb },
  { href: '/research/progress-tracker', label: 'Progress tracker', description: 'Track work before it is published', icon: ListChecks },
  { href: '/my-work', label: 'All my submissions', description: 'Research and IPR in one list', icon: FolderOpen },
  { href: '/research/my-profile', label: 'Research profile', description: 'Your public researcher profile', icon: UserCircle2 },
  { href: '/settings', label: 'Settings', description: 'Account and notification preferences', icon: Settings },
];

/* ───────────────────────── Page ───────────────────────── */

export default function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const enabled = Boolean(userId);

  const researchQ = useQuery({
    queryKey: ['student-dashboard', 'research', userId],
    queryFn: fetchResearchOverview,
    enabled,
    staleTime: STALE_TIME,
  });

  const iprQ = useQuery({
    queryKey: ['student-dashboard', 'ipr', userId],
    queryFn: fetchIprOverview,
    enabled,
    staleTime: STALE_TIME,
  });

  const attentionQ = useQuery({
    queryKey: ['student-dashboard', 'attention', userId],
    queryFn: () => fetchAttention(userId as string),
    enabled,
    staleTime: STALE_TIME,
  });

  const trackerQ = useQuery({
    queryKey: ['student-dashboard', 'tracker-stats', userId],
    queryFn: async () => (await progressTrackerService.getStats()).data,
    enabled,
    staleTime: STALE_TIME,
  });

  const notificationsQ = useQuery({
    queryKey: ['student-dashboard', 'notifications', userId],
    queryFn: () => notificationService.getNotifications({ page: 1, limit: 5 }),
    enabled,
    staleTime: 30 * 1000,
  });

  if (!user) return null;

  const fullName =
    user.student?.displayName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.username;
  const firstName = user.firstName || fullName.split(' ')[0];
  const photoUrl = user.profileImageUrl ? getProfileImageUrl(user.profileImageUrl) : undefined;
  const registrationNo = user.student?.registrationNo || user.uid;
  const program = user.student?.program;
  const semester = user.student?.semester;

  const research = researchQ.data;
  const ipr = iprQ.data;
  const attention = attentionQ.data ?? [];
  const trackerStats = trackerQ.data;
  const trackerByStatus = trackerStats?.byStatus ?? {};
  const trackerInProgress = ['writing', 'communicated', 'submitted', 'accepted'].reduce(
    (sum, key) => sum + (Number(trackerByStatus[key]) || 0),
    0
  );
  const unreadCount = notificationsQ.data?.unreadCount ?? 0;

  const today = new Date();
  const greeting = greetingFor(today.getHours());
  const todayLabel = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-full bg-blush px-4 py-6 dark:bg-gray-950 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ── Hero / profile ── */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-wine-darker via-wine to-wine-dark p-5 text-white shadow-lg shadow-wine/20 sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-peach/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <Avatar name={fullName} imageUrl={photoUrl} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/60 sm:text-sm">{todayLabel}</p>
                <h1 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">
                  {greeting}, {firstName}
                </h1>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {registrationNo && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85">
                      Reg. no. {registrationNo}
                    </span>
                  )}
                  {program && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85">
                      <GraduationCap className="h-3 w-3" aria-hidden="true" />
                      {program}
                    </span>
                  )}
                  {semester ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85">
                      Semester {semester}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/research/apply"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-wine shadow-sm transition-colors hover:bg-ivory"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                Submit research
              </Link>
              <Link
                href="/ipr/apply"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                File a patent / IPR
              </Link>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile
            label="Research submissions"
            icon={BookOpen}
            href="/research/my-contributions"
            loading={researchQ.isPending}
            failed={researchQ.isError}
            value={research?.summary.total}
            hint={research ? `${research.summary.pending} in review · ${research.summary.draft} drafts` : undefined}
          />
          <StatTile
            label="IPR applications"
            icon={Lightbulb}
            href="/ipr/my-applications"
            loading={iprQ.isPending}
            failed={iprQ.isError}
            value={ipr?.stats.total}
            hint={ipr ? `${ipr.stats.submitted + ipr.stats.under_review} in review · ${ipr.stats.approved} approved` : undefined}
          />
          <StatTile
            label="Needs your action"
            icon={AlertTriangle}
            href="/my-work"
            loading={attentionQ.isPending}
            failed={attentionQ.isError}
            value={attentionQ.data ? attention.length : undefined}
            hint={attention.length > 0 ? 'Reviewers requested changes' : 'Nothing waiting on you'}
            emphasis={attention.length > 0}
          />
          <StatTile
            label="Work in progress"
            icon={ListChecks}
            href="/research/progress-tracker"
            loading={trackerQ.isPending}
            failed={trackerQ.isError}
            value={trackerStats ? trackerInProgress : undefined}
            hint={trackerStats ? `${trackerStats.total} tracked in total` : undefined}
          />
        </section>

        {/* ── Needs attention ── */}
        {attention.length > 0 && (
          <section
            aria-labelledby="attention-heading"
            className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-900/60 dark:bg-orange-950/20 sm:p-5"
          >
            <h2 id="attention-heading" className="flex items-center gap-2 text-sm font-semibold text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Reviewers asked for changes on {attention.length === 1 ? 'one submission' : `${attention.length} submissions`}
            </h2>
            <ul className="mt-3 divide-y divide-orange-100 dark:divide-orange-900/40">
              {attention.slice(0, 5).map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 py-2.5 text-sm transition-colors hover:text-wine dark:hover:text-hi"
                  >
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                      {item.kind === 'research' ? 'Research' : 'IPR'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-100">{item.title}</span>
                    {relativeTime(item.updatedAt) && (
                      <span className="hidden flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 sm:inline">
                        {relativeTime(item.updatedAt)}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-orange-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Research submissions */}
            <Card title="My research submissions" icon={BookOpen} action={<ViewAllLink href="/research/my-contributions" />}>
              {researchQ.isPending ? (
                <ListSkeleton />
              ) : researchQ.isError ? (
                <ErrorState message="We couldn't load your research submissions." onRetry={() => researchQ.refetch()} />
              ) : research && research.items.length > 0 ? (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {research.items.map((item) => {
                    const venue = item.journalName || item.conferenceName;
                    const when = relativeTime(item.updatedAt ?? item.createdAt);
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/research/contribution/${item.id}`}
                          className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blush text-wine dark:bg-gray-800 dark:text-hi">
                            <BookOpen className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900 group-hover:text-wine dark:text-gray-100 dark:group-hover:text-hi">
                              {item.title || 'Untitled submission'}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                              {[PUBLICATION_TYPE_LABELS[item.publicationType] ?? humanize(item.publicationType), venue, item.applicationNumber, when]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <StatusBadge status={item.status} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No research submissions yet"
                  description="Papers, books, chapters and conference papers you submit, or are added to as a co-author, will appear here with their review status."
                  action={{ href: '/research/apply', label: 'Submit your first work' }}
                />
              )}
            </Card>

            {/* IPR applications */}
            <Card title="My IPR applications" icon={Lightbulb} action={<ViewAllLink href="/ipr/my-applications" />}>
              {iprQ.isPending ? (
                <ListSkeleton />
              ) : iprQ.isError ? (
                <ErrorState message="We couldn't load your IPR applications." onRetry={() => iprQ.refetch()} />
              ) : ipr && ipr.items.length > 0 ? (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {ipr.items.map((item) => {
                    const when = relativeTime(item.updatedAt ?? item.createdAt);
                    return (
                      <li key={item.id}>
                        <Link href={`/ipr/applications/${item.id}`} className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blush text-wine dark:bg-gray-800 dark:text-hi">
                            <Lightbulb className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900 group-hover:text-wine dark:text-gray-100 dark:group-hover:text-hi">
                              {item.title || 'Untitled application'}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                              {[IPR_TYPE_LABELS[item.iprType] ?? humanize(item.iprType), item.applicationNumber, when]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <StatusBadge status={item.status} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={Lightbulb}
                  title="No IPR applications yet"
                  description="Patents, copyrights, trademarks and designs you file will appear here as they move through mentor, DRD and filing stages."
                  action={{ href: '/ipr/apply', label: 'Start an application' }}
                />
              )}
            </Card>
          </div>

          <div className="space-y-6">
            {/* Notifications */}
            <Card
              title="Notifications"
              icon={Bell}
              action={
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-wine px-2 py-0.5 text-[11px] font-bold text-wine-fg">{unreadCount} new</span>
                  )}
                  <ViewAllLink href="/notifications" />
                </div>
              }
            >
              {notificationsQ.isPending ? (
                <ListSkeleton rows={4} />
              ) : notificationsQ.isError ? (
                <ErrorState message="We couldn't load your notifications." onRetry={() => notificationsQ.refetch()} />
              ) : (notificationsQ.data?.data ?? []).length > 0 ? (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(notificationsQ.data?.data ?? []).map((n: Notification) => (
                    <li key={n.id}>
                      <Link
                        href={safeInternalPath(n.metadata?.actionUrl) ?? '/notifications'}
                        className="group flex items-start gap-2.5 py-3 first:pt-0 last:pb-0"
                      >
                        <span
                          aria-hidden="true"
                          className={cn('mt-1.5 h-2 w-2 flex-shrink-0 rounded-full', n.isRead ? 'bg-gray-200 dark:bg-gray-700' : 'bg-wine dark:bg-hi')}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'line-clamp-1 text-sm group-hover:text-wine dark:group-hover:text-hi',
                              n.isRead ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-white'
                            )}
                          >
                            {n.title}
                            {!n.isRead && <span className="sr-only"> (unread)</span>}
                          </p>
                          {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{n.message}</p>}
                          {relativeTime(n.createdAt) && (
                            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{relativeTime(n.createdAt)}</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Bell}
                  title="You're all caught up"
                  description="Updates on your submissions — reviews, change requests and approvals — will show up here."
                />
              )}
            </Card>

            {/* Quick actions */}
            <Card title="Quick actions" icon={ClipboardList}>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {QUICK_ACTIONS.map(({ href, label, description, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="group flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:border-wine/15 hover:bg-blush dark:hover:border-gray-700 dark:hover:bg-gray-800"
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-peach/50 text-wine dark:bg-wine/20 dark:text-hi">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900 group-hover:text-wine dark:text-gray-100 dark:group-hover:text-hi">
                          {label}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{description}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-wine dark:text-gray-600 dark:group-hover:text-hi" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Account */}
            <Card title="My account" icon={UserCircle2} action={<ViewAllLink href="/profile" label="Profile" />}>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Name</dt>
                  <dd className="truncate text-right font-medium text-gray-900 dark:text-gray-100">{fullName}</dd>
                </div>
                {user.email && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                    <dd className="truncate text-right font-medium text-gray-900 dark:text-gray-100">{user.email}</dd>
                  </div>
                )}
                {registrationNo && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Registration no.</dt>
                    <dd className="truncate text-right font-medium text-gray-900 dark:text-gray-100">{registrationNo}</dd>
                  </div>
                )}
                {program && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Programme</dt>
                    <dd className="truncate text-right font-medium text-gray-900 dark:text-gray-100">{program}</dd>
                  </div>
                )}
              </dl>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
