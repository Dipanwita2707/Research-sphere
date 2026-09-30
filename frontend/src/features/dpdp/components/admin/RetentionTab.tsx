'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { dpdpService } from '../../services/dpdp.service';
import { errorMessage, humanise } from '../../lib/format';
import type { RetentionPolicy } from '../../types';
import { Badge, Card, EmptyState, ErrorState, LoadingState, btnPrimary, inputClass } from '../ui';

/** Legal floors also enforced by the backend; kept here so the UI blocks bad values early. */
const KNOWN_FLOORS: Record<string, number> = { audit_log: 365 };
const MAX_DAYS = 36500;

interface Row {
  category: string;
  label: string;
  retentionDays: string;
  action: string;
  minDays: number;
  allowedActions: string[];
  platformOnly: boolean;
  source?: string;
}

function toRow(p: RetentionPolicy): Row {
  return {
    category: p.category,
    label: p.label || humanise(p.category),
    retentionDays: String(p.retentionDays),
    action: String(p.action || 'anonymize'),
    minDays: Math.max(p.minDays ?? 1, KNOWN_FLOORS[p.category] ?? 1),
    allowedActions: p.allowedActions?.length ? p.allowedActions : ['anonymize', 'delete'],
    platformOnly: !!p.platformOnly,
    source: p.source,
  };
}

function rowError(r: Row): string | null {
  const n = Number(r.retentionDays);
  if (!Number.isInteger(n)) return 'Whole number of days';
  if (n < r.minDays) return `Minimum ${r.minDays} days`;
  if (n > MAX_DAYS) return `Maximum ${MAX_DAYS} days`;
  return null;
}

export default function RetentionTab({ platformScope }: { platformScope: boolean }) {
  const toast = useToast();
  const [original, setOriginal] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = (await dpdpService.listRetentionPolicies()).map(toRow);
      setOriginal(list);
      setRows(list);
    } catch (e) {
      setError(errorMessage(e, 'Could not load retention policies.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = (r: Row) => platformScope || !r.platformOnly;

  const changed = useMemo(
    () =>
      rows.filter((r) => {
        const o = original.find((x) => x.category === r.category);
        return !o || o.retentionDays !== r.retentionDays || o.action !== r.action;
      }),
    [rows, original],
  );
  const hasErrors = rows.some((r) => editable(r) && !!rowError(r));

  const update = (category: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.category === category ? { ...r, ...patch } : r)));

  const save = async () => {
    if (hasErrors || !changed.length) return;
    setSaving(true);
    try {
      const saved = await dpdpService.saveRetentionPolicies(
        changed.filter(editable).map((r) => ({ category: r.category, retentionDays: Number(r.retentionDays), action: r.action })),
      );
      const list = saved.map(toRow);
      if (list.length) {
        setOriginal(list);
        setRows(list);
      } else {
        void load();
      }
      toast.success('Retention policies saved.');
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save retention policies.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Retention policies"
      description={
        platformScope
          ? 'Platform defaults. Universities can override these for their own data.'
          : 'How long each category of personal data is kept once its purpose ends (DPDP s. 8(7)). Security logs must be kept at least one year.'
      }
      actions={
        <button type="button" className={btnPrimary} onClick={save} disabled={saving || hasErrors || !changed.length}>
          <Save className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving…' : changed.length ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'Saved'}
        </button>
      }
    >
      {loading ? (
        <LoadingState label="Loading retention policies…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState title="No retention categories" />
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['Category', 'Keep for (days)', 'Then', 'Source'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => {
                const err = editable(r) ? rowError(r) : null;
                const id = `ret-${r.category}`;
                return (
                  <tr key={r.category}>
                    <td className="px-4 py-3">
                      <label htmlFor={id} className="font-medium text-gray-900 dark:text-white">
                        {r.label}
                      </label>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <code>{r.category}</code>
                        {r.minDays > 1 && ` · legal minimum ${r.minDays} days`}
                        {r.platformOnly && ' · platform-wide'}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-44">
                      <input
                        id={id}
                        type="number"
                        min={r.minDays}
                        max={MAX_DAYS}
                        step={1}
                        className={`${inputClass} ${err ? 'border-red-400 focus:border-red-500 focus:ring-red-300' : ''}`}
                        value={r.retentionDays}
                        disabled={!editable(r) || saving}
                        aria-invalid={!!err}
                        aria-describedby={err ? `${id}-err` : undefined}
                        onChange={(e) => update(r.category, { retentionDays: e.target.value })}
                      />
                      {err && (
                        <p id={`${id}-err`} className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {err}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 w-40">
                      <select
                        aria-label={`Action for ${r.label}`}
                        className={inputClass}
                        value={r.action}
                        disabled={!editable(r) || saving || r.allowedActions.length < 2}
                        onChange={(e) => update(r.category, { action: e.target.value })}
                      >
                        {r.allowedActions.map((a) => (
                          <option key={a} value={a}>
                            {a === 'anonymize' ? 'Anonymise' : 'Delete'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                        {r.source === 'tenant' ? 'University' : r.source === 'platform' ? 'Platform' : 'Built-in default'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
