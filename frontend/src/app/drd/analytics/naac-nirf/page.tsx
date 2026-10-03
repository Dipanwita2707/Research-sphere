'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Award, CalendarRange, GraduationCap, Landmark, RefreshCw, ShieldAlert } from 'lucide-react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import { AnalyticsHero, AnalyticsPanel, AnalyticsShell } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import {
  DownloadButton,
  ReportCard,
  fyLabel,
  fyStartOf,
  reportsService,
  useReportSummary,
  type CompletenessItem,
  type IncludedSheet,
  type PaperYearBasis,
  type PreviewStat,
  type ReportSummary,
} from '@/features/reports';

const MIN_YEAR = 2000;
const MAX_SPAN = 10;

const nf = (n: number) => n.toLocaleString('en-IN');
const plural = (n: number, one: string, many = `${one}s`) => `${nf(n)} ${n === 1 ? one : many}`;
const inr = (n: number) => {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${nf(Math.round(n))}`;
};

const NAAC_SHEETS: IncludedSheet[] = [
  { name: 'Read me', detail: 'Institution, period, data sources and data-quality notes' },
  { name: '3.1.1 Grants', detail: 'Project, PI/Co-PI, department, year of award, amount sanctioned, duration, agency, Govt/Non-Govt' },
  { name: '3.1 Yearwise funding', detail: 'Amount received per year from fund receipts; sanctioned-amount fallbacks flagged' },
  { name: '3.3.1 Papers', detail: 'Title, authors, teacher department, journal, year, ISSN, UGC-CARE Y/N, DOI/link' },
  { name: '3.3.1 Per teacher', detail: 'Papers per teacher per year with yearly averages' },
  { name: '3.3.2 Books & chapters', detail: 'Books, chapters in edited volumes and conference-proceedings papers' },
  { name: '3.3.2 Per teacher', detail: 'Books/chapters/proceedings per teacher per year' },
  { name: '3.2 Workshops', detail: 'NAAC headers only — not tracked in ResearchSphere', manual: true },
  { name: '3.4 Extension activities', detail: 'NAAC headers only — not tracked in ResearchSphere', manual: true },
  { name: '3.5 Collaborations & MoUs', detail: 'NAAC headers only — not tracked in ResearchSphere', manual: true },
];

const NIRF_SHEETS: IncludedSheet[] = [
  { name: 'Read me', detail: 'Institution, financial years, sources and data-quality notes' },
  { name: 'Publications', detail: 'Papers per FY by Scopus / Web of Science / PubMed / others, with citations and coverage' },
  { name: 'Patents (FY and calendar year)', detail: 'Filed, published and granted — NIRF DCS uses calendar years' },
  { name: 'Sponsored Research', detail: 'Projects, funding agencies and amount received per FY (with amount in words)' },
  { name: 'Sponsored Projects (detail)', detail: 'Amount received per project per FY; fallbacks flagged' },
  { name: 'PhD Students', detail: 'Pursuing at FY end and graduated per FY (full/part-time split left to fill)' },
  { name: 'Consultancy', detail: 'NIRF headers only — not tracked in ResearchSphere', manual: true },
];

function naacCompleteness(s: ReportSummary): CompletenessItem[] {
  const c = s.naac.completeness;
  return [
    { key: 'ugc', label: 'UGC-CARE status recorded on papers', ratio: c.ugcCareKnown, hint: (n) => `${plural(n, 'paper')} ${n === 1 ? 'has' : 'have'} no UGC-CARE status — set it in the contribution review.` },
    { key: 'issn', label: 'ISSN recorded on papers', ratio: c.paperIssn, hint: (n) => `${plural(n, 'paper')} ${n === 1 ? 'has' : 'have'} no ISSN — add it on the contribution record.` },
    { key: 'link', label: 'DOI or article link on papers', ratio: c.paperLink, hint: (n) => `${plural(n, 'paper')} ${n === 1 ? 'has' : 'have'} no DOI or link — NAAC asks for a link to the article.` },
    { key: 'sanctioned', label: 'Sanctioned amount on grants', ratio: c.grantSanctionedAmount, hint: (n) => `${plural(n, 'grant')} ${n === 1 ? 'has' : 'have'} no sanctioned amount — the submitted amount is used; record the sanction on the grant.` },
    { key: 'sanction-date', label: 'Sanction date on grants', ratio: c.grantSanctionDate, hint: (n) => `${plural(n, 'grant')} ${n === 1 ? 'has' : 'have'} no sanction date — year of award falls back to the project start date.` },
    { key: 'receipts', label: 'Year-wise funding from fund receipts', ratio: c.fundingFromReceipts, hint: (n) => `${plural(n, 'grant')} ${n === 1 ? 'has' : 'have'} no fund receipts — the sanctioned amount is used and flagged in the workbook.` },
  ];
}

function nirfCompleteness(s: ReportSummary): CompletenessItem[] {
  const c = s.nirf.completeness;
  return [
    { key: 'citations', label: 'Citation counts on papers', ratio: c.citationCoverage, hint: (n) => `${plural(n, 'paper')} ${n === 1 ? 'has' : 'have'} no citation count — run publication sync to fetch them.` },
    { key: 'receipts', label: 'Amount received from fund receipts', ratio: c.fundingFromReceipts, hint: (n) => `${plural(n, 'project')} ${n === 1 ? 'has' : 'have'} no fund receipts — the sanctioned amount is used and flagged.` },
    { key: 'filing', label: 'Filing date on filed patents', ratio: c.patentFilingDate, hint: (n) => `${plural(n, 'patent')} marked as filed ${n === 1 ? 'has' : 'have'} no government filing date — add it in IPR management.` },
    { key: 'phd', label: 'PhD registration date on doctoral records', ratio: c.phdRegistrationDate, hint: (n) => `${plural(n, 'doctoral record')} ${n === 1 ? 'has' : 'have'} no PhD registration date — update the student record.` },
  ];
}

function naacStats(s: ReportSummary): PreviewStat[] {
  const n = s.naac;
  const years = n.papers.perYear.filter((y) => y.perTeacher !== null);
  const avg = years.length ? years.reduce((sum, y) => sum + (y.perTeacher || 0), 0) / years.length : null;
  return [
    { label: 'Journal papers (3.3.1)', value: nf(n.papers.count), hint: `${nf(n.papers.ugcCareListed)} UGC-CARE listed` },
    { label: 'Books, chapters, proceedings (3.3.2)', value: nf(n.booksChapters.count), hint: `${nf(n.booksChapters.books)} books · ${nf(n.booksChapters.chapters)} chapters` },
    { label: 'Grants awarded (3.1.1)', value: nf(n.grants.count), hint: `${inr(n.grants.totalSanctioned)} sanctioned` },
    { label: 'Funding received (3.1)', value: inr(n.grants.receivedTotal), hint: n.grants.fundingFallbackRows ? `${nf(n.grants.fundingFallbackRows)} using fallback` : 'All from receipts' },
    { label: 'Teachers', value: nf(n.teachers.active), hint: `${nf(n.teachers.total)} faculty records` },
    { label: 'Papers per teacher / year', value: avg === null ? '—' : avg.toFixed(2), hint: 'Average over the years' },
  ];
}

function nirfStats(s: ReportSummary): PreviewStat[] {
  const n = s.nirf;
  return [
    { label: 'Publications', value: nf(n.publications.total), hint: 'Journal + conference papers' },
    { label: 'Citations', value: nf(n.citations.total), hint: `${nf(n.citations.papersWithData)} papers with data` },
    { label: 'Patents filed / published / granted', value: `${nf(n.patents.filed)} / ${nf(n.patents.published)} / ${nf(n.patents.granted)}` },
    { label: 'Sponsored projects', value: nf(n.sponsoredResearch.projects), hint: 'Receiving funds in the FYs' },
    { label: 'Amount received', value: inr(n.sponsoredResearch.amountReceived), hint: n.sponsoredResearch.fallbackAmount ? `${inr(n.sponsoredResearch.fallbackAmount)} from fallback` : undefined },
    { label: 'PhD pursuing / graduated', value: `${nf(n.phd.enrolledLatest)} / ${nf(n.phd.graduated)}`, hint: 'Pursuing at the last FY end' },
  ];
}

function naacNotes(s: ReportSummary): string[] {
  const out: string[] = [];
  if (s.naac.undatedPublications) out.push(`${plural(s.naac.undatedPublications, 'approved publication')} without a publication date cannot be placed in a year and are left out.`);
  if (s.naac.papers.withoutTeacher) out.push(`${plural(s.naac.papers.withoutTeacher, 'paper')} have no author linked to a faculty account and are not counted per teacher.`);
  if (s.naac.grants.excludedProposals) out.push(`${plural(s.naac.grants.excludedProposals, 'approved grant record')} still marked "submitted" to the agency are treated as proposals and left out.`);
  return out;
}

function nirfNotes(s: ReportSummary): string[] {
  const out = ['Full-time / part-time PhD status is not recorded — totals are given for you to split.'];
  if (s.nirf.phd.inactiveWithoutAward) out.push(`${plural(s.nirf.phd.inactiveWithoutAward, 'inactive doctoral record')} without an award date are not counted as pursuing.`);
  if (s.nirf.patents.publishedWithoutDate) out.push(`${plural(s.nirf.patents.publishedWithoutDate, 'patent')} marked published have no publication date.`);
  return out;
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-md px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 ${
            value === o.value ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber' : 'text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function NaacNirfReportsPage() {
  const router = useRouter();
  const now = new Date();
  const thisYear = now.getFullYear();
  const currentFy = fyStartOf(now);

  const [fromYear, setFromYear] = useState(thisYear - 5);
  const [toYear, setToYear] = useState(thisYear - 1);
  const [paperYearBasis, setPaperYearBasis] = useState<PaperYearBasis>('calendar');
  const [fyStarts, setFyStarts] = useState<number[]>([currentFy - 3, currentFy - 2, currentFy - 1]);

  const yearOptions = useMemo(() => Array.from({ length: thisYear + 1 - MIN_YEAR + 1 }, (_, i) => thisYear + 1 - i), [thisYear]);
  const fyOptions = useMemo(() => Array.from({ length: 8 }, (_, i) => currentFy - 7 + i), [currentFy]);

  const naacError =
    fromYear > toYear ? 'The start year must not be after the end year.'
    : toYear - fromYear + 1 > MAX_SPAN ? `Choose at most ${MAX_SPAN} years.`
    : null;
  const sortedFys = useMemo(() => [...fyStarts].sort((a, b) => a - b), [fyStarts]);
  const nirfError = sortedFys.length === 0 ? 'Select at least one financial year.' : null;

  // An invalid selection keeps the last preview on screen instead of fetching.
  const { data, loading, error, status, reload } = useReportSummary(
    { fromYear, toYear, paperYearBasis, financialYears: sortedFys.map(fyLabel) },
    { enabled: !naacError && !nirfError },
  );
  const accessDenied = status === 403;
  const code = data?.university.code || 'report';
  const naacFile = `NAAC-Criterion3-${code}-${fromYear}-${toYear}.xlsx`;
  const nirfFile = sortedFys.length === 1
    ? `NIRF-Research-${code}-${fyLabel(sortedFys[0])}.xlsx`
    : `NIRF-Research-${code}-${fyLabel(sortedFys[0] ?? currentFy)}-to-${fyLabel(sortedFys[sortedFys.length - 1] ?? currentFy)}.xlsx`;

  const toggleFy = (y: number) =>
    setFyStarts((prev) => (prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y]));

  if (accessDenied) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-[#faf8f6] p-6 dark:bg-gray-900">
          <div className={`w-full max-w-md p-8 text-center ${ui.card}`}>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-300" aria-hidden />
            </div>
            <h1 className="mb-3 text-xl font-semibold text-stone-900 dark:text-white">Access denied</h1>
            <p className="mb-6 text-sm text-stone-600 dark:text-gray-400">
              Accreditation reports need <strong>Applicant Analytics</strong> or <strong>DRD Member Analytics</strong> access. Contact your administrator.
            </p>
            <button type="button" onClick={() => router.push('/dashboard')} className={ui.btnPrimary}>Back to Dashboard</button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const chips = [
    { label: 'Teachers', value: data ? nf(data.naac.teachers.active) : '—' },
    { label: 'Journal papers', value: data ? nf(data.naac.papers.count) : '—' },
    { label: 'Grants awarded', value: data ? nf(data.naac.grants.count) : '—' },
    { label: 'Patents filed', value: data ? nf(data.nirf.patents.filed) : '—' },
  ];

  return (
    <ProtectedRoute>
      <AnalyticsShell>
        <AnalyticsHero
          title="NAAC & NIRF Reports"
          description={`Accreditation-ready workbooks built from approved research records${data ? ` for ${data.university.name}` : ''}: NAAC Criterion III data templates and NIRF Research & Professional Practice data, with data-quality notes.`}
          eyebrow="Accreditation exports"
          icon={<Award className="h-3.5 w-3.5" />}
          onBack={() => router.push('/drd/analytics/overview')}
          backLabel="Back to analytics overview"
          actions={(
            <button type="button" onClick={reload} disabled={loading} className={ui.btnSecondary}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
          )}
          chips={chips}
        />

        <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8">
          <AnalyticsPanel title="Reporting period" subtitle="NAAC looks back five years; NIRF asks for the last three financial years." icon={<CalendarRange />}>
            <div className="grid gap-6 lg:grid-cols-2">
              <fieldset className="space-y-3">
                <legend className={`${ui.label} mb-2`}>NAAC — years</legend>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-gray-300">
                    From
                    <select className={ui.input} value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))} aria-invalid={!!naacError}>
                      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-gray-300">
                    To
                    <select className={ui.input} value={toYear} onChange={(e) => setToYear(Number(e.target.value))} aria-invalid={!!naacError}>
                      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1 text-xs text-stone-600 dark:text-gray-300">
                    <span>Papers &amp; books by</span>
                    <Segmented
                      label="Count papers and books by"
                      value={paperYearBasis}
                      onChange={setPaperYearBasis}
                      options={[{ value: 'calendar', label: 'Calendar year' }, { value: 'academic', label: 'Academic year' }]}
                    />
                  </div>
                </div>
                <p className="text-xs text-stone-500 dark:text-gray-400">
                  NAAC 3.3.1/3.3.2 use calendar years (Jan–Dec). Grants (3.1) always use academic years, 1 April – 31 March.
                </p>
                {naacError && <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">{naacError}</p>}
              </fieldset>

              <fieldset>
                <legend className={`${ui.label} mb-2`}>NIRF — financial years</legend>
                <div className="flex flex-wrap gap-2">
                  {fyOptions.map((y) => {
                    const on = fyStarts.includes(y);
                    return (
                      <button
                        key={y}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleFy(y)}
                        className={`h-8 rounded-full border px-3 text-xs font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 ${
                          on
                            ? 'border-wine bg-wine text-wine-fg dark:border-amber dark:bg-amber/20 dark:text-amber'
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {fyLabel(y)}{y === currentFy ? ' (current)' : ''}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-stone-500 dark:text-gray-400">Financial year = 1 April – 31 March. NIRF normally asks for the three most recent completed years.</p>
                {nirfError && <p role="alert" className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">{nirfError}</p>}
              </fieldset>
            </div>
          </AnalyticsPanel>

          {error && !loading && (
            <div role="alert" className={`flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center ${ui.card}`}>
              <AlertCircle className="h-6 w-6 shrink-0 text-amber-500" aria-hidden />
              <div className="flex-1">
                <p className="text-sm font-semibold text-stone-900 dark:text-white">Couldn&apos;t load the preview</p>
                <p className="text-sm text-stone-500 dark:text-gray-400">{error}</p>
              </div>
              <button type="button" onClick={reload} className={ui.btnPrimary}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Try again
              </button>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <ReportCard
              title="NAAC Criterion III"
              subtitle={`Research, Innovations and Extension · ${fromYear}–${toYear}`}
              icon={<Landmark />}
              sheets={NAAC_SHEETS}
              loading={loading && !data}
              refreshing={loading && !!data}
              stats={data ? naacStats(data) : null}
              completeness={data ? naacCompleteness(data) : null}
              notes={data ? naacNotes(data) : undefined}
              download={(
                <DownloadButton
                  label="Download NAAC workbook"
                  filename={naacFile}
                  disabled={!!naacError}
                  disabledReason={naacError ?? undefined}
                  download={(onProgress, signal) => reportsService.downloadNaac({ fromYear, toYear, paperYearBasis }, onProgress, signal)}
                />
              )}
            />
            <ReportCard
              title="NIRF Research & Professional Practice"
              subtitle={`Financial years ${sortedFys.length ? sortedFys.map(fyLabel).join(', ') : '—'}`}
              icon={<GraduationCap />}
              sheets={NIRF_SHEETS}
              loading={loading && !data}
              refreshing={loading && !!data}
              stats={data ? nirfStats(data) : null}
              completeness={data ? nirfCompleteness(data) : null}
              notes={data ? nirfNotes(data) : undefined}
              download={(
                <DownloadButton
                  label="Download NIRF workbook"
                  filename={nirfFile}
                  disabled={!!nirfError}
                  disabledReason={nirfError ?? undefined}
                  download={(onProgress, signal) => reportsService.downloadNirf(sortedFys.map(fyLabel), onProgress, signal)}
                />
              )}
            />
          </div>

          <p className="text-xs text-stone-500 dark:text-gray-400">
            Only approved and completed records are counted. Workbooks are a starting point for the SSR / DCS submission — verify figures against source documents before uploading.
          </p>
        </main>
      </AnalyticsShell>
    </ProtectedRoute>
  );
}
