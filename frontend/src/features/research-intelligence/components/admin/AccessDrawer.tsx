'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, Loader2, ShieldCheck, Trash2, X } from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import type { RipAccessOverview, RipPermissionKey, RipPreset, RipUserRow } from '../../types';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((k) => b.includes(k));

/** The preset whose capabilities exactly match, if any. */
export const matchPreset = (perms: string[], presets: RipPreset[]) => presets.find((p) => sameSet(p.permissions, perms)) || null;

const errMsg = (e: unknown, fallback: string) => (e as any)?.response?.data?.message || (e as Error)?.message || fallback;

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

interface Props {
  user: RipUserRow;
  overview: RipAccessOverview;
  /** the signed-in admin may hand out "manage access" */
  canGrantManage: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function AccessDrawer({ user, overview, canGrantManage, onClose, onSaved }: Props) {
  const initial = useMemo(() => (user.expired ? [] : user.grantedPermissions), [user]);
  const [perms, setPerms] = useState<RipPermissionKey[]>(initial);
  const [until, setUntil] = useState(user.expiresAt && !user.expired ? user.expiresAt.slice(0, 10) : '');
  const [note, setNote] = useState(user.note || '');
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const activePreset = matchPreset(perms, overview.presets);
  const hasGrant = user.grantedPermissions.length > 0;
  const changed =
    !sameSet(perms, initial) || until !== (user.expiresAt && !user.expired ? user.expiresAt.slice(0, 10) : '') || note !== (user.note || '');
  const today = new Date().toISOString().slice(0, 10);

  const toggle = (key: RipPermissionKey) => setPerms((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      await svc.setUserAccess(user.userId, {
        permissions: perms,
        expiresAt: until ? new Date(`${until}T23:59:59`).toISOString() : null,
        note: note || undefined,
      });
      onSaved(perms.length ? `Access saved for ${user.name}.` : `Access removed for ${user.name}.`);
    } catch (e) {
      setError(errMsg(e, 'Could not save access.'));
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove all Research Intelligence access for ${user.name}?`)) return;
    setBusy('remove');
    setError(null);
    try {
      await svc.removeUserAccess(user.userId);
      onSaved(`Access removed for ${user.name}.`);
    } catch (e) {
      setError(errMsg(e, 'Could not remove access.'));
      setBusy(null);
    }
  };

  const groups = (['Use', 'Manage'] as const).map((g) => ({ group: g, items: overview.capabilities.filter((c) => c.group === g) }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Research Intelligence access for ${user.name}`}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} tabIndex={-1} />
      <aside className="relative flex h-full w-full sm:w-[480px] flex-col bg-white shadow-2xl dark:bg-[#171717]">
        <header className="flex items-start gap-3 border-b border-slate-100 p-5 dark:border-white/10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{initials(user.name)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">{user.name}</h2>
            <p className="truncate text-[13px] text-slate-500">{[user.designation, user.department].filter(Boolean).join(' · ') || user.role}</p>
            <p className="truncate text-xs text-slate-400">{[user.uid, user.email].filter(Boolean).join(' · ')}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10" aria-label="Close panel">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {user.isAdmin ? (
            <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50/70 p-4 text-sm text-brand-800 dark:border-brand-600/30 dark:bg-brand-600/10 dark:text-brand-100">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>Administrators already have full Research Intelligence access in this university. Nothing needs to be granted.</p>
            </div>
          ) : (
            <>
              {user.expired && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>This person&apos;s access ended on {new Date(user.expiresAt!).toLocaleDateString()}. Choose capabilities and save to restore it.</span>
                </div>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Start from a preset</h3>
                <div className="grid grid-cols-2 gap-2">
                  {overview.presets.map((p) => {
                    const on = activePreset?.key === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPerms(p.permissions)}
                        aria-pressed={on}
                        className={`rounded-xl border p-3 text-left transition ${on ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-600/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10'}`}
                      >
                        <span className="flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {p.label}
                          {on && <Check className="h-4 w-4 text-brand-600" />}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">{p.description}</span>
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setPerms([])} className="mt-2 text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
                  Clear all
                </button>
              </section>

              <section>
                <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fine-tune
                  <span className="font-normal normal-case text-slate-400">{activePreset ? `${activePreset.label} preset` : perms.length ? 'Custom' : 'No access'}</span>
                </h3>
                <div className="space-y-4">
                  {groups.map(({ group, items }) => (
                    <div key={group}>
                      <p className="mb-1.5 text-[11px] font-medium text-slate-400">{group === 'Use' ? 'What they can use' : 'What they can manage'}</p>
                      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                        {items.map((c) => {
                          const locked = c.key === 'rip_manage_access' && !canGrantManage;
                          const on = perms.includes(c.key);
                          return (
                            <li key={c.key}>
                              <label className={`flex items-start gap-3 p-3 ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                <input type="checkbox" className="mt-1 h-4 w-4 accent-[#841C43]" checked={on} disabled={locked} onChange={() => toggle(c.key)} />
                                <span>
                                  <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
                                  <span className="block text-xs leading-snug text-slate-500">{locked ? 'Only administrators can give this.' : c.description}</span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <CalendarClock className="h-3.5 w-3.5" /> Access until
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'No end date', value: '' },
                    { label: '30 days', value: addDays(30) },
                    { label: '90 days', value: addDays(90) },
                    { label: '1 year', value: addDays(365) },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => setUntil(o.value)}
                      aria-pressed={until === o.value}
                      className={`rounded-full border px-3 py-1 text-xs ${until === o.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={until}
                    min={today}
                    onChange={(e) => setUntil(e.target.value)}
                    aria-label="Custom end date"
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  />
                </div>
              </section>

              <section>
                <label htmlFor="rip-note" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Note <span className="font-normal normal-case text-slate-400">(optional, only admins see it)</span>
                </label>
                <input
                  id="rip-note"
                  value={note}
                  maxLength={256}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. NAAC report committee"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </section>

              {hasGrant && user.grantedBy && (
                <p className="text-xs text-slate-400">
                  Last changed by {user.grantedBy}
                  {user.updatedAt ? ` on ${new Date(user.updatedAt).toLocaleDateString()}` : ''}.
                </p>
              )}
              {error && (
                <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}
            </>
          )}
        </div>

        {!user.isAdmin && (
          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 dark:border-white/10">
            {hasGrant ? (
              <button type="button" onClick={remove} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10">
                {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove access
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!!busy || !changed}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10"
              >
                {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
