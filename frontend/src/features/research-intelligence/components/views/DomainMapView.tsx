'use client';

import { useBranding } from '@/shared/providers/BrandingProvider';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { hierarchy, interpolateRgb, treemap } from 'd3';
import { ChevronRight, ExternalLink, GraduationCap, LayoutGrid, List, Map as MapIcon, Search, Users } from 'lucide-react';
import { AnalyticsPanel } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { useTheme } from '@/shared/providers/ThemeProvider';
import { useDomainMap } from '../../hooks/useKnowledgeGraph';
import { domainMapTotals, errorMessage, sharePct } from '../../utils/graphUtils';
import { GraphSkeleton, RipEmpty, RipError, RipGate, RipPageHeader } from '../shared/RipStates';
import type { DomainMapCategory, DomainMapDomain } from '../../graph.types';

interface Cell {
  id: string;
  name: string;
  value: number;
  researchers: number;
  subCount: number;
}

const fmt = (n: number) => n.toLocaleString('en-IN');

/** Single-hue sequential treemap (volume, not identity, is what the colour encodes). */
function Treemap({ cells, onPick, label, unit }: { cells: Cell[]; onPick: (id: string) => void; label: string; unit: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { theme } = useTheme();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const height = width && width < 640 ? 420 : 460;
  const dark = theme === 'dark';
  // Sequential ramp in the university's primary hue (light → deep)
  const { theme: brand } = useBranding();
  const ramp = dark
    ? interpolateRgb(brand.colors.dark.seqLo, brand.colors.dark.seqHi)
    : interpolateRgb(brand.colors.light.primary100, brand.colors.light.primary);

  const leaves = useMemo(() => {
    if (!width) return [];
    type Datum = Partial<Cell> & { children?: Datum[] };
    const root = hierarchy<Datum>({ children: cells })
      .sum((d) => Math.max(d.value || 0, 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    return treemap<Datum>().size([width, height]).paddingInner(3).round(true)(root).leaves();
  }, [cells, width, height]);
  const max = Math.max(1, ...cells.map((c) => c.value));

  return (
    <div ref={ref} className="relative w-full" style={{ height }} role="list" aria-label={label}>
      {leaves.map((l) => {
        const c = l.data as Cell;
        const w = l.x1 - l.x0;
        const h = l.y1 - l.y0;
        const t = 0.15 + 0.85 * Math.sqrt(c.value / max);
        const lightText = dark || t > 0.5;
        const roomy = w > 90 && h > 44;
        return (
          <div key={c.id} role="listitem" className="absolute" style={{ left: l.x0, top: l.y0, width: w, height: h }}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              title={`${c.name}: ${fmt(c.value)} publications, ${c.researchers} researchers`}
              aria-label={`${c.name}: ${fmt(c.value)} publications, ${c.researchers} researchers, ${c.subCount} ${unit}. Open.`}
              className={`flex h-full w-full flex-col items-start justify-between overflow-hidden rounded-md p-2 text-left transition-[filter] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${lightText ? 'text-white' : 'text-stone-900'}`}
              style={{ background: ramp(t) }}
            >
              {roomy ? (
                <>
                  <span className="line-clamp-2 text-xs font-semibold leading-snug sm:text-sm">{c.name}</span>
                  <span className={`text-[11px] tabular-nums ${lightText ? 'text-white/80' : 'text-stone-700'}`}>
                    {fmt(c.value)} pubs · {c.researchers} researchers
                  </span>
                </>
              ) : w > 40 && h > 22 ? (
                <span className="truncate text-[10px] font-semibold">{c.name}</span>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CategoryDetail({ c }: { c: DomainMapCategory }) {
  const maxSpec = Math.max(1, ...c.specializations.map((s) => s.publicationCount));
  return (
    <div className="space-y-5" aria-live="polite">
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
          <dt className="text-[11px] text-stone-500 dark:text-gray-400">Publications</dt>
          <dd className="text-lg font-semibold tabular-nums text-stone-900 dark:text-white">{fmt(c.publicationCount)}</dd>
        </div>
        <div className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
          <dt className="text-[11px] text-stone-500 dark:text-gray-400">Researchers</dt>
          <dd className="text-lg font-semibold tabular-nums text-stone-900 dark:text-white">{fmt(c.researcherCount)}</dd>
        </div>
      </dl>
      <div>
        <p className={ui.label}>Leading researchers</p>
        {c.leaders.length ? (
          <ol className="mt-2 space-y-1">
            {c.leaders.map((l, i) => (
              <li key={l.id}>
                <Link href={`/research/profile/${l.id}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:bg-gray-700/50">
                  <span className="w-4 text-xs tabular-nums text-stone-400">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-800 dark:text-gray-100">{l.name}</span>
                    <span className="block truncate text-xs text-stone-500 dark:text-gray-400">{l.department || l.school || '—'}</span>
                  </span>
                  <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400" title="Expertise score">{Math.round(l.score)}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-stone-500 dark:text-gray-400">No expertise scores yet.</p>
        )}
      </div>
      <div>
        <p className={ui.label}>Specializations</p>
        {c.specializations.length ? (
          <ul className="mt-2 space-y-2">
            {c.specializations.map((s) => (
              <li key={s.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-stone-800 dark:text-gray-100">{s.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-gray-400">{s.publicationCount}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-stone-100 dark:bg-gray-700" aria-hidden>
                  <div className="h-1 rounded-full" style={{ width: `${(s.publicationCount / maxSpec) * 100}%`, background: 'var(--viz-1)' }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-stone-500 dark:text-gray-400">No specializations with publications.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/research/intelligence/experts?categoryId=${c.id}&label=${encodeURIComponent(c.name)}`} className={ui.btnPrimary}>
          <GraduationCap className="h-4 w-4" aria-hidden /> Find experts
        </Link>
        <Link href={`/research/intelligence/search?categoryId=${c.id}&category=${encodeURIComponent(c.name)}`} className={ui.btnSecondary}>
          <Search className="h-4 w-4" aria-hidden /> Publications
        </Link>
      </div>
    </div>
  );
}

function DomainMapInner() {
  const query = useDomainMap();
  const [domainId, setDomainId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');
  const domains = useMemo(() => query.data || [], [query.data]);
  const totals = domainMapTotals(domains);
  const domain: DomainMapDomain | undefined = domains.find((d) => d.id === domainId);
  const category = domain?.categories.find((c) => c.id === categoryId);

  const cells: Cell[] = domain
    ? domain.categories.map((c) => ({ id: c.id, name: c.name, value: c.publicationCount, researchers: c.researcherCount, subCount: c.specializations.length }))
    : domains.filter((d) => d.publicationCount > 0).map((d) => ({ id: d.id, name: d.name, value: d.publicationCount, researchers: d.researcherCount, subCount: d.categories.length }));

  const pick = (id: string) => {
    if (domain) setCategoryId(id);
    else {
      setDomainId(id);
      setCategoryId(null);
    }
  };

  return (
    <div className="space-y-5">
      <RipPageHeader
        title="Domain Map"
        description="The university's research landscape: domains sized by publications, drilling into categories, specializations and the researchers leading each."
        icon={<MapIcon />}
        chips={[
          { label: 'Domains', value: fmt(totals.domains) },
          { label: 'Categories', value: fmt(totals.categories) },
          { label: 'Specializations', value: fmt(totals.specializations) },
          { label: 'Paper–domain links', value: fmt(totals.publications) },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AnalyticsPanel
          title={domain ? domain.name : 'Research domains'}
          subtitle={domain ? 'Categories in this domain — click one for details' : 'Click a domain to see its categories. Darker means more publications.'}
          icon={<LayoutGrid />}
          actions={
            <div className="flex h-8 overflow-hidden rounded-lg border border-stone-200 dark:border-gray-600" role="group" aria-label="Display">
              {(['map', 'list'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wine/40 ${view === v ? 'bg-wine text-white' : 'bg-white text-stone-600 hover:bg-stone-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                >
                  {v === 'map' ? <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> : <List className="h-3.5 w-3.5" aria-hidden />}
                  {v === 'map' ? 'Treemap' : 'List'}
                </button>
              ))}
            </div>
          }
        >
          <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm">
            <button type="button" onClick={() => { setDomainId(null); setCategoryId(null); }} className={`rounded px-1 ${domain ? 'text-wine hover:underline dark:text-amber' : 'font-semibold text-stone-800 dark:text-gray-100'}`} aria-current={domain ? undefined : 'page'}>
              All domains
            </button>
            {domain && (
              <>
                <ChevronRight className="h-4 w-4 text-stone-400" aria-hidden />
                <button type="button" onClick={() => setCategoryId(null)} className={`rounded px-1 ${category ? 'text-wine hover:underline dark:text-amber' : 'font-semibold text-stone-800 dark:text-gray-100'}`} aria-current={category ? undefined : 'page'}>
                  {domain.name}
                </button>
              </>
            )}
            {category && (
              <>
                <ChevronRight className="h-4 w-4 text-stone-400" aria-hidden />
                <span className="px-1 font-semibold text-stone-800 dark:text-gray-100" aria-current="page">{category.name}</span>
              </>
            )}
          </nav>

          {query.isLoading ? (
            <GraphSkeleton height={460} />
          ) : query.isError ? (
            <RipError message={errorMessage(query.error)} onRetry={() => query.refetch()} />
          ) : cells.length === 0 ? (
            <RipEmpty
              title={domain ? 'No classified publications in this domain' : 'No domains yet'}
              message={domain ? 'Categories appear here once publications are classified into them.' : 'Run the Research Intelligence index to classify publications into the taxonomy.'}
              icon={<MapIcon />}
            />
          ) : view === 'map' ? (
            <Treemap cells={cells} onPick={pick} label={domain ? `Categories in ${domain.name}` : 'Research domains'} unit={domain ? 'specializations' : 'categories'} />
          ) : (
            <div className="overflow-auto rounded-lg border border-stone-100 dark:border-gray-700">
              <table className="w-full min-w-[480px] text-sm">
                <caption className="sr-only">{domain ? `Categories in ${domain.name}` : 'Research domains'}</caption>
                <thead className="bg-stone-50 dark:bg-gray-900">
                  <tr>
                    <th scope="col" className={ui.th}>{domain ? 'Category' : 'Domain'}</th>
                    <th scope="col" className={`${ui.th} text-right`}>Publications</th>
                    <th scope="col" className={`${ui.th} text-right`}>Researchers</th>
                    <th scope="col" className={`${ui.th} text-right`}>{domain ? 'Specializations' : 'Categories'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {[...cells].sort((a, b) => b.value - a.value).map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50/60 dark:hover:bg-gray-700/30">
                      <td className={ui.td}>
                        <button type="button" onClick={() => pick(c.id)} className="text-left font-medium text-stone-800 hover:text-wine hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:text-gray-100 dark:hover:text-amber">
                          {c.name}
                        </button>
                      </td>
                      <td className={`${ui.td} text-right tabular-nums`}>{fmt(c.value)}</td>
                      <td className={`${ui.td} text-right tabular-nums`}>{fmt(c.researchers)}</td>
                      <td className={`${ui.td} text-right tabular-nums`}>{c.subCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title={category ? category.name : domain ? domain.name : 'Overview'}
          subtitle={category ? domain?.name : domain ? `${fmt(domain.publicationCount)} publications · ${domain.researcherCount} researchers · % of the domain's papers (a paper can sit in several categories)` : 'Largest domains · % of all paper–domain links'}
          icon={category ? <Users /> : <MapIcon />}
          className="xl:self-start"
        >
          {query.isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />)}</div>
          ) : category ? (
            <CategoryDetail c={category} />
          ) : (
            <ul className="space-y-1">
              {(domain ? domain.categories : domains).slice(0, 12).map((x) => {
                const value = x.publicationCount;
                const whole = domain ? domain.publicationCount : totals.publications;
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => pick(x.id)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:bg-gray-700/50">
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-stone-800 dark:text-gray-100">{x.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-gray-400">{fmt(value)} · {sharePct(value, whole)}%</span>
                      </span>
                      <span className="mt-1 block h-1 rounded-full bg-stone-100 dark:bg-gray-700" aria-hidden>
                        <span className="block h-1 rounded-full bg-wine dark:bg-amber" style={{ width: `${sharePct(value, whole)}%` }} />
                      </span>
                    </button>
                  </li>
                );
              })}
              {domain && (
                <li className="pt-3">
                  <Link href={`/research/intelligence/search?domainId=${domain.id}&category=${encodeURIComponent(domain.name)}`} className={ui.btnSecondary}>
                    <ExternalLink className="h-4 w-4" aria-hidden /> Publications in {domain.name}
                  </Link>
                </li>
              )}
            </ul>
          )}
        </AnalyticsPanel>
      </div>
    </div>
  );
}

export function DomainMapView() {
  return (
    <RipGate anyOf={['rip_view_knowledge_graph']} feature="the domain map" capability="Knowledge graph & experts">
      <DomainMapInner />
    </RipGate>
  );
}
