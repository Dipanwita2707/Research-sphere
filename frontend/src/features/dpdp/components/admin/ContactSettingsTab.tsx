'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { dpdpService } from '../../services/dpdp.service';
import { errorMessage } from '../../lib/format';
import { Card, ErrorState, LoadingState, Toggle, btnPrimary, inputClass, labelClass } from '../ui';

interface FormState {
  dpoName: string;
  dpoEmail: string;
  dpoPhone: string;
  requireGuardianConsentForMinors: boolean;
}

export default function ContactSettingsTab({ platformScope }: { platformScope: boolean }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>({ dpoName: '', dpoEmail: '', dpoPhone: '', requireGuardianConsentForMinors: true });
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await dpdpService.getContact();
      setUniversityName(c.universityName || null);
      setForm({
        dpoName: c.dpoName || '',
        dpoEmail: c.dpoEmail || '',
        dpoPhone: c.dpoPhone || '',
        // GET /dpdp/contact may omit this flag; the database default is true.
        requireGuardianConsentForMinors: c.requireGuardianConsentForMinors !== false,
      });
    } catch (e) {
      setError(errorMessage(e, 'Could not load contact settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (platformScope) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, platformScope]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.dpoEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.dpoEmail.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      const saved = await dpdpService.saveContactSettings({
        dpoName: form.dpoName.trim(),
        dpoEmail: form.dpoEmail.trim(),
        dpoPhone: form.dpoPhone.trim(),
        requireGuardianConsentForMinors: form.requireGuardianConsentForMinors,
      });
      if (saved) {
        setForm({
          dpoName: saved.dpoName || '',
          dpoEmail: saved.dpoEmail || '',
          dpoPhone: saved.dpoPhone || '',
          requireGuardianConsentForMinors: saved.requireGuardianConsentForMinors !== false,
        });
      }
      toast.success('Contact settings saved.');
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save contact settings.'));
    } finally {
      setSaving(false);
    }
  };

  if (platformScope) {
    return (
      <Card title="DPO contact">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          DPO contact details belong to a university. Select a university (impersonate it from the Universities screen) to edit them.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="DPO contact & guardian policy"
      description={`Shown to users in the privacy notice, the consent screen and “Privacy & my data”${universityName ? ` for ${universityName}` : ''}.`}
    >
      {loading ? (
        <LoadingState label="Loading contact settings…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <form onSubmit={save} className="space-y-5 max-w-2xl" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="dpo-name" className={labelClass}>
                Data Protection Officer / grievance officer name
              </label>
              <input id="dpo-name" className={inputClass} value={form.dpoName} maxLength={256} onChange={(e) => setForm((f) => ({ ...f, dpoName: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="dpo-email" className={labelClass}>
                Email
              </label>
              <input id="dpo-email" type="email" className={inputClass} value={form.dpoEmail} maxLength={256} onChange={(e) => setForm((f) => ({ ...f, dpoEmail: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="dpo-phone" className={labelClass}>
                Phone
              </label>
              <input id="dpo-phone" type="tel" className={inputClass} value={form.dpoPhone} maxLength={32} onChange={(e) => setForm((f) => ({ ...f, dpoPhone: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <div>
              <label htmlFor="dpo-guardian" className="text-sm font-medium text-gray-900 dark:text-white">
                Require verifiable guardian consent for users under 18
              </label>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Required by DPDP Act s. 9 unless your institution falls under a notified exemption. When on, minors cannot use the
                platform until their guardian approves by email.
              </p>
            </div>
            <Toggle
              id="dpo-guardian"
              label="Require guardian consent for minors"
              checked={form.requireGuardianConsentForMinors}
              onChange={(v) => setForm((f) => ({ ...f, requireGuardianConsentForMinors: v }))}
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
          <button type="submit" className={btnPrimary} disabled={saving}>
            <Save className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}
    </Card>
  );
}
