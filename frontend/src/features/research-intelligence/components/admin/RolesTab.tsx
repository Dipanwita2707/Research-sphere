'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, ExternalLink, KeyRound, Loader2, Plus, Users } from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import type { RipAccessOverview, RipRole } from '../../types';
import { errMsg, labelsFor } from './accessUtils';

interface Props {
  overview: RipAccessOverview;
  isAdmin: boolean;
  onCreated: (role: RipRole, created: boolean) => void;
  onError: (message: string) => void;
  onSeePeople: (role: RipRole) => void;
}

function CapabilityChips({ labels, max = 4 }: { labels: string[]; max?: number }) {
  const shown = labels.slice(0, max);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((l) => (
        <span key={l} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
          {l}
        </span>
      ))}
      {labels.length > max && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] text-slate-500 dark:bg-white/10">+{labels.length - max} more</span>}
    </div>
  );
}

export function RolesTab({ overview, isAdmin, onCreated, onError, onSeePeople }: Props) {
  const [creating, setCreating] = useState<string | null>(null);
  const missing = overview.templates.filter((t) => !t.existingRoleId);

  const create = async (key: string) => {
    setCreating(key);
    try {
      const r = await svc.createRoleFromTemplate(key);
      onCreated(r.role, r.created);
    } catch (e) {
      onError(errMsg(e, 'Could not create the role.'));
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-300">
        <p className="max-w-2xl">
          <strong className="font-semibold text-slate-800 dark:text-slate-100">Roles</strong> are reusable permission templates. Create one once, then give it to as many people as you like on the <em>People</em> tab. To change what a role includes, edit it on the Roles page; everyone who holds it is updated.
        </p>
        {isAdmin && (
          <Link href="/admin/roles" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            Open Roles page <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Your Research Intelligence roles</h2>
        {overview.roles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-white/15">
            <KeyRound className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">No Research Intelligence roles yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{isAdmin ? 'Start from a template below. You can rename and adjust the role afterwards on the Roles page.' : 'Ask an administrator to create one.'}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {overview.roles.map((r) => (
              <article key={r.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{r.name}</h3>
                    {r.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{r.description}</p>}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                    <Users className="h-3 w-3" /> {r.assignedCount}
                  </span>
                </div>
                <div className="mt-3">
                  <CapabilityChips labels={labelsFor(r.permissions, overview.capabilities)} />
                </div>
                {!r.assignable && (
                  <p className="mt-3 flex gap-1.5 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    This role also includes {r.otherPermissionCount} other permission{r.otherPermissionCount === 1 ? '' : 's'}, so it is assigned from the Roles page, not here.
                  </p>
                )}
                <div className="mt-4 flex items-center gap-2 pt-1">
                  {r.assignable && (
                    <button type="button" onClick={() => onSeePeople(r)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-wine-fg hover:bg-brand-700">
                      {r.assignedCount ? 'See people' : 'Assign people'}
                    </button>
                  )}
                  {isAdmin && (
                    <Link href="/admin/roles" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
                      Edit role <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isAdmin && missing.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Start from a template</h2>
          <p className="mb-3 text-xs text-slate-500">Each button creates a normal role in your university that you can rename or change later.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overview.templates.map((t) => (
              <div key={t.key} className="flex flex-col rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.label}</h3>
                <p className="mt-1 flex-1 text-xs leading-snug text-slate-500">{t.description}</p>
                <div className="mt-3">
                  <CapabilityChips labels={labelsFor(t.permissions, overview.capabilities)} max={3} />
                </div>
                {t.existingRoleId ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> Role exists
                  </p>
                ) : (
                  <button type="button" onClick={() => create(t.key)} disabled={!!creating} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-60 dark:border-white/10 dark:text-slate-200">
                    {creating === t.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create role
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
