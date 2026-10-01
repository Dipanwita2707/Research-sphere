'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Clock, Loader2, Search, ShieldCheck, UserCheck, Users, X } from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import { RIP_ACCESS_QUERY_KEY } from '../../hooks/useRipAccess';
import type { RipAccessFilter, RipAccessOverview, RipUserPage, RipUserRow } from '../../types';
import { AccessDrawer, initials, matchPreset } from './AccessDrawer';

const PAGE_SIZE = 20;
const errMsg = (e: unknown, fallback: string) => (e as any)?.response?.data?.message || (e as Error)?.message || fallback;

const FILTERS: { key: RipAccessFilter; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'with', label: 'Has access' },
  { key: 'without', label: 'No access' },
  { key: 'expired', label: 'Expired' },
];

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number | string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold leading-none text-slate-900 dark:text-white">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function AccessBadge({ row, presetLabel }: { row: RipUserRow; presetLabel: string | null }) {
  if (row.isAdmin) return <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"><ShieldCheck className="h-3 w-3" /> Full access</span>;
  if (row.expired) return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">Expired</span>;
  if (!row.permissions.length) return <span className="text-xs text-slate-400">No access</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{presetLabel || 'Custom'}</span>
      {!presetLabel && <span className="text-xs text-slate-500">{row.permissions.length} of 8</span>}
    </span>
  );
}

export function AccessManager({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [overview, setOverview] = useState<RipAccessOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<RipUserPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const appliedQ = useRef('');
  const [role, setRole] = useState('');
  const [filter, setFilter] = useState<RipAccessFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerUser, setDrawerUser] = useState<RipUserRow | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [bulkPreset, setBulkPreset] = useState('');
  const [bulkUntil, setBulkUntil] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const flash = useCallback((type: 'ok' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4500);
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await svc.getAccessOverview());
    } catch (e) {
      setLoadError(errMsg(e, 'Could not load access settings.'));
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setData(await svc.listAccessUsers({ q: debouncedQ || undefined, role: role || undefined, access: filter, page, pageSize: PAGE_SIZE }));
    } catch (e) {
      flash('error', errMsg(e, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, role, filter, page, flash]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const refreshAll = async () => {
    queryClient.invalidateQueries({ queryKey: RIP_ACCESS_QUERY_KEY });
    await Promise.all([loadOverview(), loadUsers()]);
  };

  const rows = useMemo(() => data?.items ?? [], [data]);
  const selectable = rows.filter((r) => !r.isAdmin);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.userId));
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const presetLabel = useMemo(() => new Map(rows.map((r) => [r.userId, matchPreset(r.permissions, overview?.presets || [])?.label || null])), [rows, overview]);

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

  const runBulk = async (mode: 'add' | 'replace') => {
    const preset = overview?.presets.find((p) => p.key === bulkPreset);
    if (mode === 'add' && !preset) return;
    const ids = [...selected];
    if (mode === 'replace' && !window.confirm(`Remove all Research Intelligence access from ${ids.length} user${ids.length === 1 ? '' : 's'}?`)) return;
    setBulkBusy(true);
    try {
      const r = await svc.bulkUpdateAccess({
        userIds: ids,
        permissions: mode === 'add' ? preset!.permissions : [],
        mode,
        expiresAt: mode === 'add' && bulkUntil ? new Date(`${bulkUntil}T23:59:59`).toISOString() : null,
      });
      flash('ok', mode === 'add' ? `${preset!.label} access given to ${r.updated} user${r.updated === 1 ? '' : 's'}.` : `Access removed for ${r.updated} user${r.updated === 1 ? '' : 's'}.`);
      setSelected(new Set());
      await refreshAll();
    } catch (e) {
      flash('error', errMsg(e, 'Could not update access.'));
    } finally {
      setBulkBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
        <AlertTriangle className="mx-auto h-8 w-8 text-brand-400" />
        <p className="mt-3 text-slate-700 dark:text-slate-200">{loadError}</p>
      </div>
    );
  }
  if (!overview) {
    return (
      <div className="mt-24 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
          <ShieldCheck className="h-6 w-6 text-brand-600" /> Research Intelligence access
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Choose who can use Research Intelligence in your university. Administrators always have full access; everyone else needs access given to them individually.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={UserCheck} label="People with access" value={overview.summary.withAccess} tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Clock} label="Access ended" value={overview.summary.expired} tone="bg-amber-50 text-amber-600" />
        <StatCard icon={ShieldCheck} label="Administrators (full access)" value={overview.summary.admins} tone="bg-brand-50 text-brand-600" />
      </div>

      {message && (
        <div role="status" className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${message.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'}`}>
          {message.type === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-white/10">
          <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-brand-300 dark:border-white/10 dark:bg-white/5">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, employee/student ID or email" aria-label="Search users" className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100" />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <select value={role} onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }} aria-label="Filter by role" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm capitalize text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
            <option value="">All roles</option>
            {overview.roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div role="group" aria-label="Filter by access" className="flex rounded-xl border border-slate-200 p-0.5 dark:border-white/10">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" onClick={() => {
                  setFilter(f.key);
                  setPage(1);
                }} aria-pressed={filter === f.key} className={`rounded-[10px] px-3 py-1.5 text-xs font-medium transition ${filter === f.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
                <th className="w-10 py-3 pl-4">
                  <input type="checkbox" aria-label="Select all on this page" className="h-4 w-4 accent-[#841C43]" checked={allSelected} disabled={!selectable.length} onChange={toggleAll} />
                </th>
                <th className="py-3 pr-3 font-semibold">Person</th>
                <th className="hidden py-3 pr-3 font-semibold sm:table-cell">Role</th>
                <th className="py-3 pr-3 font-semibold">Access</th>
                <th className="hidden py-3 pr-3 font-semibold md:table-cell">Until</th>
                <th className="py-3 pr-4 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 dark:divide-white/5 ${loading ? 'opacity-60' : ''}`}>
              {rows.map((r) => (
                <tr key={r.userId} className={`${selected.has(r.userId) ? 'bg-brand-50/40 dark:bg-brand-600/5' : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'}`}>
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
                    <AccessBadge row={r} presetLabel={presetLabel.get(r.userId) || null} />
                  </td>
                  <td className="hidden whitespace-nowrap py-3 pr-3 text-xs text-slate-500 md:table-cell">{r.isAdmin ? '—' : r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : r.permissions.length ? 'No end date' : '—'}</td>
                  <td className="py-3 pr-4 text-right">
                    <button type="button" onClick={() => setDrawerUser(r)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-white/10 dark:text-slate-200">
                      {r.isAdmin ? 'View' : r.permissions.length || r.expired ? 'Manage' : 'Give access'}
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    {loading ? (
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-600" />
                    ) : (
                      <div className="text-slate-500">
                        <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        <p className="text-sm">No users match these filters.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-white/10">
          <span>{data ? `${data.total.toLocaleString()} user${data.total === 1 ? '' : 's'}` : ''}</span>
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

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#1f1f1f]" role="region" aria-label="Bulk actions">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{selected.size} selected</span>
          <select value={bulkPreset} onChange={(e) => setBulkPreset(e.target.value)} aria-label="Preset to give" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
            <option value="">Choose a preset…</option>
            {overview.presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <input type="date" value={bulkUntil} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setBulkUntil(e.target.value)} aria-label="Access until (optional)" title="Access until (optional)" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
          <button type="button" onClick={() => runBulk('add')} disabled={!bulkPreset || bulkBusy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400">
            {bulkBusy && <Loader2 className="h-4 w-4 animate-spin" />} Give access
          </button>
          <button type="button" onClick={() => runBulk('replace')} disabled={bulkBusy} className="h-9 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10">
            Remove access
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
            await refreshAll();
          }}
        />
      )}
    </div>
  );
}
