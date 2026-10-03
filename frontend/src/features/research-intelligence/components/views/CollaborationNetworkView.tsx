'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Network, Share2, Table2, Users, X } from 'lucide-react';
import { AnalyticsPanel } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { useCollaborationNetwork, useUnits } from '../../hooks/useKnowledgeGraph';
import {
  buildCollaborationGraph,
  edgeTableRows,
  errorMessage,
  indexUnits,
  topCollaborators,
  type CollabColorBy,
} from '../../utils/graphUtils';
import { ForceGraph } from '../graph/ForceGraph';
import { EntityPicker, type PickedEntity } from '../shared/EntityPicker';
import { GraphLegend, GraphSkeleton, RipEmpty, RipError, RipGate, RipPageHeader } from '../shared/RipStates';
import type { CollaborationNode } from '../../graph.types';

/** useSearchParams can be null outside the app router (tests). */
const EMPTY_PARAMS = new URLSearchParams();
const LIMITS = [30, 60, 100, 200];
const MIN_JOINT = [1, 2, 3, 5];
const fmt = (n: number) => n.toLocaleString('en-IN');

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
      <dt className="text-[11px] font-medium text-stone-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-stone-900 dark:text-white">{value}</dd>
    </div>
  );
}

function ResearcherPanel({
  node,
  collaborators,
  isFocus,
  onClose,
  onEgo,
  onSelect,
}: {
  node: CollaborationNode;
  collaborators: { id: string; name: string; weight: number }[];
  isFocus: boolean;
  onClose: () => void;
  onEgo: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-stone-900 dark:text-white">{node.name}</h3>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">{[node.designation, node.department].filter(Boolean).join(' · ') || '—'}</p>
          {node.school && <p className="text-xs text-stone-500 dark:text-gray-400">{node.school}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close researcher details" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:bg-gray-700 dark:hover:text-gray-200">
          <X className="h-4 w-4" />
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Publications" value={fmt(node.pubs)} />
        <Stat label="Collaborators" value={fmt(node.collaborators)} />
        <Stat label="Joint papers" value={fmt(node.strength)} />
        <Stat label="h-index" value={node.hIndex || '—'} />
        <Stat label="Citations" value={fmt(node.citations)} />
        <Stat label="Domain" value={<span className="block truncate text-sm" title={node.domain || ''}>{node.domain || '—'}</span>} />
      </dl>
      {node.primaryTopic && (
        <p className="mt-3 text-xs text-stone-600 dark:text-gray-300">
          Primary topic: <span className="font-medium">{node.primaryTopic}</span>
        </p>
      )}
      {collaborators.length > 0 && (
        <div className="mt-4">
          <p className={ui.label}>Strongest links in this view</p>
          <ul className="mt-2 space-y-1">
            {collaborators.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onSelect(c.id)} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:text-gray-200 dark:hover:bg-gray-700/60">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-gray-400">{c.weight} joint</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/research/profile/${node.id}`} className={ui.btnPrimary}>
          <ExternalLink className="h-4 w-4" aria-hidden /> View profile
        </Link>
        {!isFocus && (
          <button type="button" onClick={onEgo} className={ui.btnSecondary}>
            <Share2 className="h-4 w-4" aria-hidden /> Ego network
          </button>
        )}
      </div>
    </div>
  );
}

function CollaborationNetworkInner() {
  const router = useRouter();
  const pathname = usePathname() || '/research/intelligence';
  const params = useSearchParams() ?? EMPTY_PARAMS;
  const userId = params.get('userId') || undefined;
  const departmentId = params.get('departmentId') || undefined;
  const minJoint = Math.max(1, Number(params.get('minJointPapers')) || 1);
  const limit = Number(params.get('limit')) || 60;

  const unitsQuery = useUnits();
  const units = useMemo(() => indexUnits(unitsQuery.data), [unitsQuery.data]);
  // A department implies its school, so links from search (departmentId only) still fill the school filter.
  const schoolId = params.get('schoolId') || units.schoolOfDepartment(departmentId) || undefined;
  const schoolName = units.schoolName(schoolId);
  const departmentName = units.departmentName(departmentId);

  const [colorBy, setColorBy] = useState<CollabColorBy>('school');
  const [view, setView] = useState<'graph' | 'table'>('graph');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const query = useCollaborationNetwork({ userId, schoolId: departmentId ? undefined : schoolId, departmentId, limit, minJointPapers: minJoint > 1 ? minJoint : undefined });
  const graph = useMemo(() => buildCollaborationGraph(query.data, { colorBy }), [query.data, colorBy]);
  const rows = useMemo(() => edgeTableRows(graph.nodes, graph.links), [graph]);
  const selected = selectedId ? graph.byId.get(selectedId) : undefined;
  const focusNode = userId ? query.data?.nodes.find((n) => n.id === userId) : undefined;
  const totalJoint = graph.links.reduce((s, l) => s + l.weight, 0);

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setSelectedId(null);
    setHidden(new Set());
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const researcherValue: PickedEntity | null = userId ? { id: userId, label: focusNode?.name || 'Selected researcher' } : null;
  const departments = units.departmentsOf(schoolId);

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
        title={focusNode ? `${focusNode.name}'s network` : 'Collaboration Network'}
        description={
          focusNode
            ? 'This researcher, their co-authors inside the university, and the links among them. Node size shows publications; line width shows joint papers.'
            : 'Co-authorship links between the most connected researchers. Node size shows publications; line width shows joint papers.'
        }
        icon={<Network />}
        chips={[
          { label: 'Researchers', value: fmt(graph.nodes.length) },
          { label: 'Links', value: fmt(graph.links.length) },
          { label: 'Joint papers', value: fmt(totalJoint) },
          { label: 'View', value: focusNode ? 'Ego network' : departmentName || schoolName || 'University' },
        ]}
        actions={
          userId ? (
            <button type="button" onClick={() => setParam({ userId: null })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Full network
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className={`${ui.card} grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end`}>
        <EntityPicker kind="researchers" label="Focus on a researcher" placeholder="Search by name…" value={researcherValue} onChange={(v) => setParam({ userId: v?.id || null })} />
        <label className="block">
          <span className={`${ui.label} mb-1 block`}>School</span>
          <select
            value={schoolId || ''}
            onChange={(e) => setParam({ schoolId: e.target.value || null, departmentId: null })}
            className={`${ui.input} w-full`}
            disabled={unitsQuery.isLoading}
          >
            <option value="">{unitsQuery.isError ? 'Schools unavailable' : 'All schools'}</option>
            {unitsQuery.data?.schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={`${ui.label} mb-1 block`}>Department</span>
          <select
            value={departmentId || ''}
            onChange={(e) => setParam({ departmentId: e.target.value || null, schoolId: e.target.value ? units.schoolOfDepartment(e.target.value) : schoolId || null })}
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
          <span className={`${ui.label} mb-1 block`}>Min joint papers</span>
          <select value={minJoint} onChange={(e) => setParam({ minJointPapers: e.target.value === '1' ? null : e.target.value })} className={`${ui.input} w-full`}>
            {MIN_JOINT.map((n) => (
              <option key={n} value={n}>{n === 1 ? 'Any' : `${n}+`}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={`${ui.label} mb-1 block`}>Researchers</span>
          <select value={limit} onChange={(e) => setParam({ limit: e.target.value === '60' ? null : e.target.value })} className={`${ui.input} w-full`}>
            {LIMITS.map((n) => (
              <option key={n} value={n}>Top {n}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={`${ui.label} mb-1 block`}>Colour by</span>
          <select value={colorBy} onChange={(e) => { setColorBy(e.target.value as CollabColorBy); setHidden(new Set()); }} className={`${ui.input} w-full`}>
            <option value="school">School</option>
            <option value="department">Department</option>
          </select>
        </label>
        <div className="flex h-9 overflow-hidden rounded-lg border border-stone-200 dark:border-gray-600" role="group" aria-label="Display">
          {(['graph', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wine/40 ${view === v ? 'bg-wine text-white' : 'bg-white text-stone-600 hover:bg-stone-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
            >
              {v === 'graph' ? <Network className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
              {v === 'graph' ? 'Graph' : 'Table'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <AnalyticsPanel
          title={view === 'graph' ? 'Co-authorship graph' : 'Collaboration links'}
          subtitle={view === 'graph' ? 'Hover or focus a researcher to see their links; click to open details. Drag to pan, scroll to zoom.' : 'Every link in the current view, strongest first.'}
          icon={<Users />}
        >
          {query.isLoading ? (
            <GraphSkeleton />
          ) : query.isError ? (
            <RipError message={errorMessage(query.error)} onRetry={() => query.refetch()} />
          ) : graph.nodes.length === 0 ? (
            <RipEmpty
              title="No collaborations found"
              message={userId ? 'This researcher has no recorded co-authors inside the university yet.' : 'No co-authored publications match these filters. Try a lower joint-paper threshold or another school.'}
              icon={<Network />}
            />
          ) : view === 'graph' ? (
            <div className="space-y-4">
              <ForceGraph
                label="Co-authorship network"
                nodes={graph.nodes}
                links={graph.links}
                selectedId={selectedId}
                focusId={userId}
                onSelect={setSelectedId}
                hiddenGroups={hidden}
                edgeTitle={(l) => `${graph.byId.get(l.source)?.name} and ${graph.byId.get(l.target)?.name}: ${l.weight} joint papers`}
                renderTooltip={(n) => {
                  const r = graph.byId.get(n.id);
                  return r ? (
                    <>
                      <p className="font-semibold text-stone-900 dark:text-white">{r.name}</p>
                      <p className="text-stone-500 dark:text-gray-400">{r.department || r.school || '—'}</p>
                      <p className="mt-1 tabular-nums text-stone-700 dark:text-gray-200">
                        {r.pubs} publications · {r.collaborators} collaborators · {r.strength} joint papers
                      </p>
                    </>
                  ) : null;
                }}
              />
              <GraphLegend title={colorBy === 'school' ? 'School (click to hide)' : 'Department (click to hide)'} items={graph.legend} onToggle={toggleGroup} hidden={hidden} />
              {query.isFetching && <p className="text-xs text-stone-500 dark:text-gray-400" aria-live="polite">Updating…</p>}
            </div>
          ) : rows.length === 0 ? (
            <RipEmpty title="No links at this threshold" message="Lower the minimum joint papers to see more links." />
          ) : (
            <div className="max-h-[560px] overflow-auto rounded-lg border border-stone-100 dark:border-gray-700">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Co-authorship links, strongest first</caption>
                <thead className="sticky top-0 bg-stone-50 dark:bg-gray-900">
                  <tr>
                    <th scope="col" className={ui.th}>Researcher</th>
                    <th scope="col" className={ui.th}>Co-author</th>
                    <th scope="col" className={`${ui.th} text-right`}>Joint papers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                  {rows.map((r) => (
                    <tr key={r.key} className="hover:bg-stone-50/60 dark:hover:bg-gray-700/30">
                      {[{ id: r.sourceId, name: r.sourceName }, { id: r.targetId, name: r.targetName }].map((p) => (
                        <td key={p.id} className={ui.td}>
                          <button type="button" onClick={() => setSelectedId(p.id)} className="text-left font-medium text-stone-800 hover:text-wine hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:text-gray-100 dark:hover:text-amber">
                            {p.name}
                          </button>
                          <div className="text-xs text-stone-500 dark:text-gray-400">{graph.byId.get(p.id)?.department || ''}</div>
                        </td>
                      ))}
                      <td className={`${ui.td} text-right tabular-nums font-semibold`}>{r.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnalyticsPanel>

        <AnalyticsPanel title={selected ? 'Researcher' : 'Most connected'} subtitle={selected ? undefined : 'By joint papers in this view'} icon={<Users />} className="xl:self-start">
          {selected ? (
            <ResearcherPanel
              node={selected}
              collaborators={topCollaborators(query.data, selected.id)}
              isFocus={selected.id === userId}
              onClose={() => setSelectedId(null)}
              onEgo={() => setParam({ userId: selected.id })}
              onSelect={setSelectedId}
            />
          ) : query.isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-9 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />)}</div>
          ) : (
            <ol className="space-y-1">
              {[...graph.byId.values()]
                .sort((a, b) => b.strength - a.strength || b.pubs - a.pubs)
                .slice(0, 10)
                .map((n, i) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => setSelectedId(n.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:hover:bg-gray-700/60">
                      <span className="w-5 text-xs tabular-nums text-stone-400">{i + 1}</span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: graph.nodes.find((g) => g.id === n.id)?.color }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-stone-800 dark:text-gray-100">{n.name}</span>
                        <span className="block truncate text-xs text-stone-500 dark:text-gray-400">{n.department || '—'}</span>
                      </span>
                      <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400">{n.strength}</span>
                    </button>
                  </li>
                ))}
            </ol>
          )}
        </AnalyticsPanel>
      </div>
    </div>
  );
}

export function CollaborationNetworkView() {
  return (
    <RipGate anyOf={['rip_view_knowledge_graph']} feature="the collaboration network" capability="Knowledge graph & experts">
      <CollaborationNetworkInner />
    </RipGate>
  );
}
