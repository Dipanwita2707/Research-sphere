'use client';

import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { dpdpService } from '../../services/dpdp.service';
import { errorMessage, errorStatus, formatDate } from '../../lib/format';
import type { Nominee, NomineeInput } from '../../types';
import { Card, ErrorState, LoadingState, btnPrimary, btnSecondary, inputClass, labelClass } from '../ui';

const empty: NomineeInput = { name: '', email: '', phone: '', relation: '' };

const NomineeCard = forwardRef<HTMLDivElement>(function NomineeCard(_props, ref) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [nominee, setNominee] = useState<Nominee | null>(null);
  const [form, setForm] = useState<NomineeInput>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const n = await dpdpService.getMyNominee();
      setNominee(n);
      setForm(n ? { name: n.name || '', email: n.email || '', phone: n.phone || '', relation: n.relation || '' } : empty);
    } catch (e) {
      if (errorStatus(e) === 404) {
        setNominee(null);
        setForm(empty);
      } else {
        setError(errorMessage(e, 'Could not load your nominee.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Nominee name is required.');
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!form.email?.trim() && !form.phone?.trim()) {
      setFormError('Please give an email or phone number so the nominee can be contacted.');
      return;
    }
    setSaving(true);
    try {
      const payload: NomineeInput = { name: form.name.trim() };
      if (form.email?.trim()) payload.email = form.email.trim();
      if (form.phone?.trim()) payload.phone = form.phone.trim();
      if (form.relation?.trim()) payload.relation = form.relation.trim();
      const saved = await dpdpService.saveMyNominee(payload);
      setNominee(saved);
      toast.success('Nominee saved.');
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save nominee.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: 'Remove nominee?',
      message: 'Nobody will be able to exercise your data rights on your behalf in the event of your death or incapacity.',
      type: 'warning',
      confirmText: 'Remove',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await dpdpService.deleteMyNominee();
      setNominee(null);
      setForm(empty);
      toast.success('Nominee removed.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove nominee.'));
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof NomineeInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div ref={ref} id="nominee" className="scroll-mt-28">
      <Card
        icon={<UserPlus className="h-5 w-5" />}
        title="Nominee"
        description="Someone who can exercise your rights if you die or become incapable (DPDP Act, s. 14)."
      >
        {loading ? (
          <LoadingState label="Loading nominee…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <form onSubmit={handleSave} className="space-y-3" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="nom-name" className={labelClass}>
                  Full name
                </label>
                <input id="nom-name" className={inputClass} value={form.name} onChange={set('name')} required />
              </div>
              <div>
                <label htmlFor="nom-rel" className={labelClass}>
                  Relation
                </label>
                <input id="nom-rel" className={inputClass} value={form.relation || ''} onChange={set('relation')} placeholder="e.g. Spouse, Parent" />
              </div>
              <div>
                <label htmlFor="nom-email" className={labelClass}>
                  Email
                </label>
                <input id="nom-email" type="email" className={inputClass} value={form.email || ''} onChange={set('email')} />
              </div>
              <div>
                <label htmlFor="nom-phone" className={labelClass}>
                  Phone
                </label>
                <input id="nom-phone" type="tel" className={inputClass} value={form.phone || ''} onChange={set('phone')} />
              </div>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {nominee?.updatedAt ? `Last updated ${formatDate(nominee.updatedAt)}` : nominee ? 'Nominee registered' : 'No nominee registered'}
              </p>
              <div className="flex gap-2">
                {nominee && (
                  <button type="button" className={btnSecondary} onClick={handleRemove} disabled={saving}>
                    Remove
                  </button>
                )}
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? 'Saving…' : nominee ? 'Update nominee' : 'Save nominee'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
});

export default NomineeCard;
