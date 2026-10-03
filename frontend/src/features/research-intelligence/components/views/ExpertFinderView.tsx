'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, ExternalLink, GraduationCap, Network, Search, X } from 'lucide-react';
import { AnalyticsPanel } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { useDomainMap, useExperts } from '../../hooks/useKnowledgeGraph';
import { errorMessage } from '../../utils/graphUtils';
import { ListSkeleton, RipEmpty, RipError, RipGate, RipPageHeader } from '../shared/RipStates';
import type { Expert } from '../../graph.types';

/** useSearchParams can be null outside the app router (tests). */
const EMPTY_PARAMS = new URLSearchParams();
const LIMITS = [10, 20, 30];

function Chips({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-stone-500 dark:text-gray-400">{label}:</span>
      {items.map((x) => (
        <span key={x} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 dark:bg-gray-700 dark:text-gray-200">
          {x}
        </span>
      ))}
    </div>
  );
}

function ExpertCard({ e, rank, topic }: { e: Expert; rank: number; topic: string | null }) {
  const pubsHref = `/research/intelligence/search?authorId=${e.id}&author=${encodeURIComponent(e.name)}${topic ? `&q=${encodeURIComponent(topic)}` : ''}`;
  return (
    <li className="rounded-xl border border-stone-200 p-4 dark:border-gray-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine/10 text-sm font-semibold tabular-nums text-wine dark:bg-wine/30 dark:text-amber" aria-label={`Rank ${rank}`}>
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
              <Link href={`/research/profile/${e.id}`} className="hover:text-wine hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:text-amber">
                {e.name}
              </Link>
            </h3>
            {e.topic && <span className="text-xs text-stone-500 dark:text-gray-400">{e.topic}</span>}
          </div>
          <p className="text-xs text-stone-500 dark:text-gray-400">{[e.designation, e.department, e.school].filter(Boolean).join(' · ') || '—'}</p>

          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-[11px] text-stone-500 dark:text-gray-400">Expertise score</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="h-1.5 flex-1 rounded-full bg-stone-100 dark:bg-gray-700" aria-hidden>
                  <span className="block h-1.5 rounded-full bg-wine dark:bg-amber" style={{ width: `${Math.min(100, e.expertiseScore)}%` }} />
                </span>
                <span className="text-sm font-semibold tabular-nums text-stone-900 dark:text-white">{e.expertiseScore || '—'}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-stone-500 dark:text-gray-400">Matching papers</dt>
              <dd className="text-sm font-semibold tabular-nums text-stone-900 dark:text-white">{e.matchingPublications}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-stone-500 dark:text-gray-400">Citations</dt>
              <dd className="text-sm font-semibold tabular-nums text-stone-900 dark:text-white">{e.citations.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-stone-500 dark:text-gray-400">Last active</dt>
              <dd className="text-sm font-semibold tabular-nums text-stone-900 dark:text-white">{e.lastActiveYear || '—'}</dd>
            </div>
          </dl>

          {e.samplePapers.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-medium text-stone-500 dark:text-gray-400">Evidence — top matching papers</p>
              <ul className="mt-1 space-y-0.5">
                {e.samplePapers.map((t) => (
                  <li key={t} className="flex gap-1.5 text-xs text-stone-700 dark:text-gray-300">
                    <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-stone-400" aria-hidden />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/research/profile/${e.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-wine px-3 text-xs font-medium text-wine-fg hover:bg-wine-dark">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Profile
            </Link>
            <Link href={`/research/intelligence/network?userId=${e.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
              <Network className="h-3.5 w-3.5" aria-hidden /> Network
            </Link>
            <Link href={pubsHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
              <Search className="h-3.5 w-3.5" aria-hidden /> Publications
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function ExpertFinderInner() {
  const router = useRouter();
  const pathname = usePathname() || '/research/intelligence';
  const params = useSearchParams() ?? EMPTY_PARAMS;
  const topic = params.get('topic') || '';
  const categoryId = params.get('categoryId') || '';
  const categoryLabel = params.get('label') || '';
  const [text, setText] = useState(topic);
  const [limit, setLimit] = useState(10);

  const experts = useExperts({ topic: topic || undefined, categoryId: categoryId || undefined, limit });
  const domains = useDomainMap();
  const suggestions = useMemo(
    () =>
      (domains.data || [])
        .flatMap((d) => d.categories)
        .sort((a, b) => b.publicationCount - a.publicationCount)
        .slice(0, 8),
    [domains.data]
  );

  const go = (next: Record<string, string>) => {
    const qs = new URLSearchParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const hasQuery = !!(topic || categoryId);
  const data = experts.data;

  return (
    <div className="space-y-5">
      <RipPageHeader
        title="Expert Finder"
        description="Find the researchers with the strongest evidence on a topic: taxonomy expertise scores blended with matching papers, citations and recent activity."
        icon={<GraduationCap />}
      />

      <form
        role="search"
        className={`${ui.card} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (t) go({ topic: t });
        }}
      >
        <label className="block flex-1">
          <span className={`${ui.label} mb-1 block`}>Topic</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. machine learning, drug delivery, dental implants" className={`${ui.input} w-full`} />
        </label>
        <label className="block sm:w-32">
          <span className={`${ui.label} mb-1 block`}>Show</span>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={`${ui.input} w-full`}>
            {LIMITS.map((n) => (
              <option key={n} value={n}>Top {n}</option>
            ))}
          </select>
        </label>
        <button type="submit" className={ui.btnPrimary} disabled={!text.trim()}>
          <Search className="h-4 w-4" aria-hidden /> Find experts
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500 dark:text-gray-400">Strongest areas:</span>
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setText('');
                go({ categoryId: c.id, label: c.name });
              }}
              aria-pressed={categoryId === c.id}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 ${categoryId === c.id ? 'border-wine bg-wine text-white' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <AnalyticsPanel
        title={hasQuery ? `Experts${topic ? ` in “${topic}”` : categoryLabel ? ` in ${categoryLabel}` : ''}` : 'Experts'}
        subtitle={data ? `${data.experts.length} ranked researcher${data.experts.length === 1 ? '' : 's'}` : undefined}
        icon={<GraduationCap />}
        actions={
          hasQuery ? (
            <button type="button" onClick={() => { setText(''); go({}); }} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:text-gray-400 dark:hover:text-white">
              <X className="h-3.5 w-3.5" aria-hidden /> Clear
            </button>
          ) : undefined
        }
      >
        {!hasQuery ? (
          <RipEmpty title="Search a topic to find experts" message="Type a research topic, or pick one of the university's strongest areas above." icon={<GraduationCap />} />
        ) : experts.isLoading ? (
          <ListSkeleton rows={4} />
        ) : experts.isError ? (
          <RipError message={errorMessage(experts.error)} onRetry={() => experts.refetch()} />
        ) : !data || data.experts.length === 0 ? (
          <RipEmpty title="No experts found" message="No researcher has papers or taxonomy expertise matching this topic. Try a broader or differently worded topic." />
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5 rounded-lg bg-stone-50 px-3 py-2.5 dark:bg-gray-900/40">
              <Chips label="Matched categories" items={data.matchedCategories} />
              <Chips label="Matched taxonomy" items={data.matchedTaxonomy.filter((x) => !data.matchedCategories.includes(x))} />
              <Chips label="Also searched" items={[...(data.expandedWith?.aliases || []), ...(data.expandedWith?.keywords || [])]} />
              {!data.matchedCategories.length && !data.matchedTaxonomy.length && !data.expandedWith?.keywords.length && (
                <p className="text-xs text-stone-500 dark:text-gray-400">Ranked on full-text matches in publication titles and abstracts.</p>
              )}
            </div>
            <ol className="space-y-3">
              {data.experts.map((e, i) => (
                <ExpertCard key={e.id} e={e} rank={i + 1} topic={topic || null} />
              ))}
            </ol>
          </div>
        )}
      </AnalyticsPanel>
    </div>
  );
}

export function ExpertFinderView() {
  return (
    <RipGate anyOf={['rip_view_knowledge_graph']} feature="the expert finder" capability="Knowledge graph & experts">
      <ExpertFinderInner />
    </RipGate>
  );
}
