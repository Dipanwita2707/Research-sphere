'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { dpdpService } from '../../services/dpdp.service';
import { emitConsentRequired } from '../../lib/consentEvents';
import SafeMarkdown from '../../lib/SafeMarkdown';
import { errorMessage, formatDate, humanise } from '../../lib/format';
import type { ConsentRecord, MyConsentState, NoticePurpose } from '../../types';
import { Badge, Card, EmptyState, ErrorState, LoadingState, Modal, btnSecondary } from '../ui';

function latestRecord(records: ConsentRecord[], purpose: string, noticeId?: string): ConsentRecord | undefined {
  return records
    .filter((r) => r.purpose === purpose && (!noticeId || r.noticeId === noticeId))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())[0];
}

export default function MyConsentsCard() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [data, setData] = useState<MyConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNotice, setShowNotice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dpdpService.getMyConsents());
    } catch (e) {
      setError(errorMessage(e, 'Could not load your consents.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleWithdraw = async (p: NoticePurpose) => {
    const ok = await confirm({
      title: `Withdraw consent for “${p.label}”?`,
      type: p.required ? 'danger' : 'warning',
      confirmText: 'Withdraw consent',
      message: (
        <div className="space-y-2 text-left">
          <p>
            We will stop processing your personal data for this purpose from now on. Processing that already happened
            before withdrawal remains lawful.
          </p>
          {p.required ? (
            <p className="font-medium text-red-700 dark:text-red-400">
              This purpose is required to provide the service. After withdrawing, you will not be able to keep using
              features that depend on it until you consent again.
            </p>
          ) : (
            <p>Features that depend on this optional purpose will be switched off for you.</p>
          )}
          <p className="text-xs text-gray-500">
            Data we must keep under law (e.g. academic or financial records) may still be retained.
          </p>
        </div>
      ),
    });
    if (!ok) return;
    setBusy(p.key);
    try {
      const next = await dpdpService.withdrawConsent(p.key);
      setData(next);
      toast.success(`Consent for “${p.label}” withdrawn.`);
      if (next?.needsConsent || next?.guardianPending) emitConsentRequired();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not withdraw consent.'));
    } finally {
      setBusy(null);
    }
  };

  const handleGrant = async (p: NoticePurpose) => {
    if (!data?.notice) return;
    setBusy(p.key);
    try {
      const notice = data.notice;
      const decisions = notice.purposes.map((q) => {
        if (q.key === p.key) return { purpose: q.key, granted: true };
        const r = latestRecord(data.records, q.key, notice.id);
        if (restricted.has(q.key)) return { purpose: q.key, granted: false };
        return { purpose: q.key, granted: q.required ? true : !!(r?.granted && !r.withdrawnAt) };
      });
      const next = await dpdpService.submitConsent({ noticeId: notice.id, decisions });
      setData(next);
      toast.success(`Consent for “${p.label}” given.`);
      if (next?.needsConsent || next?.guardianPending) emitConsentRequired();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not update consent.'));
    } finally {
      setBusy(null);
    }
  };

  const notice = data?.notice;
  const restricted = new Set(data?.minorRestrictedPurposes || []);

  return (
    <Card
      icon={<ShieldCheck className="h-5 w-5" />}
      title="My consents"
      description="What you have agreed to, and the option to withdraw at any time (DPDP Act, s. 6)."
      actions={
        notice ? (
          <button type="button" className={btnSecondary} onClick={() => setShowNotice(true)}>
            View privacy notice
          </button>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingState label="Loading your consents…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !notice ? (
        <EmptyState title="No privacy notice published yet" description="Your university has not published a consent notice." />
      ) : (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Notice “{notice.title}” · version {notice.version} · effective {formatDate(notice.effectiveFrom)}
            {data?.isMinor && ' · consent managed with your guardian'}
            {data?.guardianPending && ' · awaiting guardian verification'}
          </p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
            {notice.purposes.map((p) => {
              const rec = latestRecord(data!.records, p.key, notice.id);
              const active = !!(rec?.granted && !rec.withdrawnAt);
              return (
                <li key={p.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{p.label || humanise(p.key)}</span>
                      {p.required && (
                        <Badge className="bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                          Required
                        </Badge>
                      )}
                      {active ? (
                        <Badge className="bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Given
                        </Badge>
                      ) : rec?.withdrawnAt ? (
                        <Badge className="bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800">
                          <XCircle className="h-3 w-3" aria-hidden="true" /> Withdrawn
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700">
                          Not given
                        </Badge>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{p.description}</p>}
                    {rec && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1">
                        {rec.withdrawnAt
                          ? `Withdrawn ${formatDate(rec.withdrawnAt, true)}`
                          : rec.grantedAt
                            ? `Given ${formatDate(rec.grantedAt, true)}${rec.givenBy === 'guardian' ? ' by guardian' : ''}`
                            : null}
                        {rec.guardianEmail && !rec.guardianVerifiedAt && ' · guardian verification pending'}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {active ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                        disabled={busy === p.key}
                        onClick={() => handleWithdraw(p)}
                      >
                        {busy === p.key ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    ) : restricted.has(p.key) ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">Not available under 18</span>
                    ) : !data?.requiresGuardian ? (
                      <button type="button" className={btnSecondary} disabled={busy === p.key} onClick={() => handleGrant(p)}>
                        {busy === p.key ? 'Saving…' : 'Give consent'}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {notice && (
        <Modal open={showNotice} onClose={() => setShowNotice(false)} title={notice.title} description={`Version ${notice.version}`} size="lg">
          <SafeMarkdown content={notice.content} />
        </Modal>
      )}
    </Card>
  );
}
