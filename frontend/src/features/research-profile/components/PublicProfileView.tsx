'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Building2, ExternalLink, GraduationCap, Mail, Phone, Quote, Search, Users } from 'lucide-react';
import type { AuthorProfileView } from '@/features/research-profile/services/researchProfile.service';

const TYPE_LABEL: Record<string, string> = {
  research_paper: 'Journal article',
  conference_paper: 'Conference paper',
  book: 'Book',
  book_chapter: 'Book chapter',
  grant_proposal: 'Grant proposal',
};

function initials(name: string) {
  return name.replace(/^(dr|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

/** Read-only author profile for visitors who are not signed in. */
export default function PublicProfileView({ profile }: { profile: AuthorProfileView }) {
  const { user, sections } = profile;
  const metrics = profile.profile.metrics;
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const publications = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...profile.publications].sort((a, b) => (b.year || 0) - (a.year || 0));
    return q ? list.filter((p) => p.title.toLowerCase().includes(q) || (p.venue || '').toLowerCase().includes(q)) : list;
  }, [profile.publications, query]);
  const visiblePubs = showAll ? publications : publications.slice(0, 10);

  const stats = [
    sections.publications && { label: 'Publications', value: profile.publications.length },
    sections.metrics && { label: 'Citations', value: metrics.totalCitations },
    sections.metrics && { label: 'h-index', value: metrics.hIndex },
    sections.coAuthors && { label: 'Co-authors', value: profile.coAuthors.length },
  ].filter(Boolean) as { label: string; value: number }[];

  return (
    <article className="space-y-6">
      {/* Header */}
      <header className="overflow-hidden rounded-2xl border border-blush-line bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="h-20 bg-brand-banner" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-wine-dark font-serif text-2xl font-bold text-wine-fg shadow dark:border-gray-900">
            {user.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by the API, not optimisable
              <img src={user.photo} alt={`Photo of ${user.name}`} className="h-full w-full object-cover" />
            ) : (
              initials(user.name)
            )}
          </div>
          <h1 className="mt-3 font-serif text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{user.name}</h1>
          {user.designation && <p className="mt-1 font-semibold text-wine dark:text-wine-200">{user.designation}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
            {user.department && <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4 text-gold" />{user.department}</span>}
            {user.school && <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-gold" />{user.school}</span>}
            {user.university && <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-gold" />{user.university}</span>}
          </div>
          {(user.email || user.phone || profile.profile.orcid) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {user.email && (
                <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-blush-line px-3 py-1.5 text-sm text-gray-700 hover:bg-blush-light dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  <Mail className="h-4 w-4" />{user.email}
                </a>
              )}
              {user.phone && (
                <a href={`tel:${user.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-blush-line px-3 py-1.5 text-sm text-gray-700 hover:bg-blush-light dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  <Phone className="h-4 w-4" />{user.phone}
                </a>
              )}
              {profile.profile.orcid && (
                <a href={`https://orcid.org/${profile.profile.orcid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-blush-line px-3 py-1.5 text-sm text-gray-700 hover:bg-blush-light dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  ORCID {profile.profile.orcid}<ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
        {stats.length > 0 && (
          <dl className="grid grid-cols-2 border-t border-blush-line dark:border-gray-800 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className={`px-6 py-4 ${i > 0 ? 'sm:border-l' : ''} ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'max-sm:border-t' : ''} border-blush-line dark:border-gray-800`}>
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-wine dark:text-white">{s.value.toLocaleString('en-IN')}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {/* About + interests */}
      {(profile.profile.bio || (sections.researchInterests && profile.profile.researchInterests.length > 0)) && (
        <section className="rounded-2xl border border-blush-line bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          {profile.profile.bio && (
            <>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">{profile.profile.bio}</p>
            </>
          )}
          {sections.researchInterests && profile.profile.researchInterests.length > 0 && (
            <div className={profile.profile.bio ? 'mt-5' : ''}>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Research interests</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.profile.researchInterests.map((interest) => (
                  <li key={interest} className="rounded-full border border-blush-line bg-blush-light px-3 py-1 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                    {interest}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Publications */}
      {sections.publications && (
        <section className="rounded-2xl border border-blush-line bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 border-b border-blush-line p-6 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
              <BookOpen className="h-5 w-5 text-gold" />
              Publications <span className="text-sm font-normal text-gray-500">({profile.publications.length})</span>
            </h2>
            {profile.publications.length > 5 && (
              <label className="relative">
                <span className="sr-only">Search publications</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search publications"
                  className="h-9 w-full rounded-lg border border-blush-line bg-white pl-9 pr-3 text-sm outline-none focus:border-wine dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 sm:w-64"
                />
              </label>
            )}
          </div>
          {publications.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{query ? 'No publications match your search.' : 'No publications listed yet.'}</p>
          ) : (
            <ol className="divide-y divide-blush-line dark:divide-gray-800">
              {visiblePubs.map((pub) => (
                <li key={pub.id} className="p-6">
                  <h3 className="font-semibold leading-snug text-gray-900 dark:text-white">
                    {pub.publicationUrl ? (
                      <a href={pub.publicationUrl} target="_blank" rel="noopener noreferrer" className="hover:text-wine hover:underline dark:hover:text-wine-200">{pub.title}</a>
                    ) : pub.title}
                  </h3>
                  {pub.authors.length > 0 && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{pub.authors.map((a) => a.name).join(', ')}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="rounded bg-blush-light px-1.5 py-0.5 font-medium text-wine dark:bg-gray-800 dark:text-wine-200">{TYPE_LABEL[pub.publicationType] || pub.publicationType}</span>
                    {pub.venue && <span className="italic">{pub.venue}</span>}
                    {pub.year && <span>{pub.year}</span>}
                    {sections.metrics && pub.citationCount > 0 && (
                      <span className="inline-flex items-center gap-1"><Quote className="h-3 w-3" />{pub.citationCount} citations</span>
                    )}
                    {pub.doi && <span>DOI: {pub.doi}</span>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {publications.length > 10 && (
            <div className="border-t border-blush-line p-4 text-center dark:border-gray-800">
              <button onClick={() => setShowAll((v) => !v)} className="text-sm font-semibold text-wine hover:underline dark:text-wine-200">
                {showAll ? 'Show fewer' : `Show all ${publications.length} publications`}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Co-authors */}
      {sections.coAuthors && profile.coAuthors.length > 0 && (
        <section className="rounded-2xl border border-blush-line bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <Users className="h-5 w-5 text-gold" />
            Frequent co-authors
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {profile.coAuthors.slice(0, 12).map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-blush-line p-3 dark:border-gray-800">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-50 text-xs font-bold text-wine">{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                  {c.affiliation && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{c.affiliation}</span>}
                </span>
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400" title="Shared publications">{c.collaborationCount}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
