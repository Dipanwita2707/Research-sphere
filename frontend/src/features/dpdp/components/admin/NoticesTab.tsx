'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Copy, Eye, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { dpdpService } from '../../services/dpdp.service';
import SafeMarkdown from '../../lib/SafeMarkdown';
import { errorMessage, formatDate } from '../../lib/format';
import type { ConsentNotice, NoticeInput, NoticePurpose } from '../../types';
import { Badge, Card, EmptyState, ErrorState, LoadingState, Modal, Toggle, btnPrimary, btnSecondary, inputClass, labelClass } from '../ui';

const PURPOSE_KEY = /^[a-z][a-z0-9_]{1,63}$/;

const blankPurpose = (): NoticePurpose => ({ key: '', label: '', description: '', required: false });

const TEMPLATE_CONTENT = `## Privacy notice

Explain in plain language what personal data is processed, why, how long it is kept, and how users can exercise their rights.

### Contact
- **Data Protection Officer**: {{DPO_NAME}}
- **Email**: {{DPO_EMAIL}}
- **Phone**: {{DPO_PHONE}}
`;

function suggestVersion(existing: ConsentNotice[]): string {
  const d = new Date();
  const base = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  let n = 1;
  while (existing.some((x) => x.version === `${base}-v${n}`)) n++;
  return `${base}-v${n}`;
}

function validate(input: NoticeInput): string | null {
  if (!input.version.trim()) return 'Version is required.';
  if (input.version.trim().length > 32) return 'Version must be at most 32 characters.';
  if (input.title.trim().length < 3) return 'Title must be at least 3 characters.';
  if (input.content.trim().length < 50) return 'Notice content must be at least 50 characters.';
  if (!input.purposes.length) return 'Add at least one purpose.';
  const keys = new Set<string>();
  for (const [i, p] of input.purposes.entries()) {
    if (!PURPOSE_KEY.test(p.key)) return `Purpose ${i + 1}: key must be lowercase letters, digits or _ (2–64 chars, starting with a letter).`;
    if (keys.has(p.key)) return `Purpose key “${p.key}” is used twice.`;
    keys.add(p.key);
    if (p.label.trim().length < 2) return `Purpose ${i + 1}: label is required.`;
  }
  if (!input.purposes.some((p) => p.required)) return 'At least one purpose must be required (the core service).';
  return null;
}

function NoticeEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: NoticeInput;
  onClose: () => void;
  onSaved: (n: ConsentNotice) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<NoticeInput>(initial);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPurpose = (idx: number, patch: Partial<NoticePurpose>) =>
    setForm((f) => ({ ...f, purposes: f.purposes.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));

  const move = (idx: number, dir: -1 | 1) =>
    setForm((f) => {
      const next = [...f.purposes];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return f;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...f, purposes: next };
    });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: NoticeInput = {
      version: form.version.trim(),
      language: (form.language || 'en').trim(),
      title: form.title.trim(),
      content: form.content,
      purposes: form.purposes.map((p) => ({ key: p.key.trim(), label: p.label.trim(), description: p.description.trim(), required: p.required })),
    };
    const problem = validate(payload);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const saved = await dpdpService.createNotice(payload);
      toast.success(`Notice ${saved.version} created. Activate it when you are ready.`);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the notice.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      size="xl"
      title="New privacy notice version"
      description="Notices are versioned and immutable. Create a new version, then activate it — every user will be asked to consent again."
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="dpdp-notice-form" className={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Create notice (inactive)'}
          </button>
        </>
      }
    >
      <form id="dpdp-notice-form" onSubmit={handleSave} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_3fr] gap-3">
          <div>
            <label htmlFor="n-version" className={labelClass}>
              Version
            </label>
            <input id="n-version" className={inputClass} value={form.version} maxLength={32} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="n-lang" className={labelClass}>
              Language
            </label>
            <input id="n-lang" className={inputClass} value={form.language || 'en'} maxLength={8} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="n-title" className={labelClass}>
              Title
            </label>
            <input id="n-title" className={inputClass} value={form.title} maxLength={256} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="n-content" className={labelClass}>
              Notice content (Markdown)
            </label>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 text-xs" role="tablist" aria-label="Editor mode">
              {(['Write', 'Preview'] as const).map((m) => {
                const active = (m === 'Preview') === preview;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`px-2.5 py-1 rounded-md ${active ? 'bg-wine text-white' : 'text-gray-600 dark:text-gray-300'}`}
                    onClick={() => setPreview(m === 'Preview')}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          {preview ? (
            <div className="min-h-[16rem] max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2">
              <SafeMarkdown content={form.content} />
            </div>
          ) : (
            <textarea
              id="n-content"
              rows={14}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Placeholders <code>{'{{DPO_NAME}}'}</code>, <code>{'{{DPO_EMAIL}}'}</code> and <code>{'{{DPO_PHONE}}'}</code> are filled from the DPO contact settings.
            Headings, lists, <strong>**bold**</strong> and links are supported; HTML is not.
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Purposes</legend>
          <div className="space-y-3">
            {form.purposes.map((p, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2 items-end">
                  <div>
                    <label htmlFor={`p-key-${idx}`} className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Key
                    </label>
                    <input
                      id={`p-key-${idx}`}
                      className={`${inputClass} font-mono`}
                      value={p.key}
                      placeholder="e.g. core_services"
                      onChange={(e) => setPurpose(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`p-label-${idx}`} className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Label
                    </label>
                    <input id={`p-label-${idx}`} className={inputClass} value={p.label} maxLength={128} onChange={(e) => setPurpose(idx, { label: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-1 pb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400 mr-1">Required</span>
                    <Toggle label={`Purpose ${idx + 1} required`} checked={p.required} onChange={(v) => setPurpose(idx, { required: v })} />
                    <button type="button" className="p-1.5 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      disabled={idx === form.purposes.length - 1}
                      onClick={() => move(idx, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 disabled:opacity-30"
                      disabled={form.purposes.length === 1}
                      onClick={() => setForm((f) => ({ ...f, purposes: f.purposes.filter((_, i) => i !== idx) }))}
                      aria-label={`Remove purpose ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor={`p-desc-${idx}`} className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Description shown to users
                  </label>
                  <textarea
                    id={`p-desc-${idx}`}
                    rows={2}
                    className={inputClass}
                    value={p.description}
                    maxLength={2000}
                    onChange={(e) => setPurpose(idx, { description: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 text-sm text-wine dark:text-hi hover:underline" onClick={() => setForm((f) => ({ ...f, purposes: [...f.purposes, blankPurpose()] }))}>
            + Add purpose
          </button>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default function NoticesTab({ platformScope }: { platformScope: boolean }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [notices, setNotices] = useState<ConsentNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<NoticeInput | null>(null);
  const [viewing, setViewing] = useState<ConsentNotice | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotices(await dpdpService.listNotices());
    } catch (e) {
      setError(errorMessage(e, 'Could not load notices.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = (from?: ConsentNotice) => {
    const source = from || notices.find((n) => n.isActive) || null;
    setEditor({
      version: suggestVersion(notices),
      language: source?.language || 'en',
      title: source?.title || 'Privacy notice',
      content: source?.content || TEMPLATE_CONTENT,
      purposes: source?.purposes?.length
        ? source.purposes.map((p) => ({ ...p, description: p.description || '' }))
        : [{ key: 'core_services', label: 'Core services', description: '', required: true }],
    });
  };

  const canActivate = (n: ConsentNotice) => !n.isActive && (platformScope ? !!n.isPlatformDefault : !n.isPlatformDefault);

  const handleActivate = async (n: ConsentNotice) => {
    const ok = await confirm({
      title: `Activate notice ${n.version}?`,
      type: 'warning',
      confirmText: 'Activate',
      message: `The current ${n.language} notice will be deactivated and every ${platformScope ? 'user on the platform without their own university notice' : 'user of your university'} will be asked to review this notice and give consent again before continuing.`,
    });
    if (!ok) return;
    setActivating(n.id);
    try {
      await dpdpService.activateNotice(n.id);
      toast.success(`Notice ${n.version} is now active.`);
      void load();
    } catch (e) {
      toast.error(errorMessage(e, 'Could not activate the notice.'));
    } finally {
      setActivating(null);
    }
  };

  return (
    <Card
      title="Privacy notices"
      description={
        platformScope
          ? 'Platform default notices, used by universities that have not published their own.'
          : 'Your university’s notices. The platform default applies until you activate your own.'
      }
      actions={
        <button type="button" className={btnPrimary} onClick={() => startNew()} disabled={loading}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New version
        </button>
      }
    >
      {loading ? (
        <LoadingState label="Loading notices…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : notices.length === 0 ? (
        <EmptyState title="No notices yet" description="Create the first version of your privacy notice." />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
          {notices.map((n) => (
            <li key={n.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 sm:p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{n.title}</span>
                  <Badge className="bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                    v{n.version} · {n.language}
                  </Badge>
                  {n.isPlatformDefault && (
                    <Badge className="bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800">Platform default</Badge>
                  )}
                  {n.isActive && (
                    <Badge className="bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {n.purposes.length} purpose{n.purposes.length === 1 ? '' : 's'} ({n.purposes.filter((p) => p.required).length} required) ·{' '}
                  {n.isActive ? `effective ${formatDate(n.effectiveFrom)}` : `created ${formatDate(n.createdAt || n.effectiveFrom)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button type="button" className={btnSecondary} onClick={() => setViewing(n)}>
                  <Eye className="h-4 w-4" aria-hidden="true" /> View
                </button>
                <button type="button" className={btnSecondary} onClick={() => startNew(n)}>
                  <Copy className="h-4 w-4" aria-hidden="true" /> New version from this
                </button>
                {canActivate(n) && (
                  <button type="button" className={btnPrimary} disabled={activating === n.id} onClick={() => handleActivate(n)}>
                    {activating === n.id ? 'Activating…' : 'Activate'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <NoticeEditor
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void load();
          }}
        />
      )}

      {viewing && (
        <Modal open onClose={() => setViewing(null)} size="lg" title={viewing.title} description={`Version ${viewing.version} · ${viewing.language}`}>
          <SafeMarkdown content={viewing.content} />
          <h3 className="mt-6 mb-2 text-sm font-semibold text-gray-900 dark:text-white">Purposes</h3>
          <ul className="space-y-2">
            {viewing.purposes.map((p) => (
              <li key={p.key} className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">{p.label}</span>{' '}
                <code className="text-xs text-gray-500">{p.key}</code>
                {p.required && <span className="ml-2 text-xs text-gray-500">(required)</span>}
                {p.description && <p className="text-xs text-gray-600 dark:text-gray-400">{p.description}</p>}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </Card>
  );
}
