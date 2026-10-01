'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, ChevronDown, Loader2, ShieldCheck, X } from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import type { RipAccessOverview, RipPermissionKey, RipUserRow } from '../../types';
import { addDays, errMsg, fmtDate, initials, labelsFor } from './accessUtils';

interface Props {
  user: RipUserRow;
  overview: RipAccessOverview;
  /** the signed-in admin may hand out "manage access" as an extra */
  canGrantManage: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((k) => b.includes(k));

export function AccessDrawer({ user, overview, canGrantManage, onClose, onSaved }: Props) {
  const assignable = useMemo(() => overview.roles.filter((r) => r.assignable), [overview.roles]);
  const heldAssignable = useMemo(() => user.roles.filter((r) => r.assignable).map((r) => r.id), [user.roles]);
  const heldOther = useMemo(() => overview.roles.filter((r) => !r.assignable && user.roles.some((h) => h.id === r.id)), [overview.roles, user.roles]);

  const initialExtra = useMemo<RipPermissionKey[]>(() => (user.extra && !user.extra.expired ? user.extra.permissions : []), [user.extra]);
  const initialUntil = user.extra && !user.extra.expired && user.extra.expiresAt ? user.extra.expiresAt.slice(0, 10) : '';

  const [roleIds, setRoleIds] = useState<string[]>(heldAssignable);
  const [extra, setExtra] = useState<RipPermissionKey[]>(initialExtra);
  const [until, setUntil] = useState(initialUntil);
  const [note, setNote] = useState(user.extra?.note || '');
  const [extraOpen, setExtraOpen] = useState(initialExtra.length > 0 || !!user.extra?.expired);
  const [busy, setBusy] = useState(false);
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

  const rolesChanged = !sameSet(roleIds, heldAssignable);
  const extraChanged = !sameSet(extra, initialExtra) || until !== initialUntil || note !== (user.extra?.note || '');
  const changed = rolesChanged || extraChanged;
  const today = new Date().toISOString().slice(0, 10);

  // What the person will be able to do once saved.
  const effective = useMemo(() => {
    const keys = new Set<RipPermissionKey>(extra);
    overview.roles.forEach((r) => {
      if (roleIds.includes(r.id) || heldOther.some((h) => h.id === r.id)) r.permissions.forEach((k) => keys.add(k));
    });
    return labelsFor([...keys], overview.capabilities);
  }, [extra, roleIds, heldOther, overview]);

  const toggleRole = (id: string) => setRoleIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const toggleExtra = (k: RipPermissionKey) => setExtra((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (rolesChanged) await svc.setUserRoles(user.userId, roleIds);
      if (extraChanged) {
        await svc.setUserAccess(user.userId, {
          permissions: extra,
          expiresAt: extra.length && until ? new Date(`${until}T23:59:59`).toISOString() : null,
          note: extra.length ? note || undefined : undefined,
        });
      }
      onSaved(`Access updated for ${user.name}.`);
    } catch (e) {
      setError(errMsg(e, 'Could not save changes.'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Research Intelligence access for ${user.name}`}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} tabIndex={-1} />
      <aside className="relative flex h-full w-full flex-col bg-white shadow-2xl dark:bg-[#171717] sm:w-[480px]">
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
              <p>Administrators already have full Research Intelligence access. No role is needed.</p>
            </div>
          ) : (
            <>
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</h3>
                <p className="mb-3 text-xs text-slate-500">Tick the roles this person should hold. Roles are shared templates, so changing a role later updates everyone who holds it.</p>
                {assignable.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/15">No assignable roles yet. Create one on the Roles tab first.</p>
                ) : (
                  <ul className="space-y-2">
                    {assignable.map((r) => {
                      const on = roleIds.includes(r.id);
                      return (
                        <li key={r.id}>
                          <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${on ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:bg-brand-600/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10'}`}>
                            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#841C43]" checked={on} onChange={() => toggleRole(r.id)} />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{r.name}</span>
                              <span className="mt-0.5 block text-xs leading-snug text-slate-500">{labelsFor(r.permissions, overview.capabilities).join(' · ')}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {heldOther.length > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    Also holds {heldOther.map((r) => r.name).join(', ')} (managed on the Roles page).
                  </p>
                )}
              </section>

              <section className="rounded-xl bg-slate-50 p-4 dark:bg-white/[0.04]">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">After saving, they can</h3>
                {effective.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {effective.map((l) => (
                      <li key={l} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">
                        {l}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Nothing: they will not see Research Intelligence.</p>
                )}
              </section>

              <section>
                <button type="button" onClick={() => setExtraOpen((o) => !o)} aria-expanded={extraOpen} className="flex w-full items-center justify-between text-left">
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Extra access for this person</span>
                    <span className="block text-xs text-slate-400">For exceptions or time-limited access. Prefer roles.</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${extraOpen ? 'rotate-180' : ''}`} />
                </button>
                {extraOpen && (
                  <div className="mt-3 space-y-4">
                    {user.extra?.expired && (
                      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Their extra access ended on {fmtDate(user.extra.expiresAt)}.</span>
                      </div>
                    )}
                    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/5 dark:border-white/10">
                      {overview.capabilities.map((c) => {
                        const locked = c.key === 'rip_manage_access' && !canGrantManage;
                        return (
                          <li key={c.key}>
                            <label className={`flex items-start gap-3 p-3 ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#841C43]" checked={extra.includes(c.key)} disabled={locked} onChange={() => toggleExtra(c.key)} />
                              <span>
                                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
                                <span className="block text-xs leading-snug text-slate-500">{locked ? 'Only administrators can give this.' : c.description}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    {extra.length > 0 && (
                      <>
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <CalendarClock className="h-3.5 w-3.5" /> Extra access until
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {[
                              { label: 'No end date', value: '' },
                              { label: '30 days', value: addDays(30) },
                              { label: '90 days', value: addDays(90) },
                              { label: '1 year', value: addDays(365) },
                            ].map((o) => (
                              <button key={o.label} type="button" onClick={() => setUntil(o.value)} aria-pressed={until === o.value} className={`rounded-full border px-3 py-1 text-xs ${until === o.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300'}`}>
                                {o.label}
                              </button>
                            ))}
                            <input type="date" value={until} min={today} onChange={(e) => setUntil(e.target.value)} aria-label="Custom end date" className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
                          </div>
                        </div>
                        <label className="block text-xs font-medium text-slate-500">
                          Note (only admins see it)
                          <input value={note} maxLength={256} onChange={(e) => setNote(e.target.value)} placeholder="e.g. NAAC report committee" className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal dark:border-white/10 dark:bg-white/5 dark:text-slate-100" />
                        </label>
                        <button type="button" onClick={() => { setExtra([]); setUntil(''); setNote(''); }} className="text-xs text-red-600 hover:underline">
                          Remove all extra access
                        </button>
                      </>
                    )}
                  </div>
                )}
              </section>

              {error && (
                <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}
            </>
          )}
        </div>

        {!user.isAdmin && (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-white/10">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy || !changed} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
