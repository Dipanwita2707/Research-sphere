'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Building2, ChevronLeft, ChevronRight, ExternalLink, FileSearch, GraduationCap, Hash, Network, Search, Tags, User, X } from 'lucide-react';
import { AnalyticsPanel } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { useRipAccess } from '../../hooks/useRipAccess';
import { useEntitySearch, usePublicationSearch, useUnits } from '../../hooks/useKnowledgeGraph';
import { errorMessage, indexUnits, pageWindow, RIP_USE_CAPABILITIES } from '../../utils/graphUtils';
import { ListSkeleton, RipEmpty, RipError, RipGate, RipPageHeader } from '../shared/RipStates';
import type { PublicationHit, PublicationSort } from '../../graph.types';

/** useSearchParams can be null outside the app router (tests). */
const EMPTY_PARAMS = new URLSearchParams();
const TYPES = [
  { value: '', label: 'All types' },
  { value: 'research_paper', label: 'Research paper' },
  { value: 'conference_paper', label: 'Conference paper' },
  { value: 'book', label: 'Book' },
  { value: 'book_chapter', label: 'Book chapter' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES.filter((t) => t.value).map((t) => [t.value, t.label]));
const VIA_LABEL: Record<string, string> = { text: 'Text', keyword: 'Keyword', alias: 'Alias', taxonomy: 'Taxonomy', related: 'Related topic', graph: 'Related topic' };
const PAGE_SIZES = [20, 50, 100];

/** Filters carried in the URL from other views (author, category, domain) shown as removable chips. */
const SCOPE_KEYS: { id: string; label: string; name: string }[] = [
  { id: 'authorId', label: 'author', name: 'Author' },
  { id: 'categoryId', label: 'category', name: 'Category' },
  { id: 'domainId', label: 'category', name: 'Domain' },
];

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 disabled:opacity-40';
  return (
    <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-center gap-1 border-t border-stone-100 pt-4 dark:border-gray-700">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={`${btn} text-stone-600 hover:bg-stone-100 dark:text-gray-300 dark:hover:bg-gray-700`} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      {pageWindow(page, pages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-stone-400" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            className={`${btn} ${p === page ? 'bg-wine font-semibold text-white' : 'text-stone-700 hover:bg-stone-100 dark:text-gray-200 dark:hover:bg-gray-700'}`}
          >
            {p}
          </button>
        )
      )}
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className={`${btn} text-stone-600 hover:bg-stone-100 dark:text-gray-300 dark:hover:bg-gray-700`} aria-label="Next page">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}

function PublicationRow({ p }: { p: PublicationHit }) {
  const doiUrl = p.doi ? (p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`) : null;
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <h3 className="text-sm font-semibold leading-snug text-stone-900 dark:text-white">{p.title}</h3>
      <p className="mt-1 text-xs text-stone-600 dark:text-gray-300">{p.authors.join(', ') || 'Authors not recorded'}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-gray-400">
        {p.journal && <span className="italic">{p.journal}</span>}
        {p.year && <span className="tabular-nums">{p.year}</span>}
        {p.type && <span>{TYPE_LABEL[p.type] || p.type.replace(/_/g, ' ')}</span>}
        {p.quartile && <span className="rounded bg-wine/10 px-1.5 py-0.5 font-semibold text-wine dark:bg-wine/30 dark:text-amber">{p.quartile}</span>}
        <span className="tabular-nums">{p.citations} citations</span>
        {p.department && <span>{p.department}</span>}
        {doiUrl && (
          <a href={doiUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-wine hover:underline dark:text-amber">
            DOI <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
      {p.matchedVia.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {p.matchedVia.map((v) => (
            <span key={v} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10.5px] font-medium text-stone-600 dark:bg-gray-700 dark:text-gray-300">
              Matched by {VIA_LABEL[v] || v}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function EntityGroup({ title, icon, children, count }: { title: string; icon: React.ReactNode; children: React.ReactNode; count: number }) {
  if (!count) return null;
  return (
    <div>
      <p className={`${ui.label} flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5`}>
        {icon}
        {title}
      </p>
      <ul className="mt-1.5 space-y-0.5">{children}</ul>
    </div>
  );
}

const rowLink = 'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:bg-gray-700/50';
const iconLink = 'rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-wine focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:bg-gray-700 dark:hover:text-amber';

function ResearchSearchInner() {
  const router = useRouter();
  const pathname = usePathname() || '/research/intelligence';
  const params = useSearchParams() ?? EMPTY_PARAMS;
  const { can } = useRipAccess();
  const canGraph = can('rip_view_knowledge_graph');
  const canKw = can('rip_view_keyword_intelligence');

  const q = params.get('q') || '';
  const sort = (params.get('sort') as PublicationSort) || 'relevance';
  const type = params.get('type') || '';
  const yearFrom = params.get('yearFrom') || '';
  const yearTo = params.get('yearTo') || '';
  const scopes = SCOPE_KEYS.filter((s) => params.get(s.id)).map((s) => ({ ...s, value: params.get(s.id)!, text: params.get(s.label) || s.name }));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = PAGE_SIZES.includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : PAGE_SIZES[0];
  const unitsQuery = useUnits();
  const units = indexUnits(unitsQuery.data);
  const departmentId = params.get('departmentId') || '';
  const schoolId = params.get('schoolId') || units.schoolOfDepartment(departmentId) || '';
  const departments = units.departmentsOf(schoolId);

  const [text, setText] = useState(q);
  const [from, setFrom] = useState(yearFrom);
  const [to, setTo] = useState(yearTo);

  const search = usePublicationSearch({
    q: q || undefined,
    sort,
    type: type || undefined,
    yearFrom: yearFrom ? Number(yearFrom) : undefined,
    yearTo: yearTo ? Number(yearTo) : undefined,
    authorId: params.get('authorId') || undefined,
    categoryId: params.get('categoryId') || undefined,
    domainId: params.get('domainId') || undefined,
    // A department already pins the school.
    schoolId: departmentId ? undefined : schoolId || undefined,
    departmentId: departmentId || undefined,
    page,
    pageSize,
  });
  const entities = useEntitySearch(q);
  const e = entities.data;
  const entityCount = e ? e.researchers.length + e.keywords.length + e.categories.length + e.schools.length + e.departments.length : 0;

  /** Change URL filters; any change other than the page itself goes back to page 1. */
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    if (!('page' in patch)) next.delete('page');
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const data = search.data;
  const exp = data?.expansion;
  const expansionTerms = exp ? [...exp.aliases, ...exp.direct, ...exp.taxonomy.categories, ...exp.taxonomy.specializations, ...exp.related].filter((t, i, a) => a.indexOf(t) === i && t.toLowerCase() !== q.toLowerCase()) : [];
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-5">
      <RipPageHeader
        title="Research Search"
        description="Search publications by meaning, not just words: queries expand through keyword aliases, the taxonomy and related topics. People, schools and topics matching your query are listed alongside."
        icon={<FileSearch />}
      />

      <form
        role="search"
        className={`${ui.card} grid grid-cols-2 gap-3 p-4 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,0.7fr))_auto] md:items-end`}
        onSubmit={(ev) => {
          ev.preventDefault();
          update({ q: text.trim() || null, yearFrom: from || null, yearTo: to || null });
        }}
      >
        <label className="col-span-2 block md:col-span-1">
          <span className={`${ui.label} mb-1 block`}>Search</span>
          <input value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Topic, title words, keyword…" className={`${ui.input} w-full`} />
        </label>
        <label className="block">
          <span className={`${ui.label} mb-1 block`}>From year</span>
          <input type="number" inputMode="numeric" min={1950} max={currentYear} value={from} onChange={(ev) => setFrom(ev.target.value)} className={`${ui.input} w-full`} />
        </label>
        <label className="block">
          <span className={`${ui.label} mb-1 block`}>To year</span>
          <input type="number" inputMode="numeric" min={1950} max={currentYear} value={to} onChange={(ev) => setTo(ev.target.value)} className={`${ui.input} w-full`} />
        </label>
        <label className="block">
          <span className={`${ui.label} mb-1 block`}>Type</span>
          <select value={type} onChange={(ev) => update({ type: ev.target.value || null })} className={`${ui.input} w-full`}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={`${ui.label} mb-1 block`}>Sort</span>
          <select value={sort} onChange={(ev) => update({ sort: ev.target.value === 'relevance' ? null : ev.target.value })} className={`${ui.input} w-full`}>
            <option value="relevance">{q ? 'Relevance' : 'Newest'}</option>
            <option value="recent">Newest</option>
            <option value="citations">Most cited</option>
          </select>
        </label>
        <button type="submit" className={`${ui.btnPrimary} col-span-2 justify-center md:col-span-1`}>
          <Search className="h-4 w-4" aria-hidden /> Search
        </button>
        <div className="col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem] md:col-span-6">
          <label className="block">
            <span className={`${ui.label} mb-1 block`}>School</span>
            <select value={schoolId} onChange={(ev) => update({ schoolId: ev.target.value || null, departmentId: null })} className={`${ui.input} w-full`} disabled={unitsQuery.isLoading}>
              <option value="">{unitsQuery.isError ? 'Schools unavailable' : 'All schools'}</option>
              {unitsQuery.data?.schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={`${ui.label} mb-1 block`}>Department</span>
            <select
              value={departmentId}
              onChange={(ev) => update({ departmentId: ev.target.value || null, schoolId: ev.target.value ? units.schoolOfDepartment(ev.target.value) : schoolId || null })}
              className={`${ui.input} w-full`}
              disabled={unitsQuery.isLoading || departments.length === 0}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{schoolId ? d.name : `${d.name} (${d.school})`}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={`${ui.label} mb-1 block`}>Per page</span>
            <select value={pageSize} onChange={(ev) => update({ pageSize: ev.target.value === String(PAGE_SIZES[0]) ? null : ev.target.value })} className={`${ui.input} w-full`}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        {scopes.length > 0 && (
          <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-6">
            <span className="text-xs text-stone-500 dark:text-gray-400">Filtered to:</span>
            {scopes.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-wine/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-wine dark:bg-wine/30 dark:text-amber">
                {s.name}: {s.text}
                <button type="button" onClick={() => update({ [s.id]: null, [s.label]: null })} aria-label={`Remove ${s.name.toLowerCase()} filter`} className="rounded-full p-0.5 hover:bg-wine/15">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </form>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <AnalyticsPanel
          title="Publications"
          subtitle={
            data
              ? data.total === 0
                ? 'No matches'
                : `${((data.page - 1) * data.pageSize + 1).toLocaleString('en-IN')}–${((data.page - 1) * data.pageSize + data.results.length).toLocaleString('en-IN')} of ${data.total.toLocaleString('en-IN')} match${data.total === 1 ? '' : 'es'}`
              : undefined
          }
          icon={<BookOpen />}
        >
          {expansionTerms.length > 0 && (
            <p className="mb-4 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600 dark:bg-gray-900/40 dark:text-gray-300">
              Also searched: {expansionTerms.slice(0, 12).join(', ')}
            </p>
          )}
          {search.isLoading ? (
            <ListSkeleton rows={6} />
          ) : search.isError ? (
            <RipError message={errorMessage(search.error)} onRetry={() => search.refetch()} />
          ) : !data || data.results.length === 0 ? (
            data && data.total > 0 ? (
              <RipEmpty
                title="This page is empty"
                message={`There are ${data.pages} pages of results.`}
                action={
                  <button type="button" onClick={() => update({ page: null })} className={ui.btnSecondary}>
                    Go to page 1
                  </button>
                }
              />
            ) : (
              <RipEmpty title="No publications found" message={q ? 'Try a broader query, fewer filters, or a different year range.' : 'No publications match these filters.'} icon={<BookOpen />} />
            )
          ) : (
            <>
              <ol start={(data.page - 1) * data.pageSize + 1} className={`divide-y divide-stone-100 dark:divide-gray-700 ${search.isFetching ? 'opacity-60' : ''}`} aria-busy={search.isFetching}>
                {data.results.map((p) => (
                  <PublicationRow key={p.id} p={p} />
                ))}
              </ol>
              <Pager page={data.page} pages={data.pages} onPage={(n) => update({ page: n > 1 ? String(n) : null })} />
            </>
          )}
        </AnalyticsPanel>

        <AnalyticsPanel title="People & topics" subtitle={q ? `Matching “${q}”` : 'Search to see matching people and topics'} icon={<User />} className="xl:self-start">
          {q.trim().length < 2 ? (
            <RipEmpty title="Nothing to match yet" message="Researchers, keywords, categories, schools and departments matching your search appear here." icon={<User />} />
          ) : entities.isLoading ? (
            <ListSkeleton rows={4} />
          ) : entities.isError ? (
            <RipError message={errorMessage(entities.error)} onRetry={() => entities.refetch()} />
          ) : !e || entityCount === 0 ? (
            <RipEmpty title="No people or topics match" />
          ) : (
            <div className="space-y-4">
              <EntityGroup title="Researchers" icon={<User />} count={e.researchers.length}>
                {e.researchers.map((r) => (
                  <li key={r.id} className="flex items-center gap-1">
                    <Link href={`/research/profile/${r.id}`} className={`${rowLink} min-w-0 flex-1`}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-stone-800 dark:text-gray-100">{r.name}</span>
                        <span className="block truncate text-xs text-stone-500 dark:text-gray-400">{r.department || r.designation || ''}</span>
                      </span>
                    </Link>
                    <Link href={`/research/intelligence/search?authorId=${r.id}&author=${encodeURIComponent(r.name)}`} className={iconLink} title="Their publications" aria-label={`Publications by ${r.name}`}>
                      <BookOpen className="h-4 w-4" />
                    </Link>
                    {canGraph && (
                      <Link href={`/research/intelligence/network?userId=${r.id}`} className={iconLink} title="Collaboration network" aria-label={`Collaboration network of ${r.name}`}>
                        <Network className="h-4 w-4" />
                      </Link>
                    )}
                  </li>
                ))}
              </EntityGroup>
              <EntityGroup title="Keywords" icon={<Hash />} count={e.keywords.length}>
                {e.keywords.map((k) => (
                  <li key={k.id}>
                    <Link
                      href={canGraph || canKw ? `/research/intelligence/keywords?keywordId=${k.id}&name=${encodeURIComponent(k.canonicalName)}` : `/research/intelligence/search?q=${encodeURIComponent(k.canonicalName)}`}
                      className={rowLink}
                    >
                      <span className="truncate text-stone-800 dark:text-gray-100">{k.canonicalName}</span>
                      <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-gray-400">{k.publicationCount}</span>
                    </Link>
                  </li>
                ))}
              </EntityGroup>
              <EntityGroup title="Categories" icon={<Tags />} count={e.categories.length}>
                {e.categories.map((c) => (
                  <li key={c.id} className="flex items-center gap-1">
                    <Link href={`/research/intelligence/search?categoryId=${c.id}&category=${encodeURIComponent(c.name)}`} className={`${rowLink} min-w-0 flex-1`}>
                      <span className="min-w-0">
                        <span className="block truncate text-stone-800 dark:text-gray-100">{c.name}</span>
                        {c.domain && <span className="block truncate text-xs text-stone-500 dark:text-gray-400">{c.domain.name}</span>}
                      </span>
                    </Link>
                    {canGraph && (
                      <Link href={`/research/intelligence/experts?categoryId=${c.id}&label=${encodeURIComponent(c.name)}`} className={iconLink} title="Experts" aria-label={`Experts in ${c.name}`}>
                        <GraduationCap className="h-4 w-4" />
                      </Link>
                    )}
                  </li>
                ))}
              </EntityGroup>
              <EntityGroup title="Schools & departments" icon={<Building2 />} count={e.schools.length + e.departments.length}>
                {e.schools.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={canGraph ? `/research/intelligence/network?schoolId=${s.id}` : `/research/intelligence/search?schoolId=${s.id}`}
                      className={rowLink}
                    >
                      <span className="truncate text-stone-800 dark:text-gray-100">{s.name}</span>
                      {s.shortName && <span className="shrink-0 text-xs text-stone-500 dark:text-gray-400">{s.shortName}</span>}
                    </Link>
                  </li>
                ))}
                {e.departments.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={canGraph ? `/research/intelligence/network?departmentId=${d.id}` : `/research/intelligence/search?departmentId=${d.id}`}
                      className={rowLink}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-stone-800 dark:text-gray-100">{d.name}</span>
                        {d.school && <span className="block truncate text-xs text-stone-500 dark:text-gray-400">{d.school}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </EntityGroup>
            </div>
          )}
        </AnalyticsPanel>
      </div>
    </div>
  );
}

export function ResearchSearchView() {
  return (
    <RipGate anyOf={RIP_USE_CAPABILITIES} feature="Research Intelligence search" capability="AI Research Assistant (or any other Use)">
      <ResearchSearchInner />
    </RipGate>
  );
}
