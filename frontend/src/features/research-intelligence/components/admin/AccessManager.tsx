'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, KeyRound, Loader2, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import { RIP_ACCESS_QUERY_KEY } from '../../hooks/useRipAccess';
import type { RipAccessOverview, RipRole } from '../../types';
import { PeopleTab } from './PeopleTab';
import { RolesTab } from './RolesTab';
import { errMsg } from './accessUtils';

type Tab = 'roles' | 'people';

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

/** Research Intelligence access: reusable role templates, assigned to people. */
export function AccessManager({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [overview, setOverview] = useState<RipAccessOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('people');
  const [roleFilter, setRoleFilter] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const flash = useCallback((type: 'ok' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4500);
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const o = await svc.getAccessOverview();
      setOverview(o);
      return o;
    } catch (e) {
      setLoadError(errMsg(e, 'Could not load access settings.'));
      return null;
    }
  }, []);

  // First visit with no roles yet: open the tab where the work is.
  useEffect(() => {
    loadOverview().then((o) => {
      if (o && o.roles.length === 0) setTab('roles');
    });
  }, [loadOverview]);

  const changed = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: RIP_ACCESS_QUERY_KEY });
    await loadOverview();
  }, [queryClient, loadOverview]);

  const seePeople = (role: RipRole) => {
    setRoleFilter(role.id);
    setTab('people');
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

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'people', label: 'People', count: overview.summary.assigned },
    { key: 'roles', label: 'Roles', count: overview.roles.length },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
          <ShieldCheck className="h-6 w-6 text-brand-600" /> Research Intelligence access
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Access works like the rest of your permissions: a role holds what people can do, and you give the role to employees. Administrators always have full access.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={KeyRound} label="Research Intelligence roles" value={overview.roles.length} tone="bg-brand-50 text-brand-600" />
        <StatCard icon={UserCheck} label="Role assignments" value={overview.summary.assigned} tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Users} label="People with extra access" value={overview.summary.extraGrants} tone="bg-sky-50 text-sky-600" />
      </div>

      {message && (
        <div role="status" className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${message.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'}`}>
          {message.type === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div role="tablist" aria-label="Access sections" className="flex gap-1 border-b border-slate-200 dark:border-white/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {t.label}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'roles' ? (
        <RolesTab
          overview={overview}
          isAdmin={isAdmin}
          onCreated={(role, created) => {
            flash('ok', created ? `Role "${role.name}" created. Now assign it to people.` : `"${role.name}" already exists.`);
            changed();
          }}
          onError={(m) => flash('error', m)}
          onSeePeople={seePeople}
        />
      ) : (
        <PeopleTab overview={overview} isAdmin={isAdmin} roleFilter={roleFilter} onRoleFilterChange={setRoleFilter} onChanged={async () => void (await changed())} flash={flash} />
      )}
    </div>
  );
}
