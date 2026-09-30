'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlarmClock, Megaphone, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { dpdpService } from '../../services/dpdp.service';
import { BREACH_STATUS_LABELS, BREACH_STATUS_STYLES, SEVERITY_STYLES, errorMessage, formatCountdown, formatDate, humanise } from '../../lib/format';
import type { BreachIncident, BreachInput, BreachSeverity, BreachStatus } from '../../types';
import { Badge, Card, EmptyState, ErrorState, LoadingState, Modal, btnPrimary, btnSecondary, inputClass, labelClass } from '../ui';

const STATUS_ORDER: BreachStatus[] = ['detected', 'contained', 'board_notified', 'principals_notified', 'closed'];
const SEVERITIES: BreachSeverity[] = ['low', 'medium', 'high', 'critical'];

/** datetime-local value (local time) for a Date */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

function BoardCountdown({ incident, now }: { incident: BreachIncident; now: number }) {
  if (incident.boardNotifiedAt) {
    const late = new Date(incident.boardNotifiedAt).getTime() > new Date(incident.boardReportDueAt).getTime();
    return (
      <span className={`text-xs ${late ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
        Board notified {formatDate(incident.boardNotifiedAt, true)}
        {late ? ' (after the 72h deadline)' : ''}
      </span>
    );
  }
  if (incident.status === 'closed') return <span className="text-xs text-gray-500">Closed without Board intimation recorded</span>;
  const c = formatCountdown(incident.boardReportDueAt, now);
  const urgent = c.overdue || c.ms < 24 * 3_600_000;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        c.overdue ? 'text-red-700 dark:text-red-400' : urgent ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'
      }`}
      aria-live="off"
    >
      <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />
      Board report {c.overdue ? c.text : `due in ${c.text.replace(' left', '')}`}
    </span>
  );
}

function CreateBreachModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: BreachIncident) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'medium' as BreachSeverity,
    detectedAt: toLocalInput(new Date()),
    affectedCount: '',
    dataCategories: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.title.trim().length < 3) return setError('Title must be at least 3 characters.');
    if (form.description.trim().length < 3) return setError('Please describe the incident.');
    const detected = new Date(form.detectedAt);
    if (Number.isNaN(detected.getTime())) return setError('Enter when the breach was detected.');
    if (detected.getTime() > Date.now() + 5 * 60_000) return setError('Detection time cannot be in the future.');
    const payload: BreachInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      severity: form.severity,
      detectedAt: detected.toISOString(),
      dataCategories: form.dataCategories
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (form.affectedCount.trim()) {
      const n = Number(form.affectedCount);
      if (!Number.isInteger(n) || n < 0) return setError('Affected count must be a whole number.');
      payload.affectedCount = n;
    }
    setSaving(true);
    try {
      const created = await dpdpService.createBreach(payload);
      toast.warning(`Incident recorded. Inform the Data Protection Board by ${formatDate(created.boardReportDueAt, true)}.`, 'Breach recorded');
      onCreated(created);
    } catch (err) {
      setError(errorMessage(err, 'Could not record the incident.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      size="lg"
      title="Record a personal data breach"
      description="The Data Protection Board must be informed within 72 hours of detection (DPDP Rules, 2025)."
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="dpdp-breach-form" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Record incident'}
          </button>
        </>
      }
    >
      <form id="dpdp-breach-form" className="space-y-4" onSubmit={submit} noValidate>
        <div>
          <label htmlFor="b-title" className={labelClass}>
            Title
          </label>
          <input id="b-title" className={inputClass} value={form.title} maxLength={256} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="b-desc" className={labelClass}>
            What happened
          </label>
          <textarea id="b-desc" rows={5} className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="b-sev" className={labelClass}>
              Severity
            </label>
            <select id="b-sev" className={inputClass} value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as BreachSeverity }))}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {humanise(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="b-det" className={labelClass}>
              Detected at
            </label>
            <input
              id="b-det"
              type="datetime-local"
              className={inputClass}
              value={form.detectedAt}
              max={toLocalInput(new Date())}
              onChange={(e) => setForm((f) => ({ ...f, detectedAt: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="b-count" className={labelClass}>
              People affected (est.)
            </label>
            <input id="b-count" type="number" min={0} className={inputClass} value={form.affectedCount} onChange={(e) => setForm((f) => ({ ...f, affectedCount: e.target.value }))} />
          </div>
        </div>
        <div>
          <label htmlFor="b-cats" className={labelClass}>
            Data categories (comma separated)
          </label>
          <input
            id="b-cats"
            className={inputClass}
            placeholder="e.g. names, email addresses, phone numbers"
            value={form.dataCategories}
            onChange={(e) => setForm((f) => ({ ...f, dataCategories: e.target.value }))}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function UpdateBreachModal({
  incident,
  onClose,
  onSaved,
}: {
  incident: BreachIncident;
  onClose: () => void;
  onSaved: (b: BreachIncident) => void;
}) {
  const toast = useToast();
  const allowed = STATUS_ORDER.filter((s) => STATUS_ORDER.indexOf(s) >= STATUS_ORDER.indexOf(incident.status));
  const [status, setStatus] = useState<BreachStatus>(incident.status);
  const [remediation, setRemediation] = useState(incident.remediation || '');
  const [affected, setAffected] = useState(incident.affectedCount != null ? String(incident.affectedCount) : '');
  const [boardAt, setBoardAt] = useState(incident.boardNotifiedAt ? toLocalInput(new Date(incident.boardNotifiedAt)) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: { status?: BreachStatus; remediation?: string; boardNotifiedAt?: string; affectedCount?: number } = {};
    if (status !== incident.status) body.status = status;
    if (remediation.trim() !== (incident.remediation || '')) body.remediation = remediation.trim();
    if (affected.trim() !== (incident.affectedCount != null ? String(incident.affectedCount) : '')) {
      const n = Number(affected);
      if (!Number.isInteger(n) || n < 0) return setError('Affected count must be a whole number.');
      body.affectedCount = n;
    }
    if (boardAt && (!incident.boardNotifiedAt || toLocalInput(new Date(incident.boardNotifiedAt)) !== boardAt)) {
      const d = new Date(boardAt);
      if (Number.isNaN(d.getTime())) return setError('Invalid Board notification time.');
      body.boardNotifiedAt = d.toISOString();
    }
    if (!Object.keys(body).length) return onClose();
    setSaving(true);
    try {
      const updated = await dpdpService.updateBreach(incident.id, body);
      toast.success('Incident updated.');
      onSaved(updated);
    } catch (err) {
      setError(errorMessage(err, 'Could not update the incident.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      size="lg"
      title={`Update: ${incident.title}`}
      description="Status can only move forward: detected → contained → board notified → principals notified → closed."
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="dpdp-breach-update" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="dpdp-breach-update" className="space-y-4" onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="bu-status" className={labelClass}>
              Status
            </label>
            <select id="bu-status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as BreachStatus)} disabled={incident.status === 'closed'}>
              {allowed.map((s) => (
                <option key={s} value={s}>
                  {BREACH_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bu-board" className={labelClass}>
              Board notified at
            </label>
            <input id="bu-board" type="datetime-local" className={inputClass} value={boardAt} onChange={(e) => setBoardAt(e.target.value)} />
          </div>
          <div>
            <label htmlFor="bu-count" className={labelClass}>
              People affected
            </label>
            <input id="bu-count" type="number" min={0} className={inputClass} value={affected} onChange={(e) => setAffected(e.target.value)} />
          </div>
        </div>
        {status === 'board_notified' && !boardAt && (
          <p className="text-xs text-gray-500 dark:text-gray-400">If you leave “Board notified at” empty, the current time is recorded.</p>
        )}
        <div>
          <label htmlFor="bu-rem" className={labelClass}>
            Remediation / measures taken
          </label>
          <textarea id="bu-rem" rows={5} className={inputClass} value={remediation} onChange={(e) => setRemediation(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function NotifyModal({ incident, onClose, onDone }: { incident: BreachIncident; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [message, setMessage] = useState(
    `We are writing to let you know about a personal data breach detected on ${formatDate(incident.detectedAt)}.\n\nWhat happened: \n\nData involved: ${(incident.dataCategories || []).join(', ')}\n\nWhat we are doing: \n\nWhat you can do: \n\nFor questions, contact our Data Protection Officer.`,
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    if (message.trim().length < 20) return setError('The message must be at least 20 characters.');
    const ok = await confirm({
      title: 'Email all users of this university?',
      type: 'warning',
      confirmText: 'Send notification',
      message: 'Every active user will receive this message by email. This cannot be recalled.',
    });
    if (!ok) return;
    setSending(true);
    try {
      const res = await dpdpService.notifyPrincipals(incident.id, message.trim());
      toast.success(`Notified ${res.notified}${res.total != null ? ` of ${res.total}` : ''} users.`);
      onDone();
    } catch (e) {
      setError(errorMessage(e, 'Could not send the notification.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={sending ? undefined : onClose}
      size="lg"
      title="Notify affected data principals"
      description="Describe the breach, its likely consequences, the measures taken, and what users can do to protect themselves."
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={send} disabled={sending}>
            <Megaphone className="h-4 w-4" aria-hidden="true" /> {sending ? 'Sending…' : 'Send to all users'}
          </button>
        </>
      }
    >
      <label htmlFor="bn-msg" className={labelClass}>
        Message
      </label>
      <textarea id="bn-msg" rows={12} className={inputClass} value={message} maxLength={10000} onChange={(e) => setMessage(e.target.value)} />
      {incident.principalsNotifiedAt && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Users were already notified on {formatDate(incident.principalsNotifiedAt, true)}.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}

export default function BreachesTab() {
  const now = useNow();
  const [items, setItems] = useState<BreachIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BreachIncident | null>(null);
  const [notifying, setNotifying] = useState<BreachIncident | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await dpdpService.listBreaches());
    } catch (e) {
      setError(errorMessage(e, 'Could not load the breach register.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (b: BreachIncident) => setItems((list) => list.map((x) => (x.id === b.id ? { ...x, ...b } : x)));

  return (
    <Card
      title="Breach register"
      description="Record every personal data breach, inform the Board within 72 hours and notify affected users."
      actions={
        <>
          <button type="button" className={btnSecondary} onClick={load} aria-label="Refresh breach register">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
          <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Record breach
          </button>
        </>
      }
    >
      {loading && !items.length ? (
        <LoadingState label="Loading incidents…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No breaches recorded" description="Good. If you detect one, record it here straight away — the 72-hour clock starts at detection." />
      ) : (
        <ul className="space-y-3">
          {items.map((b) => (
            <li key={b.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{b.title}</span>
                    <Badge className={SEVERITY_STYLES[b.severity] || SEVERITY_STYLES.medium}>{humanise(String(b.severity))}</Badge>
                    <Badge className={BREACH_STATUS_STYLES[b.status]}>{BREACH_STATUS_LABELS[b.status] || b.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{b.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>Detected {formatDate(b.detectedAt, true)}</span>
                    {b.affectedCount != null && <span>{b.affectedCount.toLocaleString('en-IN')} affected</span>}
                    {!!b.dataCategories?.length && <span>Data: {b.dataCategories.join(', ')}</span>}
                    {b.principalsNotifiedAt && <span>Users notified {formatDate(b.principalsNotifiedAt, true)}</span>}
                  </div>
                  <BoardCountdown incident={b} now={now} />
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button type="button" className={btnSecondary} onClick={() => setEditing(b)} disabled={b.status === 'closed'}>
                    <Pencil className="h-4 w-4" aria-hidden="true" /> Update
                  </button>
                  {b.status !== 'closed' && (
                    <button type="button" className={btnSecondary} onClick={() => setNotifying(b)}>
                      <Megaphone className="h-4 w-4" aria-hidden="true" /> Notify users
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <CreateBreachModal
          onClose={() => setCreating(false)}
          onCreated={(b) => {
            setCreating(false);
            setItems((list) => [b, ...list]);
          }}
        />
      )}
      {editing && (
        <UpdateBreachModal
          incident={editing}
          onClose={() => setEditing(null)}
          onSaved={(b) => {
            setEditing(null);
            replace(b);
          }}
        />
      )}
      {notifying && (
        <NotifyModal
          incident={notifying}
          onClose={() => setNotifying(null)}
          onDone={() => {
            setNotifying(null);
            void load();
          }}
        />
      )}
    </Card>
  );
}
