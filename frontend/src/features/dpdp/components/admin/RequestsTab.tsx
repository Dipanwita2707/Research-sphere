'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';
import { dpdpService } from '../../services/dpdp.service';
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  REQUEST_TYPE_LABELS,
  errorMessage,
  errorStatus,
  formatCountdown,
  formatDate,
  humanise,
} from '../../lib/format';
import type { DataPrincipalRequest, RequestStatus, RequestType } from '../../types';
import { RequestDetails } from '../privacy/MyRequestsCard';
import { Badge, Card, Drawer, EmptyState, ErrorState, LoadingState, btnDanger, btnPrimary, btnSecondary, inputClass, labelClass } from '../ui';

const STATUSES: RequestStatus[] = ['submitted', 'in_review', 'completed', 'rejected'];
const TYPES: RequestType[] = ['access', 'correction', 'erasure', 'grievance', 'consent_withdrawal', 'nomination'];
const PAGE_SIZE = 20;
const ERASE_PHRASE = 'ERASE';

const FULFIL_HELP: Record<RequestType, string> = {
  access: 'Marks the request completed. The user downloads their data from “Privacy & my data”.',
  correction: 'Applies the proposed changes listed above to the user’s profile and completes the request.',
  erasure: 'Anonymises the user’s account. They will lose access. Records the law requires to keep are anonymised, not deleted.',
  grievance: 'Completes the grievance with your response.',
  consent_withdrawal: 'Completes the request with your response.',
  nomination: 'Completes the request (the nominee itself is managed by the user).',
};

function isOpen(r: DataPrincipalRequest) {
  return r.status === 'submitted' || r.status === 'in_review';
}

function extractOpenItems(error: unknown): Record<string, unknown> | null {
  const data = (error as { response?: { data?: { errors?: { openItems?: unknown }; data?: { openItems?: unknown } } } })?.response?.data;
  const items = data?.errors?.openItems ?? data?.data?.openItems;
  return items && typeof items === 'object' ? (items as Record<string, unknown>) : null;
}

function RequestDrawer({
  request,
  onClose,
  onChanged,
}: {
  request: DataPrincipalRequest;
  onClose: () => void;
  onChanged: (r: DataPrincipalRequest) => void;
}) {
  const toast = useToast();
  const [response, setResponse] = useState(request.response || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, unknown> | null>(null);
  const [force, setForce] = useState(false);
  const open = isOpen(request);
  const isErasure = request.type === 'erasure';
  const due = formatCountdown(request.dueAt);

  const merge = (updated: DataPrincipalRequest) => onChanged({ ...request, ...updated, user: request.user });

  const patch = async (body: { status?: RequestStatus; response?: string }, label: string, success: string) => {
    setBusy(label);
    try {
      merge(await dpdpService.updateRequest(request.id, body));
      toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not update the request.'));
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (!response.trim()) {
      toast.warning('Please write a response explaining why the request is rejected.');
      return;
    }
    await patch({ status: 'rejected', response: response.trim() }, 'reject', 'Request rejected and the user has been informed.');
  };

  const handleFulfil = async () => {
    if (isErasure && confirmText.trim() !== ERASE_PHRASE) return;
    setBusy('fulfil');
    try {
      const updated = await dpdpService.fulfilRequest(request.id, {
        ...(response.trim() ? { response: response.trim() } : {}),
        ...(isErasure && force ? { force: true } : {}),
      });
      merge(updated);
      toast.success(isErasure ? 'The user’s personal data has been erased.' : 'Request fulfilled.');
      setOpenItems(null);
      setConfirmText('');
    } catch (e) {
      const items = isErasure && errorStatus(e) === 409 ? extractOpenItems(e) : null;
      if (items) {
        setOpenItems(items);
        toast.warning('The user still has open workflows. Review them before erasing.');
      } else {
        toast.error(errorMessage(e, 'Could not fulfil the request.'));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={REQUEST_TYPE_LABELS[request.type] || humanise(request.type)}
      footer={
        open ? (
          <>
            {request.status === 'submitted' && (
              <button
                type="button"
                className={btnSecondary}
                disabled={!!busy}
                onClick={() => patch({ status: 'in_review' }, 'review', 'Marked as in review.')}
              >
                {busy === 'review' ? 'Saving…' : 'Mark in review'}
              </button>
            )}
            <button
              type="button"
              className={btnSecondary}
              disabled={!!busy || !response.trim() || response.trim() === (request.response || '')}
              onClick={() => patch({ response: response.trim() }, 'save', 'Response saved.')}
            >
              {busy === 'save' ? 'Saving…' : 'Save response'}
            </button>
            <button type="button" className={btnSecondary} disabled={!!busy} onClick={handleReject}>
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
            <button
              type="button"
              className={isErasure ? btnDanger : btnPrimary}
              disabled={!!busy || (isErasure && (confirmText.trim() !== ERASE_PHRASE || (!!openItems && !force)))}
              onClick={handleFulfil}
            >
              {busy === 'fulfil' ? 'Working…' : isErasure ? 'Erase user data' : 'Fulfil request'}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={REQUEST_STATUS_STYLES[request.status]}>{REQUEST_STATUS_LABELS[request.status] || request.status}</Badge>
          {open && (
            <Badge
              className={
                due.overdue
                  ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800'
                  : 'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
              }
            >
              {due.text}
            </Badge>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="col-span-2">
            <dt className="text-xs text-gray-500 dark:text-gray-400">Data principal</dt>
            <dd className="text-gray-900 dark:text-white">
              {request.user?.name || '—'}{' '}
              <span className="text-gray-500 dark:text-gray-400">
                {[request.user?.uid, request.user?.email, request.user?.role].filter(Boolean).join(' · ')}
              </span>
              {request.user?.erased && <span className="ml-2 text-xs text-red-600">(erased)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Filed</dt>
            <dd className="text-gray-900 dark:text-white">{formatDate(request.createdAt, true)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Due</dt>
            <dd className="text-gray-900 dark:text-white">{formatDate(request.dueAt)}</dd>
          </div>
          {request.resolvedAt && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Resolved</dt>
              <dd className="text-gray-900 dark:text-white">{formatDate(request.resolvedAt, true)}</dd>
            </div>
          )}
        </dl>

        <div>
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</h3>
          <p className="mt-1 text-gray-800 dark:text-gray-200 whitespace-pre-line">{request.description || '—'}</p>
        </div>

        {request.details && Object.keys(request.details).length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {request.type === 'correction' ? 'Proposed changes' : 'Details'}
            </h3>
            <RequestDetails details={request.details} />
          </div>
        )}

        <div>
          <label htmlFor="dpdp-admin-response" className={labelClass}>
            Response to the user
          </label>
          <textarea
            id="dpdp-admin-response"
            rows={5}
            className={inputClass}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            disabled={!open}
            maxLength={10000}
            placeholder={open ? 'Optional when fulfilling (a standard reply is used); required when rejecting.' : ''}
          />
        </div>

        {open && (
          <div className={`rounded-xl p-3 ${isErasure ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800/60'}`}>
            <p className={`text-xs ${isErasure ? 'text-red-800 dark:text-red-300' : 'text-gray-600 dark:text-gray-400'}`}>
              <strong>Fulfil:</strong> {FULFIL_HELP[request.type]}
            </p>
            {isErasure && (
              <div className="mt-3 space-y-3">
                {openItems && (
                  <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Open workflows still reference this user
                    </p>
                    <ul className="mt-1 list-disc pl-5 text-xs text-amber-800 dark:text-amber-300">
                      {Object.entries(openItems).map(([k, v]) => (
                        <li key={k}>
                          {humanise(k)}: {typeof v === 'number' || typeof v === 'string' ? v : Array.isArray(v) ? v.length : JSON.stringify(v)}
                        </li>
                      ))}
                    </ul>
                    <label className="mt-2 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                      <input type="checkbox" className="mt-0.5" checked={force} onChange={(e) => setForce(e.target.checked)} />
                      Erase anyway — I have checked these records can be anonymised.
                    </label>
                  </div>
                )}
                <div>
                  <label htmlFor="dpdp-erase-confirm" className="block text-xs font-medium text-red-800 dark:text-red-300 mb-1">
                    Type <strong>{ERASE_PHRASE}</strong> to confirm. This cannot be undone.
                  </label>
                  <input
                    id="dpdp-erase-confirm"
                    className={inputClass}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default function RequestsTab() {
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [type, setType] = useState<RequestType | ''>('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DataPrincipalRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DataPrincipalRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dpdpService.listRequests({ status, type, page, limit: PAGE_SIZE });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(errorMessage(e, 'Could not load requests.'));
    } finally {
      setLoading(false);
    }
  }, [status, type, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card
      title="Data principal requests"
      description="Access, correction, erasure, grievance and nomination requests, oldest due first."
      actions={
        <button type="button" className={btnSecondary} onClick={load} aria-label="Refresh requests">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      }
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="sm:w-48">
          <label htmlFor="dpdp-f-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="dpdp-f-status"
            className={inputClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as RequestStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {REQUEST_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:w-56">
          <label htmlFor="dpdp-f-type" className="sr-only">
            Filter by type
          </label>
          <select
            id="dpdp-f-type"
            className={inputClass}
            value={type}
            onChange={(e) => {
              setType(e.target.value as RequestType | '');
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {REQUEST_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !items.length ? (
        <LoadingState label="Loading requests…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No requests match these filters" />
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['User', 'Type', 'Status', 'Filed', 'Due', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((r) => {
                  const overdue = r.overdue ?? (isOpen(r) && new Date(r.dueAt).getTime() < Date.now());
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{r.user?.name || r.user?.uid || '—'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{r.user?.email || r.user?.uid || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{REQUEST_TYPE_LABELS[r.type] || humanise(r.type)}</td>
                      <td className="px-4 py-3">
                        <Badge className={REQUEST_STATUS_STYLES[r.status]}>{REQUEST_STATUS_LABELS[r.status] || r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                      <td className={`px-4 py-3 whitespace-nowrap ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                        {formatDate(r.dueAt)}
                        {overdue && <span className="ml-1 text-xs">(overdue)</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" className="text-wine dark:text-amber-400 hover:underline text-sm font-medium" onClick={() => setSelected(r)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600 dark:text-gray-400">
            <span>
              {total.toLocaleString('en-IN')} request{total === 1 ? '' : 's'} · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button type="button" className={btnSecondary} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className={btnSecondary} disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <RequestDrawer
          key={selected.id}
          request={selected}
          onClose={() => setSelected(null)}
          onChanged={(r) => {
            setSelected(r);
            setItems((list) => list.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
          }}
        />
      )}
    </Card>
  );
}
