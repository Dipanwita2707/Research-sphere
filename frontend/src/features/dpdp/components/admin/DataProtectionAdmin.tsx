'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, ClipboardList, FileText, Globe2, LayoutDashboard, Settings2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useDpdpAccess } from '../../hooks/useDpdpAccess';
import type { AdminTab } from '../../types';
import { ErrorState, LoadingState } from '../ui';
import OverviewTab from './OverviewTab';
import RequestsTab from './RequestsTab';
import NoticesTab from './NoticesTab';
import BreachesTab from './BreachesTab';
import RetentionTab from './RetentionTab';
import ContactSettingsTab from './ContactSettingsTab';

export type { AdminTab };

const TABS: Array<{ key: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'requests', label: 'Requests', icon: ClipboardList },
  { key: 'notices', label: 'Notices', icon: FileText },
  { key: 'breaches', label: 'Breaches', icon: ShieldAlert },
  { key: 'retention', label: 'Retention', icon: Archive },
  { key: 'contact', label: 'DPO contact', icon: Settings2 },
];

const IMPERSONATE_KEY = 'superadmin-impersonate-university-id';

function readImpersonation(): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(IMPERSONATE_KEY) : null;
  } catch {
    return null;
  }
}

export default function DataProtectionAdmin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canManage, isSuperadmin, permsLoading, user } = useDpdpAccess();
  const initial = (searchParams?.get('tab') as AdminTab) || 'overview';
  const [tab, setTab] = useState<AdminTab>(TABS.some((t) => t.key === initial) ? initial : 'overview');
  const [impersonating, setImpersonating] = useState<string | null>(null);

  useEffect(() => {
    setImpersonating(readImpersonation());
  }, []);

  const platformScope = isSuperadmin && !impersonating;

  const selectTab = (t: AdminTab) => {
    setTab(t);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', t);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  if (!user || permsLoading) return <LoadingState label="Checking access…" />;
  if (!canManage) {
    return (
      <ErrorState message="You need administrator access or the Data Protection (dpdp_manage) permission to open this page." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-wine/10 dark:bg-wine/20 text-wine dark:text-amber-400">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Data protection</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              DPDP Act 2023 compliance: consent notices, data principal requests, breaches and retention.
            </p>
          </div>
        </div>
      </div>

      {isSuperadmin && (
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            platformScope
              ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300'
          }`}
        >
          <Globe2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          {platformScope
            ? 'Platform scope: requests and breaches of all universities; notices and retention policies you edit here are platform defaults.'
            : 'You are viewing the selected university. Changes apply to that university only.'}
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-gray-800 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <div role="tablist" aria-label="Data protection sections" className="flex gap-1 min-w-max">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                id={`dpdp-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`dpdp-panel-${key}`}
                onClick={() => selectTab(key)}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-wine text-wine dark:border-amber-400 dark:text-amber-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`dpdp-panel-${tab}`} aria-labelledby={`dpdp-tab-${tab}`}>
        {tab === 'overview' && <OverviewTab onNavigate={selectTab} />}
        {tab === 'requests' && <RequestsTab />}
        {tab === 'notices' && <NoticesTab platformScope={platformScope} />}
        {tab === 'breaches' && <BreachesTab />}
        {tab === 'retention' && <RetentionTab platformScope={platformScope} />}
        {tab === 'contact' && <ContactSettingsTab platformScope={platformScope} />}
      </div>
    </div>
  );
}
