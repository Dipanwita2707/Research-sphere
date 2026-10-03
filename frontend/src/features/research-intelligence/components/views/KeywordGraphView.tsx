'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, GraduationCap, Hash, Network, Search, Sparkles, Table2, Tags, TrendingUp, X } from 'lucide-react';
import { AnalyticsPanel, KpiCardGrid } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { useRipAccess } from '../../hooks/useRipAccess';
import { useDomainMap, useKeywordCooccurrences, useKeywordKpis, useKeywordNetwork, useTrendingKeywords } from '../../hooks/useKnowledgeGraph';
import { buildKeywordGraph, categoryOptions, edgeTableRows, errorMessage, localCooccurrences, yearlySeries } from '../../utils/graphUtils';
import { ForceGraph } from '../graph/ForceGraph';
import { GraphLegend, GraphSkeleton, ListSkeleton, RipEmpty, RipError, RipGate, RipPageHeader } from '../shared/RipStates';
import type { TrendingKeyword } from '../../graph.types';

/** useSearchParams can be null outside the app router (tests). */
const EMPTY_PARAMS = new URLSearchParams();
const LIMITS = [30, 60, 100, 150, 200];
const MIN_WEIGHTS = [1, 2, 3, 5, 10];
const fmt = (n: number) => n.toLocaleString('en-IN');

function Sparkline({ volume, label }: { volume: Record<string, number> | null; label: string }) {
  const series = yearlySeries(volume, 6, new Date().getFullYear());
  const max = Math.max(1, ...series.map((s) => s.count));
  return (
    <svg width={60} height={20} role="img" aria-label={`${label}: ${series.map((s) => `${s.year} ${s.count}`).join(', ')}`} className="shrink-0">
      {series.map((s, i) => {
        const h = Math.max(1.5, (s.count / max) * 18);
        return <rect key={s.year} x={i * 10 + 1} y={20 - h} width={7} height={h} rx={1} style={{ fill: s.count ? 'var(--viz-1)' : 'var(--viz-grid)' }} />;
      })}
    </svg>
  );
}

function KeywordGraphInner() {
  const params = useSearchParams() ?? EMPTY_PARAMS;
  const { can } = useRipAccess();
  const canGraph = can('rip_view_knowledge_graph');
  const canKw = can('rip_view_keyword_intelligence');

  const [categoryId, setCategoryId] = useState('');
  const [minWeight, setMinWeight] = useState(2);
  const [limit, setLimit] = useState(60);
  const [view, setView] = useState<'graph' | 'table'>('graph');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(() => {
    const id = params.get('keywordId');
    return id ? { id, name: params.get('name') || 'Keyword' } : null;
  });

  const network = useKeywordNetwork({ categoryId: categoryId || undefined, minWeight, limit }, canGraph);
  const domains = useDomainMap(canGraph);
  const kpis = useKeywordKpis(canKw);
  const trending = useTrendingKeywords(15, canKw);
  const cooc = useKeywordCooccurrences(selected?.id || null, canKw);

  const graph = useMemo(() => buildKeywordGraph(network.data), [network.data]);
  const rows = useMemo(() => edgeTableRows(graph.nodes, graph.links), [graph]);
  const cats = useMemo(() => categoryOptions(domains.data), [domains.data]);
  const trendBy = useMemo(() => new Map((trending.data?.trending || []).map((t) => [t.id, t])), [trending.data]);

  const selNode = selected ? graph.byId.get(selected.id) : undefined;
  const selTrend: TrendingKeyword | undefined = selected ? trendBy.get(selected.id) : undefined;
  const coList = canKw ? cooc.data || [] : localCooccurrences(network.data, selected?.id || '', 15);

  const select = (id: string | null) => {
    if (!id) return setSelected(null);
    const n = graph.byId.get(id);
    const t = trendBy.get(id);
    setSelected({ id, name: n?.name || t?.canonicalName || coList.find((c) => c.id === id)?.name || 'Keyword' });
  };

  const toggleGroup = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-5">
      <RipPageHeader
        title="Keyword Knowledge Graph"
        description="Research keywords that appear on the same papers. Node size shows publications; line width shows how many papers two keywords share."
        icon={<Tags />}
        chips={
          canKw && kpis.data
            ? [
                { label: 'Keywords', value: fmt(kpis.data.total) },
                { label: 'Taxonomy coverage', value: `${kpis.data.taxonomyCoverage}%` },
                { label: 'Pending review', value: fmt(kpis.data.pendingReview) },
                { label: 'Growing fast', value: fmt(kpis.data.growing) },
              ]
            : canGraph
              ? [
                  { label: 'Keywords shown', value: fmt(graph.nodes.length) },
                  { label: 'Co-occurrence links', value: fmt(graph.links.length) },
                ]
              : undefined
        }
      />

      {canKw &&
        (kpis.isError ? (
          <RipError title="Couldn't load keyword KPIs" message={errorMessage(kpis.error)} onRetry={() => kpis.refetch()} />
        ) : kpis.isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[...Array(4)].map((_, i) => <div key={i} className="h-[92px] animate-pulse rounded-xl bg-stone-200 dark:bg-gray-800" />)}</div>
        ) : kpis.data ? (
          <KpiCardGrid
            cols={4}
            cards={[
              { label: 'Keywords with publications', value: kpis.data.total, icon: <Hash /> },
              { label: 'Mapped to taxonomy', value: kpis.data.mapped, icon: <CheckCircle2 /> },
              { label: 'Awaiting review', value: kpis.data.pendingReview, icon: <AlertCircle /> },
              { label: 'Growing > 25%', value: kpis.data.growing, icon: <TrendingUp /> },
            ]}
          />
        ) : null)}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {canGraph ? (
            <AnalyticsPanel
              title={view === 'graph' ? 'Co-occurrence graph' : 'Co-occurrence links'}
              subtitle={view === 'graph' ? 'Hover or focus a keyword to see what it appears with; click for details.' : 'Keyword pairs in the current view, most shared papers first.'}
              icon={<Network />}
              actions={
                <div className="flex h-8 overflow-hidden rounded-lg border border-stone-200 dark:border-gray-600" role="group" aria-label="Display">
                  {(['graph', 'table'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={view === v}
                      onClick={() => setView(v)}
                      className={`inline-flex items-center gap-1.5 px-2.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wine/40 ${view === v ? 'bg-wine text-white' : 'bg-white text-stone-600 hover:bg-stone-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                    >
                      {v === 'graph' ? <Network className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
                      {v === 'graph' ? 'Graph' : 'Table'}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={`${ui.label} mb-1 block`}>Category</span>
                  <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setHidden(new Set()); }} className={`${ui.input} w-full`} disabled={domains.isLoading}>
                    <option value="">All categories</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.domain} — {c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={`${ui.label} mb-1 block`}>Min shared papers</span>
                  <select value={minWeight} onChange={(e) => setMinWeight(Number(e.target.value))} className={`${ui.input} w-full`}>
                    {MIN_WEIGHTS.map((n) => (
                      <option key={n} value={n}>{n === 1 ? 'Any' : `${n}+`}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={`${ui.label} mb-1 block`}>Keywords</span>
                  <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={`${ui.input} w-full`}>
                    {LIMITS.map((n) => (
                      <option key={n} value={n}>Top {n}</option>
                    ))}
                  </select>
                </label>
              </div>

              {network.isLoading ? (
                <GraphSkeleton />
              ) : network.isError ? (
                <RipError message={errorMessage(network.error)} onRetry={() => network.refetch()} />
              ) : graph.nodes.length === 0 ? (
                <RipEmpty title="No keywords yet" message="Run the Research Intelligence index, or choose another category." icon={<Tags />} />
              ) : view === 'graph' ? (
                <div className="space-y-4">
                  <ForceGraph
                    label="Keyword co-occurrence network"
                    nodes={graph.nodes}
                    links={graph.links}
                    selectedId={selected?.id}
                    onSelect={select}
                    hiddenGroups={hidden}
                    labelCount={18}
                    edgeTitle={(l) => `${graph.byId.get(l.source)?.name} + ${graph.byId.get(l.target)?.name}: ${l.weight} shared papers`}
                    renderTooltip={(n) => {
                      const k = graph.byId.get(n.id);
                      return k ? (
                        <>
                          <p className="font-semibold text-stone-900 dark:text-white">{k.name}</p>
                          <p className="text-stone-500 dark:text-gray-400">{k.category || 'Not mapped to a category'}</p>
                          <p className="mt-1 tabular-nums text-stone-700 dark:text-gray-200">
                            {k.pubs} publications{k.momentum != null ? ` · momentum ${k.momentum.toFixed(2)}` : ''}
                          </p>
                        </>
                      ) : null;
                    }}
                  />
                  {graph.links.length === 0 && <p className="text-xs text-stone-500 dark:text-gray-400">No pairs share {minWeight}+ papers — lower the threshold to see links.</p>}
                  <GraphLegend title="Category (click to hide)" items={graph.legend} onToggle={toggleGroup} hidden={hidden} />
                </div>
              ) : rows.length === 0 ? (
                <RipEmpty title="No pairs at this threshold" message="Lower the minimum shared papers to see more links." />
              ) : (
                <div className="max-h-[560px] overflow-auto rounded-lg border border-stone-100 dark:border-gray-700">
                  <table className="w-full min-w-[480px] text-sm">
                    <caption className="sr-only">Keyword pairs and shared papers</caption>
                    <thead className="sticky top-0 bg-stone-50 dark:bg-gray-900">
                      <tr>
                        <th scope="col" className={ui.th}>Keyword</th>
                        <th scope="col" className={ui.th}>Appears with</th>
                        <th scope="col" className={`${ui.th} text-right`}>Shared papers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                      {rows.map((r) => (
                        <tr key={r.key} className="hover:bg-stone-50/60 dark:hover:bg-gray-700/30">
                          {[{ id: r.sourceId, name: r.sourceName }, { id: r.targetId, name: r.targetName }].map((p) => (
                            <td key={p.id} className={ui.td}>
                              <button type="button" onClick={() => select(p.id)} className="text-left font-medium text-stone-800 hover:text-wine hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:text-gray-100 dark:hover:text-amber">
                                {p.name}
                              </button>
                            </td>
                          ))}
                          <td className={`${ui.td} text-right font-semibold tabular-nums`}>{r.weight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AnalyticsPanel>
          ) : (
            <div className={`${ui.card} px-5 py-4 text-sm text-stone-600 dark:text-gray-300`}>
              The co-occurrence graph needs the <strong>Knowledge graph &amp; experts</strong> permission. Trending keywords and co-occurrences are shown below.
            </div>
          )}

          {canKw && (
            <AnalyticsPanel title="Trending keywords" subtitle="Highest momentum (recent growth weighted by volume). Bars show the last six years." icon={<TrendingUp />}>
              {trending.isLoading ? (
                <ListSkeleton rows={6} />
              ) : trending.isError ? (
                <RipError message={errorMessage(trending.error)} onRetry={() => trending.refetch()} />
              ) : !trending.data?.trending.length ? (
                <RipEmpty title="No trending keywords" message="Keywords need at least two publications to trend." icon={<TrendingUp />} />
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                  <ol className="divide-y divide-stone-100 dark:divide-gray-700">
                    {trending.data.trending.map((t, i) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelected({ id: t.id, name: t.canonicalName })}
                          aria-pressed={selected?.id === t.id}
                          className={`flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:bg-gray-700/40 ${selected?.id === t.id ? 'bg-wine/5 dark:bg-wine/20' : ''}`}
                        >
                          <span className="w-5 text-xs tabular-nums text-stone-400">{i + 1}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-stone-800 dark:text-gray-100">{t.canonicalName}</span>
                            <span className="block text-xs text-stone-500 dark:text-gray-400">
                              {t.publicationCount} pubs · {t.researcherCount} researchers{t.growthRate != null ? ` · ${t.growthRate > 0 ? '+' : ''}${t.growthRate}%` : ''}
                            </span>
                          </span>
                          <Sparkline volume={t.yearlyVolume} label={`${t.canonicalName} publications per year`} />
                          <span className="w-12 text-right text-xs font-semibold tabular-nums text-stone-700 dark:text-gray-200" title="Momentum">
                            {t.momentum != null ? t.momentum.toFixed(2) : '—'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <div>
                    <p className={ui.label}>Emerging (first seen in the last two years)</p>
                    {trending.data.emerging.length ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {trending.data.emerging.map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              onClick={() => setSelected({ id: e.id, name: e.canonicalName })}
                              className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:border-amber/30 dark:bg-amber-900/20 dark:text-amber-200"
                            >
                              <Sparkles className="h-3 w-3" aria-hidden />
                              {e.canonicalName}
                              <span className="tabular-nums opacity-70">{e.publicationCount}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-stone-500 dark:text-gray-400">No new keywords recently.</p>
                    )}
                  </div>
                </div>
              )}
            </AnalyticsPanel>
          )}
        </div>

        <AnalyticsPanel title={selected ? selected.name : 'Keyword details'} subtitle={selected ? selNode?.category || undefined : 'Select a keyword in the graph or the trending list'} icon={<Hash />} className="xl:self-start">
          {!selected ? (
            <RipEmpty title="No keyword selected" message="Click a node, a table row, or a trending keyword to see what it appears with." icon={<Hash />} />
          ) : (
            <div className="space-y-4" aria-live="polite">
              <div className="flex justify-end -mt-2">
                <button type="button" onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:text-gray-400 dark:hover:text-white">
                  <X className="h-3.5 w-3.5" aria-hidden /> Clear
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Publications', value: selNode?.pubs ?? selTrend?.publicationCount },
                  { label: 'Momentum', value: (selNode?.momentum ?? selTrend?.momentum)?.toFixed(2) },
                  { label: 'Researchers', value: selTrend?.researcherCount },
                  { label: 'Citations', value: selTrend?.totalCitations },
                ]
                  .filter((s) => s.value !== undefined && s.value !== null)
                  .map((s) => (
                    <div key={s.label} className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
                      <dt className="text-[11px] text-stone-500 dark:text-gray-400">{s.label}</dt>
                      <dd className="text-lg font-semibold tabular-nums text-stone-900 dark:text-white">{s.value}</dd>
                    </div>
                  ))}
              </dl>
              {selTrend && (
                <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1">Trending{selTrend.firstSeenYear ? ` · first seen ${selTrend.firstSeenYear}` : ''}</span>
                  <Sparkline volume={selTrend.yearlyVolume} label={`${selTrend.canonicalName} publications per year`} />
                </div>
              )}
              <div>
                <p className={ui.label}>Most often appears with</p>
                {canKw && cooc.isLoading ? (
                  <div className="mt-2"><ListSkeleton rows={4} /></div>
                ) : canKw && cooc.isError ? (
                  <RipError message={errorMessage(cooc.error)} onRetry={() => cooc.refetch()} />
                ) : coList.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-500 dark:text-gray-400">No co-occurring keywords{canKw ? '' : ' in this view'}.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {coList.map((c) => {
                      const max = coList[0].shared || 1;
                      return (
                        <li key={c.id}>
                          <button type="button" onClick={() => setSelected({ id: c.id, name: c.name })} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:bg-gray-700/50">
                            <span className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate text-stone-800 dark:text-gray-100">{c.name}</span>
                              <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-gray-400">{c.shared} shared</span>
                            </span>
                            <span className="mt-1 block h-1 rounded-full bg-stone-100 dark:bg-gray-700">
                              <span className="block h-1 rounded-full" style={{ width: `${(c.shared / max) * 100}%`, background: 'var(--viz-1)' }} />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={`/research/intelligence/search?q=${encodeURIComponent(selected.name)}`} className={ui.btnSecondary}>
                  <Search className="h-4 w-4" aria-hidden /> Publications
                </Link>
                {canGraph && (
                  <Link href={`/research/intelligence/experts?topic=${encodeURIComponent(selected.name)}`} className={ui.btnSecondary}>
                    <GraduationCap className="h-4 w-4" aria-hidden /> Experts
                  </Link>
                )}
                {canGraph && selNode?.categoryId && selNode.categoryId !== categoryId && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryId(selNode.categoryId!);
                      setHidden(new Set());
                    }}
                    className={ui.btnSecondary}
                  >
                    <Tags className="h-4 w-4" aria-hidden /> Only {selNode.category}
                  </button>
                )}
              </div>
            </div>
          )}
        </AnalyticsPanel>
      </div>
    </div>
  );
}

export function KeywordGraphView() {
  return (
    <RipGate anyOf={['rip_view_knowledge_graph', 'rip_view_keyword_intelligence']} feature="keyword intelligence" capability="Keywords & trends">
      <KeywordGraphInner />
    </RipGate>
  );
}
