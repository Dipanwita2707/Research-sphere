'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarRange, CircleDollarSign, Download, HandCoins, IndianRupee, Network, PiggyBank, Plus, RefreshCw, Search, Settings2, Table2, Wallet,
} from 'lucide-react';
import { KpiCardGrid } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { useToast } from '@/shared/ui-components/Toast';
import { FinancePageShell } from '../components/FinanceShell';
import FinanceDialog from '../components/FinanceDialog';
import { BlockSkeleton, EmptyState, ErrorState } from '../components/FinanceStates';
import { formatINR, formatINRCompact, isForbidden, toFinanceError } from '../utils/format';
import { BudgetStatusBadge, BurnLegend } from './components/BudgetBits';
import { BudgetSettingsForm } from './components/BudgetEditors';
import BudgetTable from './components/BudgetTable';
import { CycleManagerDialog, CyclePoliciesPanel, CycleSelect, cycleRange } from './components/Cycles';
import NodePanel from './components/NodePanel';
import Organogram from './components/Organogram';
import { budgetService } from './budget.service';
import { findNode, nodeKey, searchTree } from './budgetTree';
import { useBudgetTree, useCycles } from './useBudget';
import type { BudgetNode } from './types';

type ViewMode = 'chart' | 'list';

export default function BudgetView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [cycleParam, setCycleParam] = useState(() => params?.get('cycle') || '');
  // Phones start on the list view (the accessible alternative); the chart stays one tap away.
  // Mode only affects the loaded state, which is never server-rendered, so this cannot mismatch.
  const [mode, setMode] = useState<ViewMode>(() =>
    (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches ? 'list' : 'chart'));
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'overview' | 'allocate'>('overview');
  const [exporting, setExporting] = useState(false);
  const [cyclesOpen, setCyclesOpen] = useState<false | 'list' | 'new'>(false);
  const cyclesQ = useCycles();
  const cycleList = cyclesQ.data?.cycles;
  // The cycle in the URL, else the one containing today, else the newest.
  const cycle = useMemo(
    () => cycleList?.find((c) => c.id === cycleParam) || cycleList?.find((c) => c.isCurrent) || cycleList?.[0] || null,
    [cycleList, cycleParam],
  );
  const q = useBudgetTree(cycle?.id || '', !!cycle);
  const data = q.data;
  const canManageCycles = !!cyclesQ.data?.access.canEdit;

  const changeCycle = (next: string) => {
    setCycleParam(next);
    setSelectedKey(null);
    router.replace(`/finance/budgets?cycle=${next}`, { scroll: false });
  };

  const search = useMemo(() => searchTree(data?.tree, query), [data?.tree, query]);
  const selected: BudgetNode | null = findNode(data?.tree, selectedKey);
  const s = data?.summary;
  const warnPct = s?.warnThresholdPct ?? 80;
  const canEdit = !!data?.access.canEdit;
  const hasBudget = !!data?.budget;

  const doExport = async () => {
    setExporting(true);
    try {
      if (cycle) await budgetService.exportXlsx(cycle.id, cycle.name);
    } catch (err) {
      toast.error(toFinanceError(err, 'Could not export the budget.').message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <FinancePageShell
      gate={false}
      eyebrow="Research budget"
      title="Research budget allocation"
      description="School- and department-wise research budget for each incentive cycle (the period the incentive policies share), with what is committed and paid from the payout lines those policies priced."
      forbidden={isForbidden(q.error) || isForbidden(cyclesQ.error)}
      actions={(
        <>
          {cycleList && cycleList.length > 0 && cycle && <CycleSelect cycles={cycleList} value={cycle.id} onChange={changeCycle} tone="hero" />}
          {canManageCycles && cycleList && cycleList.length > 0 && (
            <button type="button" onClick={() => setCyclesOpen('list')} className={ui.btnSecondary}>
              <CalendarRange className="h-4 w-4" aria-hidden="true" /> Cycles
            </button>
          )}
          {hasBudget && (
            <button type="button" onClick={doExport} disabled={exporting} className={ui.btnSecondary}>
              <Download className={`h-4 w-4 ${exporting ? 'animate-pulse' : ''}`} aria-hidden="true" /> {exporting ? 'Preparing…' : 'Export xlsx'}
            </button>
          )}
          {canEdit && hasBudget && (
            <button type="button" onClick={() => { if (data) { setPanelTab('allocate'); setSelectedKey(nodeKey(data.tree)); } }} className={ui.btnSecondary}>
              <Settings2 className="h-4 w-4" aria-hidden="true" /> Allocate
            </button>
          )}
          <button type="button" onClick={() => { void cyclesQ.refetch(); if (cycle) void q.refetch(); }} disabled={q.isFetching || cyclesQ.isFetching} className={ui.btnSecondary} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${q.isFetching || cyclesQ.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </>
      )}
      chips={hasBudget && s ? [
        { label: 'Total budget', value: formatINRCompact(s.total) },
        { label: 'Available', value: formatINRCompact(s.available) },
        { label: 'External funding received', value: formatINRCompact(s.externalFunding.amount) },
      ] : undefined}
    >
      {cyclesQ.isLoading || (q.isLoading && !!cycle) ? (
        <div className="space-y-6" role="status" aria-label="Loading research budget">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <BlockSkeleton key={i} className="h-24" />)}</div>
          <BlockSkeleton className="h-[560px]" />
        </div>
      ) : cyclesQ.isError ? (
        <div className={ui.card}>
          <ErrorState title="Couldn't load the incentive cycles" message={toFinanceError(cyclesQ.error).message} onRetry={() => cyclesQ.refetch()} retrying={cyclesQ.isFetching} />
        </div>
      ) : !cycle ? (
        <div className={ui.card}>
          <EmptyState
            icon={<CalendarRange />}
            title="No incentive cycle yet"
            description={
              'A cycle is the period that incentive policies and the research budget share, usually the financial year (April to March). '
              + (canManageCycles ? 'Create one to set its budget.' : 'A finance approver can create it.')
            }
            action={canManageCycles ? (
              <button type="button" onClick={() => setCyclesOpen('new')} className={ui.btnPrimary}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Create cycle
              </button>
            ) : undefined}
          />
        </div>
      ) : q.isError || !data || !s ? (
        <div className={ui.card}>
          <ErrorState title="Couldn't load the research budget" message={toFinanceError(q.error).message} onRetry={() => q.refetch()} retrying={q.isFetching} />
        </div>
      ) : !hasBudget ? (
        <div className="space-y-6">
        <div className={ui.card}>
          <EmptyState
            icon={<PiggyBank />}
            title={`No research budget for ${cycle.name} yet`}
            description={
              `${cycleRange(cycle)}. `
              + (s.consumed > 0 || s.pending > 0
                ? `Payout lines priced by this cycle's policies already show ${formatINR(s.consumed)} committed or paid and ${formatINR(s.pending)} awaiting verification. `
                : '')
              + (canEdit
                ? 'Set the university total, then distribute it across schools and departments to track utilisation.'
                : 'A finance approver can set it up; utilisation will appear here once it exists.')
            }
            action={canEdit ? (
              <button type="button" onClick={() => setSetupOpen(true)} className={ui.btnPrimary}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Set up budget
              </button>
            ) : undefined}
          />
        </div>
        {!data.access.scoped && <CyclePoliciesPanel cycle={cycle} />}
        </div>
      ) : (
        <>
          {data.access.scoped && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100">
              Read-only view of the schools in your analytics scope. Totals cover those schools only.
            </p>
          )}
          <KpiCardGrid
            cards={[
              { label: data.access.scoped ? 'Allocated to your schools' : 'Total budget', value: formatINR(s.total), icon: <Wallet /> },
              { label: 'Allocated to schools', value: formatINR(s.allocatedToSchools), icon: <Network />, trendValue: data.access.scoped ? undefined : `${formatINRCompact(s.unallocated)} unallocated` },
              { label: 'Committed', value: formatINR(s.committed), icon: <HandCoins /> },
              { label: 'Utilised (paid)', value: formatINR(s.utilised), icon: <IndianRupee /> },
              { label: 'Available', value: formatINR(s.available), icon: <CircleDollarSign /> },
              { label: 'Utilisation', value: s.utilisationPct == null ? '—' : `${s.utilisationPct}%`, icon: <PiggyBank /> },
            ]}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-72">
                <label htmlFor="budget-search" className="sr-only">Search schools and departments</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                <input id="budget-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search schools and departments" className={`w-full pl-9 ${ui.input}`} />
              </div>
              {query.trim() && <span className="text-xs text-stone-500 dark:text-gray-400" aria-live="polite">{search.matches.size} match{search.matches.size === 1 ? '' : 'es'}</span>}
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-400">Overall <BudgetStatusBadge status={s.status} warnPct={warnPct} /></span>
            </div>
            <div className="flex items-center gap-3">
              <BurnLegend />
              <div role="radiogroup" aria-label="View" className="inline-flex rounded-lg border border-stone-200 p-0.5 dark:border-gray-600">
                {([['chart', 'Organogram', Network], ['list', 'List', Table2]] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={mode === key}
                    onClick={() => setMode(key)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 ${mode === key ? 'bg-wine text-white dark:bg-amber dark:text-stone-900' : 'text-stone-600 hover:bg-stone-50 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === 'chart' ? (
            <Organogram
              root={data.tree}
              warnPct={warnPct}
              selectedKey={selectedKey}
              onSelect={(n) => { setPanelTab('overview'); setSelectedKey(nodeKey(n)); }}
              matches={search.matches}
              forceExpand={search.expand}
            />
          ) : (
            <BudgetTable root={data.tree} warnPct={warnPct} selectedKey={selectedKey} onSelect={(n) => { setPanelTab('overview'); setSelectedKey(nodeKey(n)); }} matches={query.trim() ? search.matches : new Set()} />
          )}

          <p className="text-xs text-stone-500 dark:text-gray-400">
            Committed = recommended, on hold and approved (not yet paid) payout lines; utilised = paid; available = allocated − committed − utilised.
            Lines awaiting verification are shown as pending and not counted. Lines are attributed to the payee&apos;s school and department when they are created,
            and to the cycle containing the date that selected their incentive policy (publication date, grant sanction date, IPR publication).
            {data.budget?.enforceLimit ? ' Limits are enforced: batch approvals that would leave a unit over budget are refused.' : ' Over-budget approvals are allowed with a warning.'}
          </p>

          {!data.access.scoped && <CyclePoliciesPanel cycle={cycle} />}
        </>
      )}

      {data && cycle && selected && <NodePanel key={selectedKey} cycle={cycle} data={data} node={selected} initialTab={panelTab} onClose={() => setSelectedKey(null)} />}

      {canManageCycles && (
        <CycleManagerDialog
          key={cyclesOpen || 'closed'}
          open={!!cyclesOpen}
          initialMode={cyclesOpen === 'new' ? 'new' : 'list'}
          data={cyclesQ.data}
          onClose={() => setCyclesOpen(false)}
          onCreated={(c) => changeCycle(c.id)}
        />
      )}

      {cycle && (
      <FinanceDialog open={setupOpen} onClose={() => setSetupOpen(false)} title={`Set up the ${cycle.name} research budget`} description={`${cycleRange(cycle)}. Start with the university total. You can then distribute it across schools and departments.`} size="lg">
        <BudgetSettingsForm cycle={cycle} budget={null} childrenAllocated={0} onSaved={() => { setSetupOpen(false); if (data) { setPanelTab('allocate'); setSelectedKey(nodeKey(data.tree)); } }} onCancel={() => setSetupOpen(false)} />
      </FinanceDialog>
      )}
    </FinancePageShell>
  );
}
