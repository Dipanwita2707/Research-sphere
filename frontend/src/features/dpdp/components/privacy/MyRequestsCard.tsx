'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { dpdpService } from '../../services/dpdp.service';
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  REQUEST_TYPE_HELP,
  REQUEST_TYPE_LABELS,
  errorMessage,
  formatDate,
  humanise,
} from '../../lib/format';
import type { DataPrincipalRequest, RequestType } from '../../types';
import { Badge, Card, EmptyState, ErrorState, LoadingState, Modal, btnPrimary, btnSecondary, inputClass, labelClass } from '../ui';

const REQUEST_TYPES: RequestType[] = ['access', 'correction', 'erasure', 'grievance', 'consent_withdrawal', 'nomination'];

/**
 * Profile fields a correction request can change (mirrors CORRECTABLE_FIELDS in
 * backend/src/modules/dpdp/dpdp.constants.js). Sign-in email/UID, results and roles
 * are changed by admins through the normal screens, so they are not offered here.
 */
export const CORRECTION_FIELDS: Array<{ key: string; label: string; type?: 'date' }> = [
  { key: 'firstName', label: 'First name' },
  { key: 'middleName', label: 'Middle name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'displayName', label: 'Display name' },
  { key: 'phone', label: 'Phone number' },
  { key: 'address', label: 'Address' },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { key: 'gender', label: 'Gender' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'emergencyContact', label: 'Emergency contact number' },
];

interface CorrectionRow {
  field: string;
  value: string;
}

const emptyRow = (): CorrectionRow => ({ field: 'firstName', value: '' });

export function RequestDetails({ details }: { details?: Record<string, unknown> | null }) {
  const entries = Object.entries(details || {});
  if (!entries.length) return null;
  return (
    <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 min-w-0">
          <dt className="text-gray-500 dark:text-gray-400 shrink-0">{CORRECTION_FIELDS.find((f) => f.key === k)?.label || humanise(k)}:</dt>
          <dd className="text-gray-800 dark:text-gray-200 break-words">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function MyRequestsCard({ onRequestNominee }: { onRequestNominee?: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<DataPrincipalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RequestType>('access');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<CorrectionRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await dpdpService.getMyRequests();
      setItems([...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      setError(errorMessage(e, 'Could not load your requests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setType('access');
    setDescription('');
    setRows([emptyRow()]);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    let details: Record<string, string> | undefined;
    if (type === 'correction') {
      details = {};
      for (const r of rows) {
        if (!r.field || !r.value.trim()) continue;
        details[r.field] = r.value.trim();
      }
      if (!Object.keys(details).length) {
        setFormError('Add at least one field with the corrected value.');
        return;
      }
    } else if ((type === 'grievance' || type === 'erasure') && !description.trim()) {
      setFormError('Please describe your request.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await dpdpService.createRequest({
        type,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(details ? { details } : {}),
      });
      toast.success(
        created?.dueAt ? `Request submitted. We will respond by ${formatDate(created.dueAt)}.` : 'Request submitted.',
        'Request received',
      );
      setOpen(false);
      reset();
      void load();
    } catch (err) {
      setFormError(errorMessage(err, 'Could not submit your request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      icon={<ClipboardList className="h-5 w-5" />}
      title="My requests"
      description="Ask to access, correct or erase your data, or raise a grievance (DPDP Act, ss. 11–13)."
      actions={
        <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New request
        </button>
      }
    >
      {loading ? (
        <LoadingState label="Loading your requests…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No requests yet" description="Requests you make about your personal data will appear here with their status." />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{REQUEST_TYPE_LABELS[r.type] || humanise(r.type)}</span>
                  <Badge className={REQUEST_STATUS_STYLES[r.status] || REQUEST_STATUS_STYLES.submitted}>
                    {REQUEST_STATUS_LABELS[r.status] || humanise(r.status)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Filed {formatDate(r.createdAt)} ·{' '}
                  {r.resolvedAt ? `resolved ${formatDate(r.resolvedAt)}` : `due ${formatDate(r.dueAt)}`}
                </p>
              </div>
              {r.description && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-line">{r.description}</p>}
              <RequestDetails details={r.details} />
              {r.response && (
                <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Response from the university</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{r.response}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (!submitting) setOpen(false);
        }}
        title="New data request"
        description="We will acknowledge your request and respond within the period prescribed under the DPDP Rules."
        size="lg"
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" form="dpdp-new-request" className={btnPrimary} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </>
        }
      >
        <form id="dpdp-new-request" className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="dpdp-req-type" className={labelClass}>
              Request type
            </label>
            <select id="dpdp-req-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as RequestType)}>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{REQUEST_TYPE_HELP[type]}</p>
          </div>

          {type === 'nomination' && onRequestNominee && (
            <p className="text-xs rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3">
              Tip: you can register or change your nominee directly in the{' '}
              <button
                type="button"
                className="underline font-medium"
                onClick={() => {
                  setOpen(false);
                  onRequestNominee();
                }}
              >
                Nominee
              </button>{' '}
              section — no request needed.
            </p>
          )}

          {type === 'erasure' && (
            <p className="text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-3">
              If approved, your account will be anonymised and you will lose access to it. Records the university must keep
              by law will be retained only for the legally required period.
            </p>
          )}

          {type === 'correction' && (
            <fieldset className="space-y-2">
              <legend className={labelClass}>Proposed changes</legend>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                To correct your sign-in email, ID, results or role, describe it below — an administrator will handle it.
              </p>
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2 items-start">
                  <select
                    aria-label={`Field ${idx + 1}`}
                    className={inputClass}
                    value={row.field}
                    onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, field: e.target.value, value: '' } : r)))}
                  >
                    {CORRECTION_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Correct value ${idx + 1}`}
                    placeholder="Correct value"
                    type={CORRECTION_FIELDS.find((f) => f.key === row.field)?.type === 'date' ? 'date' : 'text'}
                    className={inputClass}
                    value={row.value}
                    onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))}
                  />
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30"
                    aria-label={`Remove change ${idx + 1}`}
                    disabled={rows.length === 1}
                    onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" className="text-sm text-wine dark:text-amber-400 hover:underline" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
                + Add another field
              </button>
            </fieldset>
          )}

          <div>
            <label htmlFor="dpdp-req-desc" className={labelClass}>
              Description {type === 'grievance' || type === 'erasure' ? '' : '(optional)'}
            </label>
            <textarea
              id="dpdp-req-desc"
              rows={4}
              className={inputClass}
              value={description}
              maxLength={4000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'grievance' ? 'What happened, and what outcome would you like?' : 'Anything that helps us handle your request'}
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}
        </form>
      </Modal>
    </Card>
  );
}
