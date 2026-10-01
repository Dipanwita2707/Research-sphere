'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Check, Loader2, Pencil, Search, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import { RIP_ACCESS_QUERY_KEY } from '../../hooks/useRipAccess';
import type { RipAccessOverview, RipCandidate, RipGrant, RipPermissionKey } from '../../types';

const shortLabel = (label: string) => label.replace(/^Research Intelligence:\s*/, '');
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

interface Draft {
  userId: string;
  name: string;
  meta: string;
  permissions: RipPermissionKey[];
  expiresAt: string;
  note: string;
}

function CapabilityChecklist({
  capabilities,
  value,
  onChange,
  disabledKeys = [],
}: {
  capabilities: RipAccessOverview['capabilities'];
  value: RipPermissionKey[];
  onChange: (v: RipPermissionKey[]) => void;
  disabledKeys?: RipPermissionKey[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {capabilities.map((c) => {
        const checked = value.includes(c.key);
        const disabled = disabledKeys.includes(c.key);
        return (
          <label
            key={c.key}
            className={`flex gap-2.5 p-2.5 rounded-xl border text-left transition ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${
              checked ? 'border-brand-400 bg-brand-50/70 dark:bg-brand-600/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-[#841C43]"
              checked={checked}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked ? [...value, c.key] : value.filter((k) => k !== c.key))}
            />
            <span>
              <span className="block text-[13px] font-medium text-slate-800 dark:text-slate-100">{shortLabel(c.label)}</span>
              <span className="block text-[11.5px] text-slate-500 leading-snug">{c.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function AccessManager({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [data, setData] = useState<RipAccessOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<RipCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [roleDefaults, setRoleDefaults] = useState<Partial<Record<string, RipPermissionKey[]>>>({});
  const [savingDefaults, setSavingDefaults] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await svc.getAccessOverview();
      setData(d);
      setRoleDefaults(d.settings.roleDefaults || {});
    } catch (e) {
      setLoadError(errMsg(e, 'Could not load access settings.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setCandidates([]);
      return undefined;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setCandidates(await svc.searchAccessCandidates(query.trim()));
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const flash = (type: 'ok' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const edit = (g: { userId: string; name: string; role: string; department: string | null; uid: string }, permissions: RipPermissionKey[], expiresAt?: string | null, note?: string | null) =>
    setDraft({
      userId: g.userId,
      name: g.name,
      meta: [g.role, g.department, g.uid].filter(Boolean).join(' · '),
      permissions,
      expiresAt: expiresAt ? expiresAt.slice(0, 10) : '',
      note: note || '',
    });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await svc.setUserAccess(draft.userId, {
        permissions: draft.permissions,
        expiresAt: draft.expiresAt ? new Date(`${draft.expiresAt}T23:59:59`).toISOString() : null,
        note: draft.note || undefined,
      });
      flash('ok', draft.permissions.length ? `Access updated for ${draft.name}.` : `Access removed for ${draft.name}.`);
      setDraft(null);
      setQuery('');
      queryClient.invalidateQueries({ queryKey: RIP_ACCESS_QUERY_KEY });
      await load();
    } catch (e) {
      flash('error', errMsg(e, 'Could not save access.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: RipGrant) => {
    if (!window.confirm(`Remove all Research Intelligence access granted directly to ${g.name}?`)) return;
    try {
      await svc.removeUserAccess(g.userId);
      flash('ok', `Access removed for ${g.name}.`);
      await load();
    } catch (e) {
      flash('error', errMsg(e, 'Could not remove access.'));
    }
  };

  const saveDefaults = async () => {
    setSavingDefaults(true);
    try {
      const r = await svc.setRoleDefaults(roleDefaults);
      setRoleDefaults(r.roleDefaults);
      flash('ok', 'Role defaults saved.');
      queryClient.invalidateQueries({ queryKey: RIP_ACCESS_QUERY_KEY });
    } catch (e) {
      flash('error', errMsg(e, 'Could not save role defaults.'));
    } finally {
      setSavingDefaults(false);
    }
  };

  const labelOf = useMemo(() => new Map((data?.capabilities || []).map((c) => [c.key, shortLabel(c.label)])), [data]);

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 text-center rounded-2xl border border-slate-200 bg-white dark:bg-white/[0.03] dark:border-white/10">
        <AlertTriangle className="w-8 h-8 mx-auto text-brand-400" />
        <p className="mt-3 text-slate-700 dark:text-slate-200">{loadError}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center mt-24">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const defaultable = data.capabilities.filter((c) => c.roleDefaultable);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600" /> Research Intelligence access
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your university has Research Intelligence{data.settings.enabledAt ? ` since ${new Date(data.settings.enabledAt).toLocaleDateString()}` : ''}. Administrators have full access; everyone else needs access given here.
          </p>
        </div>
      </header>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30'}`}>
          {message.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Give access */}
      <section className="p-5 rounded-2xl border border-slate-200 bg-white dark:bg-white/[0.03] dark:border-white/10">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-brand-600" /> Give someone access
        </h2>
        {!draft ? (
          <div className="mt-3">
            <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white focus-within:border-brand-300 dark:bg-white/5 dark:border-white/10">
              <Search className="w-4 h-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, employee/student ID or email" className="flex-1 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400" />
              {searching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </label>
            {candidates.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                {candidates.map((c) => (
                  <li key={c.userId}>
                    <button
                      type="button"
                      onClick={() => edit(c, c.currentPermissions.length ? c.currentPermissions : ['rip_access_research_gpt'])}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{c.name}</span>
                        <span className="block text-xs text-slate-500 truncate">{[c.role, c.department, c.uid].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{c.currentPermissions.length ? `${c.currentPermissions.length} granted` : 'No access'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && !searching && candidates.length === 0 && <p className="mt-2 text-sm text-slate-500">No matching users.</p>}
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{draft.name}</p>
                <p className="text-xs text-slate-500">{draft.meta}</p>
              </div>
              <button type="button" onClick={() => setDraft(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
            <CapabilityChecklist
              capabilities={data.capabilities}
              value={draft.permissions}
              onChange={(permissions) => setDraft({ ...draft, permissions })}
              disabledKeys={isAdmin ? [] : ['rip_manage_access']}
            />
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1 mb-1"><CalendarClock className="w-3.5 h-3.5" /> Access until (optional)</span>
                <input type="date" value={draft.expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm dark:bg-white/5 dark:border-white/10 dark:text-slate-100" />
              </label>
              <label className="flex-1 min-w-[200px] text-xs text-slate-600 dark:text-slate-400">
                <span className="block mb-1">Note (optional)</span>
                <input value={draft.note} maxLength={256} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. NAAC report committee" className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm dark:bg-white/5 dark:border-white/10 dark:text-slate-100" />
              </label>
              <button type="button" onClick={save} disabled={saving} className="h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {draft.permissions.length ? 'Save access' : 'Remove access'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Current grants */}
      <section className="p-5 rounded-2xl border border-slate-200 bg-white dark:bg-white/[0.03] dark:border-white/10">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-600" /> People with access <span className="text-sm font-normal text-slate-500">({data.grants.length})</span>
        </h2>
        {data.grants.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nobody has been given access individually yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-white/10">
                  <th className="py-2 pr-3 font-semibold">Person</th>
                  <th className="py-2 pr-3 font-semibold">Capabilities</th>
                  <th className="py-2 pr-3 font-semibold">Until</th>
                  <th className="py-2 font-semibold sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {data.grants.map((g) => (
                  <tr key={g.userId} className={g.expired ? 'opacity-60' : ''}>
                    <td className="py-2.5 pr-3 align-top">
                      <span className="block font-medium text-slate-800 dark:text-slate-100">{g.name}</span>
                      <span className="block text-xs text-slate-500">{[g.role, g.department].filter(Boolean).join(' · ')}</span>
                      {g.note && <span className="block text-xs text-slate-400 italic">{g.note}</span>}
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {g.permissions.map((p) => (
                          <span key={p} className="px-2 py-0.5 rounded-full bg-slate-100 text-[11.5px] text-slate-700 dark:bg-white/10 dark:text-slate-300">{labelOf.get(p) || p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 align-top whitespace-nowrap text-xs">
                      {g.expired ? <span className="text-red-600 font-medium">Expired</span> : g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : <span className="text-slate-400">No end date</span>}
                    </td>
                    <td className="py-2.5 align-top text-right whitespace-nowrap">
                      <button type="button" onClick={() => edit(g, g.permissions, g.expired ? null : g.expiresAt, g.note)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => remove(g)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" title="Remove">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Role defaults */}
      <section className="p-5 rounded-2xl border border-slate-200 bg-white dark:bg-white/[0.03] dark:border-white/10">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Role defaults (optional)</h2>
        <p className="mt-1 text-sm text-slate-500">Give a capability to everyone with a role at once — for example, let all faculty use the AI assistant. Leave empty to grant only person by person.</p>
        <div className="mt-4 space-y-4">
          {data.defaultableRoles.map((role) => (
            <div key={role}>
              <p className="mb-2 text-sm font-medium capitalize text-slate-700 dark:text-slate-200">All {role}</p>
              <CapabilityChecklist capabilities={defaultable} value={roleDefaults[role] || []} onChange={(v) => setRoleDefaults({ ...roleDefaults, [role]: v })} />
            </div>
          ))}
        </div>
        <button type="button" onClick={saveDefaults} disabled={savingDefaults} className="mt-4 h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
          {savingDefaults && <Loader2 className="w-4 h-4 animate-spin" />}
          Save role defaults
        </button>
      </section>
    </div>
  );
}
