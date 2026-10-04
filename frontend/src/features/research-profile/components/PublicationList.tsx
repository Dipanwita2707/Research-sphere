import React, { useId, useMemo, useState } from 'react';
import { BadgeCheck, FileText, Quote } from 'lucide-react';
import type { Publication } from '@/shared/types/research-profile.types';

interface PublicationListProps {
  publications: Publication[];
}

const TYPE_LABEL: Record<string, string> = {
  research_paper: 'Journal article',
  conference_paper: 'Conference paper',
  book: 'Book',
  book_chapter: 'Book chapter',
  grant_proposal: 'Grant proposal',
};

/** "A, B, C, et al." — the first three authors, like a citation. */
function authorLine(publication: Publication) {
  const names = publication.authors.map((a) => a.name).filter(Boolean);
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')}, et al.`;
}

export default function PublicationList({ publications }: PublicationListProps) {
  const [sortBy, setSortBy] = useState<'year' | 'citations'>('year');
  const [filterYear, setFilterYear] = useState<string>('all');
  const sortId = useId();
  const yearId = useId();

  const years = useMemo(
    () => Array.from(new Set(publications.map((p) => p.year).filter(Boolean))).sort((a, b) => b - a),
    [publications],
  );

  const visible = useMemo(
    () =>
      publications
        .filter((pub) => filterYear === 'all' || pub.year === parseInt(filterYear, 10))
        .sort((a, b) => (sortBy === 'year' ? b.year - a.year : b.citationCount - a.citationCount)),
    [publications, filterYear, sortBy],
  );

  if (publications.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No publications yet</h3>
        <p className="text-gray-600 dark:text-gray-400">Publications will appear here once added to the profile.</p>
      </div>
    );
  }

  const selectCls =
    'text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-wine/20 focus:border-wine';

  return (
    <div className="rounded-xl border border-blush-line bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-4 border-b border-blush-line px-4 py-3 text-sm dark:border-gray-700">
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-gray-700 dark:text-gray-300">Sort by:</label>
          <select id={sortId} value={sortBy} onChange={(e) => setSortBy(e.target.value as 'year' | 'citations')} className={selectCls}>
            <option value="year">Year (newest first)</option>
            <option value="citations">Most cited</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={yearId} className="text-gray-700 dark:text-gray-300">Year:</label>
          <select id={yearId} value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className={selectCls}>
            <option value="all">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-gray-600 dark:text-gray-400" aria-live="polite">
          {visible.length} {visible.length === 1 ? 'publication' : 'publications'}
        </div>
      </div>

      <ol className="divide-y divide-blush-line dark:divide-gray-700">
        {visible.map((publication) => (
          <PublicationItem key={publication.id} publication={publication} />
        ))}
      </ol>
    </div>
  );
}

const PAYOUT_LABEL: Record<string, string> = {
  pending_verification: 'awaiting finance verification',
  recommended: 'recommended for payment',
  on_hold: 'on hold',
  approved: 'approved for payment',
  paid: 'paid',
};
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** The author's incentive for one work (author and admins only: the server never sends it to anyone else). */
function IncentiveChip({ incentive }: { incentive: NonNullable<Publication['incentive']> }) {
  if (!(incentive.amount > 0) && !(incentive.points > 0)) {
    return <span className="text-xs text-gray-500 dark:text-gray-400">No incentive recorded</span>;
  }
  const paid = incentive.status === 'paid';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${paid ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'}`}
      title={incentive.status ? `Payout: ${PAYOUT_LABEL[incentive.status] || incentive.status}` : 'Recorded when DRD approved this work'}
    >
      {incentive.amount > 0 && <span className="font-semibold tabular-nums">{inr.format(incentive.amount)}</span>}
      {incentive.points > 0 && <span className="tabular-nums">{incentive.points} pts</span>}
      <span>· {incentive.status ? PAYOUT_LABEL[incentive.status] || incentive.status : 'awarded'}</span>
    </span>
  );
}

function PublicationItem({ publication }: { publication: Publication }) {
  const hiddenAuthors = publication.authors.slice(3);
  const details = [
    publication.volume && `Vol. ${publication.volume}`,
    publication.issue && `Issue ${publication.issue}`,
    publication.pages && `pp. ${publication.pages}`,
  ].filter(Boolean) as string[];

  return (
    <li className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded bg-blush-light px-1.5 py-0.5 text-xs font-medium text-wine dark:bg-gray-700 dark:text-wine-200">
          {TYPE_LABEL[publication.publicationType] || publication.publicationType}
        </span>
        {!publication.isVerified && publication.source === 'synced' && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" title="Imported from the researcher's publication record. Not yet verified by DRD.">
            Synced{publication.sourceSystems?.length ? ' from ' + publication.sourceSystems.map((x) => (x === 'orcid' ? 'ORCID' : x === 'openalex' ? 'OpenAlex' : x === 'scopus' ? 'Scopus' : x)).join(', ') : ''} · not yet DRD-verified
          </span>
        )}
        {publication.isVerified && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            <span>Verified</span>
          </span>
        )}
      </div>

      <h4 className="text-base font-medium leading-snug text-gray-900 dark:text-white">
        {publication.publicationUrl ? (
          <a href={publication.publicationUrl} target="_blank" rel="noopener noreferrer" className="hover:text-wine hover:underline dark:hover:text-wine-200">
            {publication.title}
          </a>
        ) : (
          publication.title
        )}
      </h4>

      {publication.authors.length > 0 && (
        <p
          className="mt-1 text-sm text-gray-700 dark:text-gray-300"
          title={hiddenAuthors.length ? publication.authors.map((a) => a.name).join(', ') : undefined}
        >
          {authorLine(publication)}
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-gray-600 dark:text-gray-400">
        {publication.venue && <span className="italic">{publication.venue}</span>}
        {publication.year ? <span>{publication.year}</span> : null}
        {details.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {publication.incentive && (publication.isVerified || publication.incentive.amount > 0) && <IncentiveChip incentive={publication.incentive} />}
        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <Quote className="h-3.5 w-3.5 text-gold" aria-hidden />
          <span className="font-semibold text-gray-900 dark:text-white">{publication.citationCount}</span>
          <span>{publication.citationCount === 1 ? 'citation' : 'citations'}</span>
        </span>
        {publication.doi && (
          <a href={`https://doi.org/${publication.doi}`} target="_blank" rel="noopener noreferrer" className="text-wine hover:underline dark:text-wine-200">
            DOI: {publication.doi}
          </a>
        )}
        {publication.pdfUrl && (
          <a href={publication.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-wine hover:underline dark:text-wine-200">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            PDF
          </a>
        )}
      </div>

      {publication.keywords.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Keywords">
          {publication.keywords.map((k) => (
            <li key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">{k}</li>
          ))}
        </ul>
      )}

      {publication.abstract && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{publication.abstract}</p>
      )}
    </li>
  );
}
