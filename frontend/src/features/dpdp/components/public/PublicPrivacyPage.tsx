'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Mail, Phone, UserCircle2 } from 'lucide-react';
import { dpdpService } from '../../services/dpdp.service';
import SafeMarkdown from '../../lib/SafeMarkdown';
import { errorMessage, errorStatus, formatDate } from '../../lib/format';
import type { PublicPrivacy } from '../../types';
import { Badge, ErrorState, LoadingState } from '../ui';
import PublicShell from './PublicShell';

export default function PublicPrivacyPage({ universitySlug }: { universitySlug: string }) {
  const [data, setData] = useState<PublicPrivacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setData(await dpdpService.getPublicPrivacy(universitySlug));
    } catch (e) {
      const missing = errorStatus(e) === 404;
      setNotFound(missing);
      setError(missing ? 'We could not find a university at this address.' : errorMessage(e, 'Could not load the privacy notice.'));
    } finally {
      setLoading(false);
    }
  }, [universitySlug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data?.universityName) document.title = `Privacy notice · ${data.universityName}`;
  }, [data?.universityName]);

  return (
    <PublicShell>
      {loading ? (
        <LoadingState label="Loading privacy notice…" />
      ) : error ? (
        <ErrorState message={error} onRetry={notFound ? undefined : load} />
      ) : data ? (
        <article className="space-y-8">
          <header className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-wine/10 text-wine dark:text-amber-400">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-wine dark:text-amber-400">{data.universityName}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {data.notice?.title || 'Privacy notice'}
              </h1>
              {data.notice && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Version {data.notice.version} · effective {formatDate(data.notice.effectiveFrom)}
                </p>
              )}
            </div>
          </header>

          {data.notice ? (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-8 shadow-sm">
              <SafeMarkdown content={data.notice.content} className="text-[15px]" />
            </section>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">This university has not published a privacy notice yet.</p>
          )}

          {!!data.notice?.purposes?.length && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Purposes of processing</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.notice.purposes.map((p) => (
                  <li key={p.key} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{p.label}</span>
                      <Badge
                        className={
                          p.required
                            ? 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
                            : 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800'
                        }
                      >
                        {p.required ? 'Required' : 'Optional'}
                      </Badge>
                    </div>
                    {p.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{p.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Contact & grievances</h2>
            {data.dpo?.name || data.dpo?.email || data.dpo?.phone ? (
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                {data.dpo.name && (
                  <li className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-gray-400" aria-hidden="true" /> {data.dpo.name} (Data Protection Officer)
                  </li>
                )}
                {data.dpo.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    <a className="text-wine dark:text-amber-400 hover:underline break-all" href={`mailto:${data.dpo.email}`}>
                      {data.dpo.email}
                    </a>
                  </li>
                )}
                {data.dpo.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    <a className="hover:underline" href={`tel:${data.dpo.phone}`}>
                      {data.dpo.phone}
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Contact details for the Data Protection Officer have not been published yet.</p>
            )}
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              You can withdraw consent, and request access, correction or erasure of your personal data at any time from
              “Privacy &amp; my data” after signing in. If your grievance is not resolved, you may complain to the{' '}
              <strong>Data Protection Board of India</strong>.
            </p>
          </section>
        </article>
      ) : null}
    </PublicShell>
  );
}
