'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { dpdpService } from '../../services/dpdp.service';
import { errorMessage, errorStatus, humanise } from '../../lib/format';
import type { GuardianConsentInfo } from '../../types';
import { ErrorState, LoadingState, btnPrimary, btnSecondary } from '../ui';
import PublicShell from './PublicShell';

type Outcome = null | 'approved' | 'declined';

export default function GuardianConsentPage({ token }: { token: string }) {
  const [info, setInfo] = useState<GuardianConsentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState<null | 'approve' | 'decline'>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await dpdpService.getGuardianConsent(token));
    } catch (e) {
      const status = errorStatus(e);
      const invalid = status === 404 || status === 410 || status === 400;
      setRetryable(!invalid);
      setError(invalid ? 'This verification link is invalid or has expired. Ask the student to send a new one.' : errorMessage(e, 'Could not load this request.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (approve: boolean) => {
    setActionError(null);
    setSubmitting(approve ? 'approve' : 'decline');
    try {
      const res = await dpdpService.respondGuardianConsent(token, approve);
      setOutcome(approve && res?.verified !== false ? 'approved' : 'declined');
    } catch (e) {
      setActionError(errorMessage(e, 'Could not record your response. Please try again.'));
    } finally {
      setSubmitting(null);
    }
  };

  const purposes = (info?.purposes || []).map((p) =>
    typeof p === 'string' ? { key: p, label: humanise(p), description: '', required: false } : p,
  );

  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto">
        {loading ? (
          <LoadingState label="Loading consent request…" />
        ) : error ? (
          <ErrorState message={error} onRetry={retryable ? load : undefined} />
        ) : outcome || info?.alreadyVerified ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 text-center shadow-sm" role="status">
            {outcome === 'declined' ? (
              <>
                <XCircle className="h-12 w-12 text-red-500 mx-auto" aria-hidden="true" />
                <h1 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">Consent declined</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  We have recorded that you do not give consent. {info?.studentName || 'The student'} will not be able to use
                  features that require it. You can contact the university if you change your mind.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" aria-hidden="true" />
                <h1 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">
                  {outcome === 'approved' ? 'Thank you — consent verified' : 'Already verified'}
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {info?.studentName || 'The student'} can now continue using {info?.universityName || 'the platform'}. You may
                  close this page.
                </p>
              </>
            )}
          </div>
        ) : info ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <div className="p-5 sm:p-8 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-wine/10 text-wine dark:text-amber-400">
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Parent / guardian consent</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <strong className="text-gray-900 dark:text-white">{info.studentName}</strong> has named you as their parent
                    or guardian at <strong className="text-gray-900 dark:text-white">{info.universityName}</strong>. Because
                    they are under 18, the Digital Personal Data Protection Act, 2023 requires your verifiable consent before
                    their personal data is processed.
                  </p>
                </div>
              </div>

              {purposes.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Your consent covers these purposes</h2>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
                    {purposes.map((p) => (
                      <li key={p.key} className="p-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {p.label}
                          {p.required ? <span className="ml-2 text-xs font-normal text-gray-500">(required for the service)</span> : null}
                        </p>
                        {p.description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{p.description}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-wine focus:ring-wine"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I confirm that I am the parent or lawful guardian of {info.studentName} and that I am an adult. I understand
                  I can withdraw this consent later by contacting the university.
                </span>
              </label>

              {actionError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {actionError}
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-8 py-4 border-t border-gray-100 dark:border-gray-800">
              <button type="button" className={btnSecondary} disabled={!!submitting} onClick={() => respond(false)}>
                {submitting === 'decline' ? 'Declining…' : 'Decline'}
              </button>
              <button type="button" className={btnPrimary} disabled={!!submitting || !confirmed} onClick={() => respond(true)}>
                {submitting === 'approve' ? 'Approving…' : 'Approve consent'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}
