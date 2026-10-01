'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldCheck, Users, X } from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import type { RipAccessFilter, RipAccessOverview, RipUserPage, RipUserRow } from '../../types';
import { AccessDrawer } from './AccessDrawer';
import { errMsg, initials } from './accessUtils';

const PAGE_SIZE = 20;

const FILTERS: { key: RipAccessFilter; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'with', label: 'Has access' },
  { key: 'without', label: 'No access' },
  { key: 'expired', label: 'Extra ended' },
];

interface Props {
  overview: RipAccessOverview;
  isAdmin: boolean;
  roleFilter: string;
  onRoleFilterChange: (id: string) => void;
  /** call after any change so counts and lists refresh */
  onChanged: () => Promise<void> | void;
  flash: (type: 'ok' | 'error', text: string) => void;
}

function RoleChips({ row }: { row: RipUserRow }) {
  if (row.isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
        <ShieldCheck className="h-3 w-3" /> Administrator
      </span>
    );
  }
  const hasExtra = !!row.extra && !row.extra.expired;
  if (!row.roles.length && !hasExtra) return <span className="text-xs text-slate-400">{row.extra?.expired ? 'Extra access ended' : 'No access'}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {row.roles.map((r) => (
        <span key={r.id} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {r.name.replace(/^Research Intelligence\s*[–-]\s*/, '')}
        </span>
      ))}
      {hasExtra && <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">+ extra</span>}
    </span>
  );
}

export function PeopleTab({ overview, isAdmin, roleFilter, onRoleFilterChange, onChanged, flash }: Props) {
  const [data, setData] = useState<RipUserPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const appliedQ = useRef('');
  const [empType, setEmpType] = useState('');
  const [filter, setFilter] = useState<RipAccessFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerUser, setDrawerUser] = useState<RipUserRow | null>(null);
  const [bulkRole, setBulkRole] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const assignable = useMemo(() => overview.roles.filter((r) => r.assignable), [overview.roles]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setData(await svc.listAccessUsers({ q: debouncedQ || undefined, role: empType || undefined, roleId: roleFilter || undefined, access: filter, page, pageSize: PAGE_SIZE }));
    } catch (e) {
      flash('error', errMsg(e, 'Could not load people.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, empType, roleFilter, filter, page, flash]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim().length >= 2 ? q.trim() : '';
      if (appliedQ.current !== next) {
        appliedQ.current = next;
        setDebouncedQ(next);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const selectable = rows.filter((r) => !r.isAdmin);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.userId));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const toggleRow = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) selectable.forEach((r) => n.delete(r.userId));
      else selectable.forEach((r) => n.add(r.userId));
      return n;
    });

  const refresh = async () => {
    await Promise.all([onChanged(), loadUsers()]);
  };

  const runBulk = async (mode: 'add' | 'remove') => {
    const role = assignable.find((r) => r.id === bulkRole);
    if (!role) return;
    setBulkBusy(true);
    try {
      const r = await svc.bulkRoles({ userIds: [...selected], roleId: role.id, mode });
      flash('ok', mode === 'add' ? `"${role.name}" given to ${r.updated} ${r.updated === 1 ? 'person' : 'people'}.` : `"${role.name}" removed from ${r.updated} ${r.updated === 1 ? 'person' : 'people'}.`);
      setSelected(new Set());
      await refresh();
    } catch (e) {
      flash('error', errMsg(e, 'Could not update roles.'));
    } finally {
      setBulkBusy(false);
    }
  };

  const activeRole = overview.roles.find((r) => r.id === roleFilter);

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-white/10">
          <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-brand-300 dark:border-white/10 dark:bg-white/5">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, employee/student ID or email" aria-label="Search people" className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100" />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <select
            value={roleFilter}
            onChange={(e) => {
              onRoleFilterChange(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by role held"
            className="h-10 max-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          >
            <option value="">Any role</option>
            {assignable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={empType}
            onChange={(e) => {
              setEmpType(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by type of user"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm capitalize text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          >
            <option value="">All users</option>
            {overview.filterRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div role="group" aria-label="Filter by access" className="flex rounded-xl border border-slate-200 p-0.5 dark:border-white/10">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFilter(f.key);
                  setPage(1);
                }}
                aria-pressed={filter === f.key}
                className={`rounded-[10px] px-3 py-1.5 text-xs font-medium transition ${filter === f.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {activeRole && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-brand-50/50 px-4 py-2 text-xs text-brand-800 dark:border-white/10 dark:bg-brand-600/10 dark:text-brand-100">
            <span>
              Showing people who hold <strong>{activeRole.name}</strong>
            </span>
            <button type="button" onClick={() => onRoleFilterChange('')} className="underline-offset-2 hover:underline">
              Show everyone
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                <th className="w-10 py-3 pl-4">
                  <input type="checkbox" aria-label="Select all on this page" className="h-4 w-4 accent-[#841C43]" checked={allSelected} disabled={!selectable.length} onChange={toggleAll} />
                </th>
                <th className="py-3 pr-3 font-semibold">Person</th>
                <th className="hidden py-3 pr-3 font-semibold sm:table-cell">Type</th>
                <th className="py-3 pr-3 font-semibold">Access from</th>
                <th className="py-3 pr-4 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 dark:divide-white/5 ${loading ? 'opacity-60' : ''}`}>
              {rows.map((r) => (
                <tr key={r.userId} className={selected.has(r.userId) ? 'bg-brand-50/40 dark:bg-brand-600/5' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'}>
                  <td className="py-3 pl-4">
                    <input type="checkbox" aria-label={`Select ${r.name}`} className="h-4 w-4 accent-[#841C43] disabled:opacity-30" checked={selected.has(r.userId)} disabled={r.isAdmin} onChange={() => toggleRow(r.userId)} />
                  </td>
                  <td className="py-3 pr-3">
                    <button type="button" onClick={() => setDrawerUser(r)} className="flex items-center gap-3 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{initials(r.name)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800 hover:text-brand-700 dark:text-slate-100">{r.name}</span>
                        <span className="block truncate text-xs text-slate-500">{[r.department, r.uid].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  </td>
                  <td className="hidden py-3 pr-3 capitalize text-slate-600 dark:text-slate-300 sm:table-cell">{r.role}</td>
                  <td className="py-3 pr-3">
                    <RoleChips row={r} />
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <button type="button" onClick={() => setDrawerUser(r)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-white/10 dark:text-slate-200">
                      {r.isAdmin ? 'View' : r.roles.length || r.extra ? 'Manage' : 'Give access'}
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    {loading ? (
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-600" />
                    ) : (
                      <div className="text-slate-500">
                        <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        <p className="text-sm">No one matches these filters.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-white/10">
          <span>{data ? `${data.total.toLocaleString()} ${data.total === 1 ? 'person' : 'people'}` : ''}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} aria-label="Previous page" className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} aria-label="Next page" className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#1f1f1f]" role="region" aria-label="Bulk actions">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{selected.size} selected</span>
          <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} aria-label="Role to add or remove" className="h-9 min-w-[200px] rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
            <option value="">Choose a role…</option>
            {assignable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => runBulk('add')} disabled={!bulkRole || bulkBusy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400">
            {bulkBusy && <Loader2 className="h-4 w-4 animate-spin" />} Give role
          </button>
          <button type="button" onClick={() => runBulk('remove')} disabled={!bulkRole || bulkBusy} className="h-9 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10">
            Remove role
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Clear selection">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {drawerUser && (
        <AccessDrawer
          user={drawerUser}
          overview={overview}
          canGrantManage={isAdmin}
          onClose={() => setDrawerUser(null)}
          onSaved={async (text) => {
            setDrawerUser(null);
            flash('ok', text);
            await refresh();
          }}
        />
      )}
    </>
  );
}
