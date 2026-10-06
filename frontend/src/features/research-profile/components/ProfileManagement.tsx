import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import type { ProfileData, Publication } from '@/shared/types/research-profile.types';
import ProfilePrivacySettings from './ProfilePrivacySettings';
import { CardHeader, Toggle, panel } from './manageUi';
import {
  researchProfileService,
  type ManualProfileImportPublication,
  type PublicationImportRun,
  type ResearchProfileIdentity,
} from '@/features/research-profile/services/researchProfile.service';
import logger from '@/shared/utils/logger';

interface ProfileManagementProps {
  profileData: ProfileData;
  onProfileUpdate: (updatedProfile: ProfileData) => void;
  onProfileRefresh?: () => Promise<void> | void;
  isOwner: boolean;
  currentUserId: string;
  /** Admin/superadmin may edit ORCID, Scopus, WoS IDs */
  canEditResearchIdentityIds?: boolean;
}

type ManagementTab = 'visibility' | 'publications' | 'sync' | 'export';
type Notify = (type: 'success' | 'error', text: string) => void;

const TABS: { id: ManagementTab; label: string; hint: string; icon: typeof Settings }[] = [
  { id: 'visibility', label: 'Profile & privacy', hint: 'Bio, CV details, who can see it', icon: UserRound },
  { id: 'publications', label: 'Publications', hint: 'Your works and file import', icon: BookOpen },
  { id: 'sync', label: 'Sync settings', hint: 'ORCID, Scopus, OpenAlex', icon: RefreshCw },
  { id: 'export', label: 'Export data', hint: 'PDF, CSV, BibTeX', icon: Download },
];

export default function ProfileManagement({
  profileData,
  onProfileUpdate,
  onProfileRefresh,
  isOwner,
  currentUserId,
  canEditResearchIdentityIds = false,
}: ProfileManagementProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>('visibility');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  if (!isOwner) {
    return (
      <div className={`${panel.card} p-8 text-center`}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blush dark:bg-gray-700">
          <Settings className="h-8 w-8 text-ink-subtle dark:text-gray-500" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-ink dark:text-white">Access Restricted</h3>
        <p className="text-ink-muted dark:text-gray-400">Only the profile owner can manage profile settings.</p>
      </div>
    );
  }

  const showMessage: Notify = (type, text) => {
    setMessage({ type, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // Long sync summaries stay up long enough to read.
    toastTimer.current = setTimeout(() => setMessage(null), text.length > 140 ? 12000 : 5000);
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="Profile settings sections" className="lg:sticky lg:top-6 lg:self-start">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-col lg:overflow-visible">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors lg:w-full ${
                    active
                      ? 'border-wine/25 bg-white shadow-sm dark:border-gold/30 dark:bg-gray-800'
                      : 'border-transparent hover:bg-white/60 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      active ? 'bg-wine text-wine-fg' : 'bg-white text-ink-muted group-hover:text-wine dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block whitespace-nowrap text-sm font-semibold ${active ? 'text-wine dark:text-gold' : 'text-ink dark:text-gray-200'}`}>
                      {tab.label}
                    </span>
                    <span className="hidden text-xs text-ink-muted lg:block dark:text-gray-400">{tab.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">
          {activeTab === 'visibility' && <ProfilePrivacySettings userId={currentUserId} onMessage={showMessage} />}

          {activeTab === 'publications' && (
            <PublicationManagement
              profileData={profileData}
              onUpdate={onProfileUpdate}
              onRefresh={onProfileRefresh}
              onMessage={showMessage}
              loading={loading}
              setLoading={setLoading}
              currentUserId={currentUserId}
            />
          )}

          {activeTab === 'sync' && (
            <SyncSettings
              profileData={profileData}
              onUpdate={onProfileUpdate}
              onMessage={showMessage}
              loading={loading}
              setLoading={setLoading}
              currentUserId={currentUserId}
              canEditResearchIdentityIds={canEditResearchIdentityIds}
            />
          )}

          {activeTab === 'export' && (
            <ExportData profileData={profileData} onMessage={showMessage} loading={loading} setLoading={setLoading} />
          )}
        </div>
      </div>

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg dark:bg-gray-800 ${
            message.type === 'success' ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <p className="text-sm text-ink dark:text-gray-100">{message.text}</p>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="-mr-1 rounded p-0.5 text-ink-subtle hover:text-ink dark:hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  scopus: 'Scopus',
  orcid: 'ORCID',
  openalex: 'OpenAlex',
  google_scholar: 'Google Scholar',
  web_of_science: 'Web of Science',
  manual: 'Imported',
  synced: 'Synced',
};

const PAGE_SIZE = 20;

// Publication Management Component
function PublicationManagement({
  profileData,
  onUpdate,
  onRefresh,
  onMessage,
  loading,
  setLoading,
  currentUserId,
}: {
  profileData: ProfileData;
  onUpdate: (profile: ProfileData) => void;
  onRefresh?: () => Promise<void> | void;
  onMessage: Notify;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  currentUserId: string;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [importing, setImporting] = useState<'bibtex' | 'ris' | 'csv' | null>(null);
  const bibInputRef = useRef<HTMLInputElement | null>(null);
  const risInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const publications = profileData.publications;
  const types = useMemo(() => Array.from(new Set(publications.map((p) => p.publicationType).filter(Boolean))).sort(), [publications]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return publications
      .filter((p) => type === 'all' || p.publicationType === type)
      .filter((p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.venue || '').toLowerCase().includes(q) ||
        p.authors.some((a) => a.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [publications, query, type]);

  const importPublications = async (file: File, format: 'bibtex' | 'ris' | 'csv') => {
    try {
      setLoading(true);
      setImporting(format);
      const content = await file.text();
      const parsedPublications = format === 'bibtex'
        ? parseBibTex(content)
        : format === 'ris'
        ? parseRis(content)
        : parseCsvPublications(content);

      if (parsedPublications.length === 0) {
        onMessage('error', `No valid publications were found in ${file.name}`);
        return;
      }

      const importedPublications = parsedPublications.map((publication, index) =>
        buildPublicationFromParsed(profileData, publication, index)
      );
      const importPayload: ManualProfileImportPublication[] = parsedPublications.map((publication) => ({
        title: publication.title,
        authors: publication.authors,
        venue: publication.venue,
        year: publication.year,
        doi: publication.doi,
        citationCount: publication.citationCount,
        publicationType: publication.publicationType,
      }));

      const result = await researchProfileService.importPublications(currentUserId, importPayload, format);

      const updatedProfile = mergeImportedPublications(profileData, importedPublications);
      const importedCount = updatedProfile.publications.length - profileData.publications.length;

      onUpdate(updatedProfile);
      if (onRefresh) {
        await onRefresh();
      }
      onMessage(
        result.failedCount > 0 ? 'error' : 'success',
        result.failedCount > 0
          ? `Imported with ${result.failedCount} failure(s). ${result.createdCount} created, ${result.updatedCount} updated.`
          : importedCount > 0
          ? `${result.createdCount} publication(s) imported from ${file.name}`
          : `${result.updatedCount} publication(s) updated from ${file.name}`
      );
    } catch (error) {
      logger.error(`Failed to import ${format} publications:`, error);
      onMessage('error', `Failed to import ${file.name}`);
    } finally {
      setLoading(false);
      setImporting(null);
    }
  };

  const handleFileImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
    format: 'bibtex' | 'ris' | 'csv'
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    await importPublications(file, format);
  };

  const importFormats = [
    { format: 'bibtex' as const, ref: bibInputRef, accept: '.bib,text/plain', label: 'BibTeX', ext: '.bib', hint: 'Google Scholar, Zotero, Mendeley' },
    { format: 'ris' as const, ref: risInputRef, accept: '.ris,text/plain', label: 'RIS', ext: '.ris', hint: 'EndNote, Web of Science, Scopus' },
    { format: 'csv' as const, ref: csvInputRef, accept: '.csv,text/csv', label: 'CSV', ext: '.csv', hint: 'Columns: title, authors, venue, year, doi' },
  ];

  return (
    <div className="space-y-6">
      <section className={panel.card}>
        <CardHeader
          icon={BookOpen}
          title="Your publications"
          subtitle={`${publications.length} work${publications.length === 1 ? '' : 's'} on your profile, from sync and file imports.`}
        >
          <a href="/research/my-contributions?tab=synced" className={panel.btnSecondary}>
            Review synced works
          </a>
          <a href="/research/apply" className={panel.btnPrimary}>
            <Plus className="h-4 w-4" />
            Submit new work
          </a>
        </CardHeader>

        {publications.length > 0 && (
          <div className="flex flex-col gap-2 border-b border-blush-line/70 px-5 py-3 sm:flex-row sm:px-6 dark:border-gray-700">
            <label className="relative flex-1">
              <span className="sr-only">Search publications</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
                placeholder="Search by title, venue or author"
                className={`${panel.input} pl-9`}
              />
            </label>
            {types.length > 1 && (
              <label className="sm:w-48">
                <span className="sr-only">Publication type</span>
                <select
                  value={type}
                  onChange={(e) => { setType(e.target.value); setLimit(PAGE_SIZE); }}
                  className={`${panel.input} capitalize`}
                >
                  <option value="all">All types</option>
                  {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {publications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-50 dark:bg-gray-700">
              <FileText className="h-6 w-6 text-gold-dark dark:text-gold" />
            </div>
            <p className="font-medium text-ink dark:text-white">No publications yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted dark:text-gray-400">
              Sync from ORCID or Scopus in Sync settings, or import a file below.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-muted dark:text-gray-400">No publications match your search.</p>
        ) : (
          <ul className="divide-y divide-blush-line/70 dark:divide-gray-700">
            {filtered.slice(0, limit).map((publication) => {
              const shown = publication.authors.slice(0, 6);
              const more = publication.authors.length - shown.length;
              const link = publication.doi ? `https://doi.org/${publication.doi}` : publication.publicationUrl;
              const sources = publication.sourceSystems?.length ? publication.sourceSystems : [publication.source];
              return (
                <li key={publication.id} className="px-5 py-4 sm:px-6">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium leading-snug text-ink dark:text-white">{publication.title}</h4>
                      <p className="mt-1 text-sm text-ink-muted dark:text-gray-400">
                        {shown.map((a, idx) => (
                          <span key={idx} title={a.affiliation || 'No affiliation data'} className="cursor-help hover:text-wine dark:hover:text-gold">
                            {a.name}{idx < shown.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                        {more > 0 && <span> +{more} more</span>}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted dark:text-gray-400">
                        {publication.venue && <span className="max-w-full truncate italic">{publication.venue}</span>}
                        {publication.year ? <span className="tabular-nums">{publication.year}</span> : null}
                        <span className="tabular-nums">{publication.citationCount} citation{publication.citationCount === 1 ? '' : 's'}</span>
                        {publication.publicationType && (
                          <span className="rounded-md bg-blush px-1.5 py-0.5 font-medium capitalize text-ink dark:bg-gray-700 dark:text-gray-200">
                            {publication.publicationType.replace(/_/g, ' ')}
                          </span>
                        )}
                        {sources.filter(Boolean).map((s) => (
                          <span key={s} className="rounded-md border border-blush-line px-1.5 py-0.5 font-medium dark:border-gray-600">
                            {SOURCE_LABEL[s] || s}
                          </span>
                        ))}
                        {publication.isVerified && (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                          </span>
                        )}
                      </div>
                    </div>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg p-2 text-ink-subtle transition-colors hover:bg-blush hover:text-wine dark:hover:bg-gray-700 dark:hover:text-gold"
                        aria-label={`Open ${publication.title}`}
                        title={publication.doi ? `DOI ${publication.doi}` : 'Open publication'}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > limit && (
          <div className="border-t border-blush-line/70 px-6 py-3 text-center dark:border-gray-700">
            <button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE * 2)} className="text-sm font-medium text-wine hover:underline dark:text-gold">
              Show more ({filtered.length - limit} remaining)
            </button>
          </div>
        )}
      </section>

      <section className={panel.card}>
        <CardHeader icon={Upload} title="Import from a file" subtitle="Works that already exist (same title and year) are updated instead of duplicated." />
        <div className={`${panel.body} grid grid-cols-1 gap-3 md:grid-cols-3`}>
          {importFormats.map((f) => (
            <React.Fragment key={f.format}>
              <input
                ref={f.ref}
                type="file"
                accept={f.accept}
                className="hidden"
                onChange={(event) => void handleFileImport(event, f.format)}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => f.ref.current?.click()}
                className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-blush-line p-4 text-left transition-colors hover:border-wine/50 hover:bg-blush-light disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:border-gold/50 dark:hover:bg-gray-700/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blush text-ink-muted transition-colors group-hover:text-wine dark:bg-gray-700 dark:text-gray-300">
                  {importing === f.format ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink dark:text-white">
                    {f.label} <span className="font-mono text-xs font-normal text-ink-subtle">{f.ext}</span>
                  </span>
                  <span className="block text-xs text-ink-muted dark:text-gray-400">{importing === f.format ? 'Importing…' : f.hint}</span>
                </span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </section>
    </div>
  );
}

const STATUS_STYLE: Record<string, { label: string; dot: string; pill: string }> = {
  success: { label: 'Up to date', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  partial_success: { label: 'Partly synced', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  failed: { label: 'Failed', dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  syncing: { label: 'Syncing', dot: 'bg-sky-500 animate-pulse', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  running: { label: 'Running', dot: 'bg-sky-500 animate-pulse', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  pending: { label: 'Pending', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  never_synced: { label: 'Never synced', dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

function statusStyle(status?: string | null) {
  return (
    STATUS_STYLE[status || 'never_synced'] || {
      label: (status || '').replace(/_/g, ' '),
      dot: 'bg-gray-400',
      pill: STATUS_STYLE.never_synced.pill,
    }
  );
}

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

type SyncSource = 'orcid' | 'scopus' | 'openalex' | 'all';

// Sync Settings Component
function SyncSettings({
  profileData,
  onUpdate,
  onMessage,
  loading,
  setLoading,
  currentUserId,
  canEditResearchIdentityIds,
}: {
  profileData: ProfileData;
  onUpdate: (profile: ProfileData) => void;
  onMessage: Notify;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  currentUserId: string;
  canEditResearchIdentityIds: boolean;
}) {
  const [formState, setFormState] = useState({
    orcid: profileData.profile.orcid || '',
    scopusAuthorId: profileData.profile.scopusAuthorId || '',
    webOfScienceId: profileData.profile.webOfScienceId || '',
    autoSyncEnabled: profileData.profile.autoSyncEnabled,
    filterSgtOnly: profileData.profile.filterSgtOnly || false,
    syncFrequencyDays: profileData.profile.syncFrequencyDays || 1,
  });

  React.useEffect(() => {
    if (profileData?.profile) {
      setFormState({
        orcid: profileData.profile.orcid || '',
        scopusAuthorId: profileData.profile.scopusAuthorId || '',
        webOfScienceId: profileData.profile.webOfScienceId || '',
        autoSyncEnabled: profileData.profile.autoSyncEnabled,
        filterSgtOnly: profileData.profile.filterSgtOnly || false,
        syncFrequencyDays: profileData.profile.syncFrequencyDays || 1,
      });
    }
  }, [
    profileData?.profile?.orcid,
    profileData?.profile?.scopusAuthorId,
    profileData?.profile?.webOfScienceId,
    profileData?.profile?.autoSyncEnabled,
    profileData?.profile?.filterSgtOnly,
    profileData?.profile?.syncFrequencyDays,
  ]);
  const [recentRuns, setRecentRuns] = useState<PublicationImportRun[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [busy, setBusy] = useState<SyncSource | 'save' | null>(null);

  const applyIdentityUpdate = (
    identity: Partial<ResearchProfileIdentity>,
    message?: string
  ) => {
    onUpdate({
      ...profileData,
      profile: {
        ...profileData.profile,
        orcid: identity.orcid ?? profileData.profile.orcid,
        scopusAuthorId: identity.scopusAuthorId ?? profileData.profile.scopusAuthorId,
        webOfScienceId: identity.webOfScienceId ?? profileData.profile.webOfScienceId,
        lastSyncedAt: identity.lastSyncedAt ?? profileData.profile.lastSyncedAt,
        syncStatus: (identity.syncStatus as any) ?? profileData.profile.syncStatus,
        syncError: identity.syncError ?? profileData.profile.syncError,
        autoSyncEnabled: identity.autoSyncEnabled ?? profileData.profile.autoSyncEnabled,
        filterSgtOnly: identity.filterSgtOnly ?? profileData.profile.filterSgtOnly,
        syncFrequencyDays: identity.syncFrequencyDays ?? profileData.profile.syncFrequencyDays,
      },
    });
    if (message) {
      onMessage('success', message);
    }
  };

  const loadImportRuns = async (quiet = false) => {
    try {
      setRunsLoading(true);
      const runs = await researchProfileService.getImportRuns(currentUserId);
      setRecentRuns(runs);
      setRunsLoaded(true);
    } catch (error) {
      logger.error('Failed to load import runs:', error);
      if (!quiet) onMessage('error', 'Failed to load recent sync runs');
    } finally {
      setRunsLoading(false);
    }
  };

  useEffect(() => {
    void loadImportRuns(true);
  }, [currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const settingsPayload = () =>
    canEditResearchIdentityIds
      ? formState
      : {
          autoSyncEnabled: formState.autoSyncEnabled,
          filterSgtOnly: formState.filterSgtOnly,
          syncFrequencyDays: formState.syncFrequencyDays,
        };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setBusy('save');
      const identity = await researchProfileService.updateIdentity(currentUserId, settingsPayload());
      applyIdentityUpdate(identity, 'Research identity settings saved');
    } catch (error) {
      logger.error('Failed to save identity settings:', error);
      onMessage('error', 'Failed to save research identity settings');
    } finally {
      setLoading(false);
      setBusy(null);
    }
  };

  const handleManualSync = async (source: SyncSource) => {
    try {
      setLoading(true);
      setBusy(source);
      // Persist filter/sync toggles before sync so a checked "my university only" box
      // is applied even if the user did not click Save Settings first.
      try {
        const identity = await researchProfileService.updateIdentity(currentUserId, settingsPayload());
        applyIdentityUpdate(identity);
      } catch (saveError) {
        logger.warn('Could not persist identity settings before sync:', saveError);
      }

      const result = await researchProfileService.syncProfile(currentUserId, source);
      applyIdentityUpdate({
        lastSyncedAt: new Date().toISOString(),
        syncStatus: result.failedCount > 0 ? 'failed' : 'success',
        syncError: result.failedCount > 0 ? `${result.failedCount} publication(s) failed during sync` : null,
      });
      await loadImportRuns();
      const skippedSources = (result.errors || [])
        .filter((item: { skipped?: boolean; message?: string }) => item.skipped && item.message)
        .map((item: { message?: string }) => item.message);
      onMessage(
        'success',
        `Sync completed: ${result.createdCount} new, ${result.updatedCount} updated, ${result.skippedCount || 0} unchanged.${result.affiliation ? ` ${result.affiliation.affiliated} affiliated with your university (eligible for incentive), ${result.affiliation.unknown} need DRD verification, ${result.affiliation.not_affiliated} from other institutions.` : ''} Nothing is submitted automatically: open My Contributions → Synced works to submit them.${skippedSources.length ? ` ${skippedSources.join(' ')}` : ''}`
      );
    } catch (error) {
      logger.error('Sync failed:', error);
      onMessage('error', 'Failed to sync profile');
    } finally {
      setLoading(false);
      setBusy(null);
    }
  };

  const saved = profileData.profile;
  const syncing = busy !== null && busy !== 'save';
  const status = statusStyle(syncing ? 'syncing' : saved.syncStatus);
  const dirty =
    formState.autoSyncEnabled !== saved.autoSyncEnabled ||
    formState.filterSgtOnly !== (saved.filterSgtOnly || false) ||
    formState.syncFrequencyDays !== (saved.syncFrequencyDays || 1) ||
    (canEditResearchIdentityIds &&
      (formState.orcid !== (saved.orcid || '') ||
        formState.scopusAuthorId !== (saved.scopusAuthorId || '') ||
        formState.webOfScienceId !== (saved.webOfScienceId || '')));

  const sources: { id: Exclude<SyncSource, 'all'>; name: string; detail: string; connected: boolean; needs?: string }[] = [
    {
      id: 'scopus',
      name: 'Scopus',
      detail: formState.scopusAuthorId ? `Author ID ${formState.scopusAuthorId}` : 'No Scopus author ID linked',
      connected: Boolean(formState.scopusAuthorId),
      needs: formState.scopusAuthorId ? undefined : 'Needs a Scopus author ID',
    },
    {
      id: 'orcid',
      name: 'ORCID',
      detail: formState.orcid || 'No ORCID iD linked',
      connected: Boolean(formState.orcid),
      needs: formState.orcid ? undefined : 'Needs an ORCID iD',
    },
    {
      id: 'openalex',
      name: 'OpenAlex',
      detail: 'Matched through your ORCID or Scopus ID, never by name alone',
      connected: Boolean(formState.orcid || formState.scopusAuthorId),
    },
  ];

  const idFields: { key: 'orcid' | 'scopusAuthorId' | 'webOfScienceId'; label: string; placeholder: string }[] = [
    { key: 'orcid', label: 'ORCID iD', placeholder: '0000-0000-0000-0000' },
    { key: 'scopusAuthorId', label: 'Scopus author ID', placeholder: 'e.g. 57200000000' },
    { key: 'webOfScienceId', label: 'Web of Science ResearcherID', placeholder: 'Optional' },
  ];

  return (
    <div className="space-y-6">
      {/* Status */}
      <section className={panel.card}>
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-dark dark:bg-gray-700 dark:text-gold">
              <RefreshCw className={`h-6 w-6 ${syncing ? 'animate-spin' : ''}`} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={panel.title}>Publication sync</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${status.pill}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>
              <p className={panel.subtitle}>
                {saved.lastSyncedAt
                  ? `Last synced ${timeAgo(saved.lastSyncedAt)} (${new Date(saved.lastSyncedAt).toLocaleString()})`
                  : 'Not synced yet'}
                {saved.autoSyncEnabled && ` · Auto sync every ${saved.syncFrequencyDays === 1 ? 'day' : `${saved.syncFrequencyDays} days`}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/research/my-contributions?tab=synced" className={panel.btnSecondary}>
              Review &amp; submit for incentive
            </a>
            <button type="button" onClick={() => handleManualSync('all')} disabled={loading} className={panel.btnPrimary}>
              <RefreshCw className={`h-4 w-4 ${busy === 'all' ? 'animate-spin' : ''}`} />
              {busy === 'all' ? 'Syncing…' : 'Sync all sources'}
            </button>
          </div>
        </div>
        <div className="border-t border-blush-line/70 bg-blush-light/60 px-5 py-3 text-xs text-ink-muted sm:px-6 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          With a Scopus ID, <strong className="font-semibold text-ink dark:text-gray-200">Sync all</strong> uses Scopus only (fastest, and what your profile counts); without one it uses ORCID and OpenAlex.
          Synced works are saved as drafts. Works affiliated with your university can be submitted for incentive from My Contributions.
        </div>
        {saved.syncError && (
          <div className="flex items-start gap-2 rounded-b-2xl border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 sm:px-6 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong className="font-semibold">Last sync error:</strong> {saved.syncError}</span>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Sources */}
        <section className={panel.card}>
          <CardHeader icon={Sparkles} title="Sources" subtitle="Sync one source on its own." />
          <ul className="divide-y divide-blush-line/70 dark:divide-gray-700">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.connected ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink dark:text-white">{s.name}</div>
                  <div className="truncate text-xs text-ink-muted dark:text-gray-400">{s.detail}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleManualSync(s.id)}
                  disabled={loading || (s.id !== 'openalex' && !s.connected)}
                  title={s.needs}
                  className={panel.btnSecondary}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy === s.id ? 'animate-spin' : ''}`} />
                  {busy === s.id ? 'Syncing…' : 'Sync'}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Identifiers */}
        <section className={panel.card}>
          <CardHeader
            icon={Fingerprint}
            title="Research identifiers"
            subtitle={canEditResearchIdentityIds ? 'Used to find your works. Double-check before syncing.' : 'Set by your institution. Ask an administrator to change them.'}
          >
            {!canEditResearchIdentityIds && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blush px-2 py-0.5 text-xs font-medium text-ink-muted dark:bg-gray-700 dark:text-gray-300">
                <Lock className="h-3 w-3" /> Read only
              </span>
            )}
          </CardHeader>
          <div className={`${panel.body} space-y-4`}>
            {idFields.map((f) => (
              <div key={f.key}>
                <label htmlFor={`id-${f.key}`} className={panel.label}>{f.label}</label>
                <input
                  id={`id-${f.key}`}
                  type="text"
                  readOnly={!canEditResearchIdentityIds}
                  value={formState[f.key]}
                  onChange={(e) => setFormState((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={canEditResearchIdentityIds ? f.placeholder : 'Not set'}
                  className={`mt-1.5 font-mono ${panel.input} ${
                    !canEditResearchIdentityIds ? 'cursor-not-allowed bg-blush-light text-ink-muted dark:bg-gray-900/40 dark:text-gray-400' : ''
                  }`}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Automation */}
      <section className={panel.card}>
        <CardHeader icon={Clock} title="Automation" subtitle="How and when your publications are refreshed." />
        <ul className="divide-y divide-blush-line/70 dark:divide-gray-700">
          <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink dark:text-white">Automatic sync</div>
              <div className="text-xs text-ink-muted dark:text-gray-400">Fetch new works from your linked sources on a schedule.</div>
            </div>
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 text-sm text-ink-muted dark:text-gray-400 ${formState.autoSyncEnabled ? '' : 'opacity-50'}`}>
                Every
                <input
                  type="number"
                  min={1}
                  value={formState.syncFrequencyDays}
                  disabled={!formState.autoSyncEnabled}
                  onChange={(e) => setFormState((prev) => ({ ...prev, syncFrequencyDays: Math.max(1, Number(e.target.value) || 1) }))}
                  className={`h-10 w-20 rounded-lg border border-blush-line bg-white px-2 text-center text-sm tabular-nums text-ink outline-none focus:border-wine focus:ring-2 focus:ring-wine/15 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100`}
                  aria-label="Sync frequency in days"
                />
                {formState.syncFrequencyDays === 1 ? 'day' : 'days'}
              </label>
              <Toggle
                label="Automatic sync"
                checked={formState.autoSyncEnabled}
                onChange={(v) => setFormState((prev) => ({ ...prev, autoSyncEnabled: v }))}
              />
            </div>
          </li>
          <li className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink dark:text-white">My university&apos;s works only</div>
              <div className="text-xs text-ink-muted dark:text-gray-400">Ask Scopus only for works where you were affiliated with this university.</div>
            </div>
            <Toggle
              label="My university's works only"
              checked={formState.filterSgtOnly}
              onChange={(v) => setFormState((prev) => ({ ...prev, filterSgtOnly: v }))}
            />
          </li>
        </ul>
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-blush-line/70 bg-blush-light/60 px-5 py-3 sm:px-6 dark:border-gray-700 dark:bg-gray-900/30">
          {dirty && <span className="mr-auto text-sm text-amber-700 dark:text-amber-300">Unsaved changes</span>}
          <button type="button" onClick={handleSaveSettings} disabled={loading || !dirty} className={panel.btnPrimary}>
            {busy === 'save' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy === 'save' ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </section>

      {/* Recent runs */}
      <section className={panel.card}>
        <CardHeader icon={Clock} title="Recent sync runs" subtitle="The latest imports into your profile.">
          <button type="button" onClick={() => loadImportRuns()} disabled={runsLoading} className={panel.btnSecondary}>
            <RefreshCw className={`h-3.5 w-3.5 ${runsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </CardHeader>
        {!runsLoaded && runsLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-blush dark:bg-gray-700" />)}
          </div>
        ) : recentRuns.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-muted dark:text-gray-400">No sync runs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted dark:text-gray-400">
                  <th className="px-5 py-2.5 sm:px-6">Started</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">New</th>
                  <th className="px-3 py-2.5 text-right">Updated</th>
                  <th className="px-3 py-2.5 text-right">Review</th>
                  <th className="px-5 py-2.5 text-right sm:px-6">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blush-line/70 dark:divide-gray-700">
                {recentRuns.map((run) => {
                  const s = statusStyle(run.status);
                  return (
                    <tr key={run.id} className="text-ink dark:text-gray-200">
                      <td className="whitespace-nowrap px-5 py-3 sm:px-6">
                        <div>{new Date(run.startedAt).toLocaleString()}</div>
                        <div className="text-xs capitalize text-ink-muted dark:text-gray-400">{run.triggerType.replace(/_/g, ' ')}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {(run.sourceSystems.length ? run.sourceSystems : ['manual']).map((src) => SOURCE_LABEL[src] || src).join(', ')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{run.createdCount}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{run.updatedCount}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{run.specialReviewCount}</td>
                      <td className={`px-5 py-3 text-right tabular-nums sm:px-6 ${run.failedCount > 0 ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>
                        {run.failedCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type ParsedPublicationInput = {
  title: string;
  authors: string[];
  venue?: string;
  year?: number;
  doi?: string | null;
  citationCount?: number;
  publicationType?: string;
};

function escapeCsv(value: string | number | null | undefined) {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function triggerTextDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeAuthorName(name: string, authorOrder: number) {
  return {
    name: name.trim(),
    affiliation: null,
    email: null,
    isCorresponding: authorOrder === 0,
    authorOrder,
  };
}

function buildPublicationFromParsed(
  profileData: ProfileData,
  publication: ParsedPublicationInput,
  index: number
): Publication {
  const now = new Date().toISOString();
  const fallbackYear = new Date().getFullYear();
  return {
    id: `imported_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    profileId: profileData.profile.id,
    researchContributionId: null,
    title: publication.title.trim(),
    authors: (publication.authors.length > 0 ? publication.authors : [profileData.user.name])
      .map((author, authorOrder) => normalizeAuthorName(author, authorOrder)),
    venue: publication.venue?.trim() || 'Imported publication',
    publicationType: publication.publicationType?.trim() || 'journal',
    year: publication.year || fallbackYear,
    volume: null,
    issue: null,
    pages: null,
    doi: publication.doi?.trim() || null,
    isbn: null,
    issn: null,
    arxivId: null,
    pubmedId: null,
    citationCount: publication.citationCount || 0,
    citationsPerYear: {},
    source: 'manual',
    externalId: null,
    pdfUrl: null,
    publicationUrl: null,
    abstract: null,
    keywords: [],
    isVerified: false,
    createdAt: now,
    updatedAt: now,
  };
}

function mergeImportedPublications(profileData: ProfileData, imports: Publication[]): ProfileData {
  const existingKeys = new Set(
    profileData.publications.map((publication) => `${publication.title.toLowerCase()}::${publication.year}`)
  );

  const uniqueImports = imports.filter((publication) => {
    const key = `${publication.title.toLowerCase()}::${publication.year}`;
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });

  const publications = [...uniqueImports, ...profileData.publications];
  const totalCitations = publications.reduce((sum, publication) => sum + publication.citationCount, 0);
  const avgCitationsPerPaper = publications.length > 0
    ? parseFloat((totalCitations / publications.length).toFixed(2))
    : 0;

  return {
    ...profileData,
    publications,
    profile: {
      ...profileData.profile,
      metrics: {
        ...profileData.profile.metrics,
        totalCitations,
        avgCitationsPerPaper,
      },
    },
  };
}

function parseBibTex(content: string): ParsedPublicationInput[] {
  const entryMatches = content.match(/@\w+\s*\{[\s\S]*?\n\}/g) || [];
  const publications: ParsedPublicationInput[] = [];

  entryMatches.forEach((entry) => {
      const readField = (field: string) => {
        const match = entry.match(new RegExp(`${field}\\s*=\\s*[{\"]([\\s\\S]*?)[}\"]\\s*,?`, 'i'));
        return match?.[1]?.replace(/\s+/g, ' ').trim();
      };

      const title = readField('title');
      if (!title) return;

      const authors = (readField('author') || '')
        .split(/\s+and\s+/i)
        .map((author) => author.trim())
        .filter(Boolean);

      const yearValue = readField('year');
      const citationValue = readField('citations');
      publications.push({
        title,
        authors,
        venue: readField('journal') || readField('booktitle') || readField('publisher'),
        year: yearValue ? Number.parseInt(yearValue, 10) : undefined,
        doi: readField('doi') || null,
        citationCount: citationValue ? Number.parseInt(citationValue, 10) || 0 : 0,
        publicationType: readField('entrytype') || 'journal',
      });
    });

  return publications;
}

function parseRis(content: string): ParsedPublicationInput[] {
  const publications: ParsedPublicationInput[] = [];

  content
    .split(/\nER\s*-\s*/i)
    .map((block) => block.trim())
    .filter(Boolean)
    .forEach((block) => {
      const lines = block.split(/\r?\n/);
      const values: Record<string, string[]> = {};

      lines.forEach((line) => {
        const match = line.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/);
        if (!match) return;
        const [, key, value] = match;
        values[key] = values[key] || [];
        values[key].push(value.trim());
      });

      const title = values.TI?.[0] || values.T1?.[0];
      if (!title) return;

      const yearValue = values.PY?.[0] || values.Y1?.[0];
      const yearMatch = yearValue?.match(/\d{4}/);

      publications.push({
        title,
        authors: values.AU || values.A1 || [],
        venue: values.JO?.[0] || values.JF?.[0] || values.T2?.[0],
        year: yearMatch ? Number.parseInt(yearMatch[0], 10) : undefined,
        doi: values.DO?.[0] || null,
        citationCount: 0,
        publicationType: 'journal',
      });
    });

  return publications;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsvPublications(content: string): ParsedPublicationInput[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());

  const publications: ParsedPublicationInput[] = [];

  lines.slice(1).forEach((line) => {
      const columns = parseCsvLine(line);
      const getValue = (...keys: string[]) => {
        const index = headers.findIndex((header) => keys.includes(header));
        return index >= 0 ? columns[index] : '';
      };

      const title = getValue('title', 'paper title', 'publication title');
      if (!title) return;

      const authors = getValue('authors', 'author')
        .split(/[;,]/)
        .map((author) => author.trim())
        .filter(Boolean);

      const yearValue = getValue('year', 'publication year');
      const citationValue = getValue('citations', 'citationcount', 'citation count');

      publications.push({
        title,
        authors,
        venue: getValue('venue', 'journal', 'conference', 'publisher'),
        year: yearValue ? Number.parseInt(yearValue, 10) : undefined,
        doi: getValue('doi') || null,
        citationCount: citationValue ? Number.parseInt(citationValue, 10) || 0 : 0,
        publicationType: getValue('publicationtype', 'publication type', 'type') || 'journal',
      });
    });

  return publications;
}

function buildCsvExport(profileData: ProfileData) {
  const header = [
    'Title',
    'Authors',
    'Venue',
    'Year',
    'Publication Type',
    'DOI',
    'Citations',
    'Source',
  ];

  const rows = profileData.publications.map((publication) => [
    escapeCsv(publication.title),
    escapeCsv(publication.authors.map((author) => author.name).join('; ')),
    escapeCsv(publication.venue),
    escapeCsv(publication.year),
    escapeCsv(publication.publicationType),
    escapeCsv(publication.doi),
    escapeCsv(publication.citationCount),
    escapeCsv(publication.source),
  ]);

  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function buildBibTexExport(profileData: ProfileData) {
  return profileData.publications
    .map((publication, index) => {
      const citationKey = `${profileData.user.name.split(' ')[0] || 'author'}${publication.year}${index + 1}`
        .replace(/[^a-zA-Z0-9]/g, '');
      return [
        `@article{${citationKey},`,
        `  title = {${publication.title}},`,
        `  author = {${publication.authors.map((author) => author.name).join(' and ')}},`,
        `  journal = {${publication.venue}},`,
        `  year = {${publication.year}},`,
        publication.doi ? `  doi = {${publication.doi}},` : null,
        '}',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function buildPrintableHtml(profileData: ProfileData) {
  const publicationItems = profileData.publications
    .map((publication) => `
      <li>
        <strong>${publication.title}</strong><br />
        ${publication.authors.map((author) => author.name).join(', ')}<br />
        ${publication.venue} | ${publication.year} | Citations: ${publication.citationCount}
      </li>
    `)
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <title>${profileData.user.name} Research Profile</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
          h1, h2 { margin-bottom: 8px; }
          p { margin: 4px 0; }
          ul { padding-left: 20px; }
          li { margin-bottom: 14px; }
        </style>
      </head>
      <body>
        <h1>${profileData.user.name}</h1>
        <p>${profileData.user.designation} | ${profileData.user.department} | ${profileData.user.school}</p>
        <p>Email: ${profileData.user.email}</p>
        <h2>Profile Summary</h2>
        <p>Total Publications: ${profileData.publications.length}</p>
        <p>Total Citations: ${profileData.profile.metrics.totalCitations}</p>
        <p>h-index: ${profileData.profile.metrics.hIndex}</p>
        <h2>Publications</h2>
        <ul>${publicationItems}</ul>
      </body>
    </html>
  `;
}

// Export Data Component
function ExportData({
  profileData,
  onMessage,
  loading,
  setLoading
}: {
  profileData: ProfileData;
  onMessage: Notify;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const handleExport = async (format: 'pdf' | 'csv' | 'bibtex') => {
    try {
      setLoading(true);
      const safeName = profileData.user.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'research-profile';

      if (format === 'csv') {
        triggerTextDownload(
          `${safeName}-publications.csv`,
          buildCsvExport(profileData),
          'text/csv;charset=utf-8;'
        );
        onMessage('success', 'CSV export downloaded');
        return;
      }

      if (format === 'bibtex') {
        triggerTextDownload(
          `${safeName}-publications.bib`,
          buildBibTexExport(profileData),
          'text/plain;charset=utf-8;'
        );
        onMessage('success', 'BibTeX export downloaded');
        return;
      }

      const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
      if (!printWindow) {
        onMessage('error', 'Popup blocked. Please allow popups to export PDF.');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(buildPrintableHtml(profileData));
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      onMessage('success', 'Print dialog opened. Choose "Save as PDF" to download the report.');
    } catch (error) {
      logger.error('Export failed:', error);
      onMessage('error', 'Failed to export profile');
    } finally {
      setLoading(false);
    }
  };

  const count = profileData.publications.length;
  const formats = [
    { id: 'pdf' as const, icon: FileText, title: 'PDF report', ext: '.pdf', detail: 'Profile summary, metrics and every publication, ready to print or save.' },
    { id: 'csv' as const, icon: FileSpreadsheet, title: 'Spreadsheet', ext: '.csv', detail: 'One row per publication with authors, venue, year, DOI and citations.' },
    { id: 'bibtex' as const, icon: BookOpen, title: 'BibTeX', ext: '.bib', detail: 'For LaTeX, Zotero, Mendeley and other reference managers.' },
  ];

  return (
    <section className={panel.card}>
      <CardHeader
        icon={Download}
        title="Export your data"
        subtitle={`Download a copy of your ${count} publication${count === 1 ? '' : 's'}. For the one-page research CV, use Download CV on your profile.`}
      />
      <div className={`${panel.body} grid grid-cols-1 gap-4 md:grid-cols-3`}>
        {formats.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => handleExport(f.id)}
            disabled={loading || count === 0}
            className="group flex flex-col items-start rounded-xl border border-blush-line p-5 text-left transition-all hover:-translate-y-0.5 hover:border-wine/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none dark:border-gray-700 dark:hover:border-gold/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-dark transition-colors group-hover:bg-wine group-hover:text-wine-fg dark:bg-gray-700 dark:text-gold">
              <f.icon className="h-5 w-5" />
            </span>
            <span className="mt-4 text-sm font-semibold text-ink dark:text-white">
              {f.title} <span className="font-mono text-xs font-normal text-ink-subtle">{f.ext}</span>
            </span>
            <span className="mt-1 flex-1 text-xs leading-relaxed text-ink-muted dark:text-gray-400">{f.detail}</span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-wine dark:text-gold">
              <Download className="h-4 w-4" /> Download
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
