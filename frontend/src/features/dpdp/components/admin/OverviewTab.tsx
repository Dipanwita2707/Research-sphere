'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlarmClock, AlertTriangle, ClipboardList, FileText, ShieldAlert, Users } from 'lucide-react';
import { dpdpService } from '../../services/dpdp.service';
import { errorMessage } from '../../lib/format';
import type { AdminTab, DpdpOverview } from '../../types';
import { Card, ErrorState, LoadingState, StatCard, btnSecondary } from '../ui';

export default function OverviewTab({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const [data, setData] = useState<DpdpOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dpdpService.getOverview());
    } catch (e) {
      setError(errorMessage(e, 'Could not load the overview.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading overview…" />;
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={load} />;

  const { users, consented } = data.consentCoverage || { users: 0, consented: 0 };
  const pct = users > 0 ? Math.round((consented / users) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Open requests" value={data.openRequests} icon={<ClipboardList className="h-4 w-4" />} hint="Submitted or in review" />
        <StatCard
          label="Overdue requests"
          value={data.overdueRequests}
          tone={data.overdueRequests > 0 ? 'danger' : 'success'}
          icon={<AlarmClock className="h-4 w-4" />}
          hint="Past their due date"
        />
        <StatCard
          label="Open breaches"
          value={data.openBreaches}
          tone={data.openBreaches > 0 ? 'warning' : 'success'}
          icon={<ShieldAlert className="h-4 w-4" />}
          hint="Not yet closed"
        />
        <StatCard
          label="Board report due < 24h"
          value={data.breachesDueSoon}
          tone={data.breachesDueSoon > 0 ? 'danger' : 'success'}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="72-hour intimation window"
        />
        <StatCard
          label="Consent coverage"
          value={`${pct}%`}
          icon={<Users className="h-4 w-4" />}
          tone={pct >= 90 ? 'success' : pct >= 50 ? 'warning' : 'danger'}
          hint={`${consented.toLocaleString('en-IN')} of ${users.toLocaleString('en-IN')} active users`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card icon={<FileText className="h-5 w-5" />} title="Active privacy notice">
          {data.activeNotice ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900 dark:text-white">{data.activeNotice.title}</p>
              <p className="text-gray-600 dark:text-gray-400">
                Version {data.activeNotice.version}
                {data.activeNotice.isPlatformDefault ? ' · platform default (your university has not published its own)' : ''}
              </p>
              <div
                className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Consent coverage"
              >
                <div className="h-full bg-wine" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{pct}% of active users have accepted the required purposes of this version.</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">No notice is active. Users are not being asked for consent.</p>
          )}
          <button type="button" className={`${btnSecondary} mt-4`} onClick={() => onNavigate('notices')}>
            Manage notices
          </button>
        </Card>
        <Card icon={<AlarmClock className="h-5 w-5" />} title="What needs attention">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-gray-700 dark:text-gray-300">Overdue data principal requests</span>
              <button type="button" className="text-wine dark:text-amber-400 hover:underline" onClick={() => onNavigate('requests')}>
                {data.overdueRequests} → review
              </button>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-gray-700 dark:text-gray-300">Breaches needing Board intimation within 24h</span>
              <button type="button" className="text-wine dark:text-amber-400 hover:underline" onClick={() => onNavigate('breaches')}>
                {data.breachesDueSoon} → open register
              </button>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-gray-700 dark:text-gray-300">Users who still need to consent</span>
              <span className="text-gray-900 dark:text-white font-medium">{Math.max(users - consented, 0).toLocaleString('en-IN')}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
