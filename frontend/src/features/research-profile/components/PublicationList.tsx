import React, { useState } from 'react';
import { Quote, ExternalLink, FileText, Calendar, Users } from 'lucide-react';
import type { Publication } from '@/shared/types/research-profile.types';

interface PublicationListProps {
  publications: Publication[];
}

export default function PublicationList({ publications }: PublicationListProps) {
  const [sortBy, setSortBy] = useState<'year' | 'citations'>('year');
  const [filterYear, setFilterYear] = useState<string>('all');

  // Get unique years for filter
  const years = Array.from(new Set(publications.map(p => p.year))).sort((a, b) => b - a);

  // Filter and sort publications
  const filteredPublications = publications
    .filter(pub => filterYear === 'all' || pub.year === parseInt(filterYear))
    .sort((a, b) => {
      if (sortBy === 'year') {
        return b.year - a.year;
      }
      return b.citationCount - a.citationCount;
    });

  if (publications.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No publications yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Publications will appear here once added to the profile.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters and Sorting - Google Scholar Style */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3 text-[13px]">
        <div className="flex items-center gap-2">
          <label className="text-gray-700 dark:text-gray-300">
            Sort by:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'year' | 'citations')}
            className="text-[13px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="year">Year</option>
            <option value="citations">Cited by</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-gray-700 dark:text-gray-300">
            Year:
          </label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="text-[13px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-gray-600 dark:text-gray-400">
          {filteredPublications.length} {filteredPublications.length === 1 ? 'result' : 'results'}
        </div>
      </div>

      {/* Publications List - Google Scholar Style */}
      <div className="divide-y divide-gray-200 dark:border-gray-700">
        {filteredPublications.map((publication) => (
          <PublicationItem key={publication.id} publication={publication} />
        ))}
      </div>
    </div>
  );
}

function PublicationItem({ publication }: { publication: Publication }) {
  const authorNames = publication.authors.map(a => a.name).join(', ');
  const firstThreeAuthors = publication.authors.slice(0, 3).map(a => a.name).join(', ');
  const hasMoreAuthors = publication.authors.length > 3;

  return (
    <div className="px-0 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Title - Google Scholar Style */}
      <h4 className="text-[18px] font-normal text-blue-600 dark:text-blue-400 mb-1 leading-snug">
        {publication.publicationUrl ? (
          <a
            href={publication.publicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {publication.title}
          </a>
        ) : (
          publication.title
        )}
      </h4>

      {/* Authors - Google Scholar Style with Hoverable Affiliations */}
      <div className="text-[13px] text-gray-700 dark:text-gray-300 mb-1 flex flex-wrap gap-x-1 items-center">
        {publication.authors.slice(0, 3).map((author, index) => {
          const isLastInSlice = index === Math.min(publication.authors.length, 3) - 1;
          const showComma = !isLastInSlice || publication.authors.length > 3;
          return (
            <span
              key={index}
              className="hover:text-blue-600 dark:hover:text-blue-400 cursor-help transition-colors"
              title={author.affiliation || 'No affiliation data'}
            >
              {author.name}{showComma && ','}
            </span>
          );
        })}
        {publication.authors.length > 3 && (
          <span
            className="cursor-help text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 font-semibold"
            title={publication.authors.slice(3).map(a => `${a.name} (${a.affiliation || 'No affiliation'})`).join('\n')}
          >
            ...
          </span>
        )}
      </div>

      {/* Venue and Year - Google Scholar Style */}
      <div className="text-[13px] text-gray-600 dark:text-gray-400 mb-2">
        <span className="italic">{publication.venue}</span>, {publication.year}
        {publication.volume && ` ${publication.volume}`}
        {publication.issue && ` (${publication.issue})`}
        {publication.pages && `, ${publication.pages}`}
      </div>

      {/* Citation Count and Links - Google Scholar Style */}
      <div className="flex flex-wrap items-center gap-4 text-[13px]">
        <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
          Cited by {publication.citationCount}
        </a>
        
        {publication.doi && (
          <a
            href={`https://doi.org/${publication.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            DOI
          </a>
        )}

        {publication.pdfUrl && (
          <a
            href={publication.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            PDF
          </a>
        )}

        <span className="text-gray-400 dark:text-gray-500">•</span>
        
        <button className="text-blue-600 dark:text-blue-400 hover:underline">
          Related articles
        </button>
        
        <button className="text-blue-600 dark:text-blue-400 hover:underline">
          All {publication.authors.length} versions
        </button>

        {publication.isVerified && (
          <span className="text-green-600 dark:text-green-400 text-[12px] ml-2">
            ✓ Verified
          </span>
        )}
      </div>

      {/* Abstract preview if available */}
      {publication.abstract && (
        <div className="mt-2 text-[13px] text-gray-600 dark:text-gray-400 line-clamp-2">
          {publication.abstract}
        </div>
      )}
    </div>
  );
}
