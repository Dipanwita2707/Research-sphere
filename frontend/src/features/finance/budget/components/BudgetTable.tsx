'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { formatINR, formatINRCompact } from '../../utils/format';
import { BudgetStatusBadge, UtilisationBar } from './BudgetBits';
import { flatten, nodeKey } from '../budgetTree';
import type { BudgetNode } from '../types';

const LEVEL: Record<string, string> = { university: 'University', school: 'School', department: 'Department', unassigned: 'Unassigned' };

/**
 * Accessible alternative to the organogram (and the default on phones): every node with its
 * figures. Phones get stacked cards; wider screens a table.
 */
export default function BudgetTable({
  root, warnPct, selectedKey, onSelect, matches,
}: { root: BudgetNode; warnPct: number; selectedKey: string | null; onSelect: (n: BudgetNode) => void; matches: Set<string> }) {
  const rows = flatten(root).filter((n) => matches.size === 0 || matches.has(nodeKey(n)));
  if (!rows.length) {
    return <div className={`${ui.card} px-4 py-10 text-center text-sm text-stone-500 dark:text-gray-400`}>No school or department matches the search.</div>;
  }
  return (
    <div className={`overflow-hidden ${ui.card}`}>
      {/* Phone: cards */}
      <ul className="divide-y divide-stone-100 dark:divide-gray-700 md:hidden">
        {rows.map((n) => (
          <li key={nodeKey(n)}>
            <button
              type="button"
              onClick={() => onSelect(n)}
              aria-current={selectedKey === nodeKey(n) ? 'true' : undefined}
              className={`block w-full px-4 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none dark:hover:bg-gray-700/40 ${n.depth === 2 ? 'pl-8' : ''} ${selectedKey === nodeKey(n) ? 'bg-rose-50/60 dark:bg-wine/10' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:text-gray-400">{LEVEL[n.nodeType]}{n.code ? ` · ${n.code}` : ''}</p>
                  <p className="text-sm font-semibold text-stone-900 dark:text-white">{n.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <BudgetStatusBadge status={n.status} warnPct={warnPct} />
                  <ChevronRight className="h-4 w-4 text-stone-400" aria-hidden="true" />
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {n.nodeType !== 'unassigned' && <div className="flex justify-between gap-2"><dt className="text-stone-500 dark:text-gray-400">Allocated</dt><dd className="font-medium tabular-nums text-stone-900 dark:text-white">{formatINRCompact(n.allocated)}</dd></div>}
                {n.nodeType !== 'unassigned' && <div className="flex justify-between gap-2"><dt className="text-stone-500 dark:text-gray-400">Available</dt><dd className={`font-medium tabular-nums ${n.available < 0 ? 'text-red-700 dark:text-red-300' : 'text-stone-900 dark:text-white'}`}>{formatINRCompact(n.available)}</dd></div>}
                <div className="flex justify-between gap-2"><dt className="text-stone-500 dark:text-gray-400">Committed</dt><dd className="font-medium tabular-nums text-stone-900 dark:text-white">{formatINRCompact(n.committed)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-stone-500 dark:text-gray-400">Utilised</dt><dd className="font-medium tabular-nums text-stone-900 dark:text-white">{formatINRCompact(n.utilised)}</dd></div>
              </dl>
              {n.nodeType !== 'unassigned' && <UtilisationBar figures={n} className="mt-2" />}
            </button>
          </li>
        ))}
      </ul>

      {/* Tablet and up: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px]">
          <caption className="sr-only">Research budget by school and department</caption>
          <thead className="bg-stone-50/70 dark:bg-gray-900/40">
            <tr>
              <th scope="col" className={ui.th}>Unit</th>
              <th scope="col" className={`${ui.th} text-right`}>Allocated</th>
              <th scope="col" className={`${ui.th} text-right`}>Committed</th>
              <th scope="col" className={`${ui.th} text-right`}>Utilised</th>
              <th scope="col" className={`${ui.th} text-right`}>Pending</th>
              <th scope="col" className={`${ui.th} text-right`}>Available</th>
              <th scope="col" className={`${ui.th} w-40`}>Utilisation</th>
              <th scope="col" className={ui.th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
            {rows.map((n) => {
              const key = nodeKey(n);
              const sel = selectedKey === key;
              return (
                <tr key={key} className={sel ? 'bg-rose-50/60 dark:bg-wine/10' : 'hover:bg-stone-50/70 dark:hover:bg-gray-700/30'}>
                  <th scope="row" className={`${ui.td} text-left font-normal`} style={{ paddingLeft: 16 + n.depth * 20 }}>
                    <button
                      type="button"
                      onClick={() => onSelect(n)}
                      className={`text-left hover:text-wine hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:hover:text-amber ${n.depth < 2 ? 'font-semibold text-stone-900 dark:text-white' : 'text-stone-800 dark:text-gray-100'}`}
                    >
                      {n.name}
                    </button>
                    <span className="ml-2 text-xs text-stone-500 dark:text-gray-400">{LEVEL[n.nodeType]}{n.code ? ` · ${n.code}` : ''}</span>
                  </th>
                  <td className={`${ui.td} text-right tabular-nums`}>{n.nodeType === 'unassigned' ? '—' : formatINR(n.allocated)}</td>
                  <td className={`${ui.td} text-right tabular-nums`}>{formatINR(n.committed)}</td>
                  <td className={`${ui.td} text-right tabular-nums`}>{formatINR(n.utilised)}</td>
                  <td className={`${ui.td} text-right tabular-nums text-stone-500 dark:text-gray-400`}>{formatINR(n.pending)}</td>
                  <td className={`${ui.td} text-right font-semibold tabular-nums ${n.available < 0 ? 'text-red-700 dark:text-red-300' : 'text-stone-900 dark:text-white'}`}>{n.nodeType === 'unassigned' ? '—' : formatINR(n.available)}</td>
                  <td className={ui.td}>{n.nodeType === 'unassigned' ? <span className="text-xs text-stone-500 dark:text-gray-400">Not budgeted</span> : <UtilisationBar figures={n} />}</td>
                  <td className={ui.td}><BudgetStatusBadge status={n.status} warnPct={warnPct} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
