'use client';

import React, { useState } from 'react';
import { CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import api from '@/shared/api/api';
import { extractErrorMessage } from '@/shared/types/api.types';
import {
  UGC_CARE_GROUP_LABELS,
  UgcCareGroupValue,
  UgcCareListedValue,
  toUgcCareListedValue,
} from '@/features/research-management/components/UgcCareFields';

interface Props {
  contributionId: string;
  ugcCareListed?: boolean | null;
  ugcCareGroup?: string | null;
  /** research_review or research_approve: may confirm / correct the status */
  canEdit: boolean;
  onUpdated?: (next: { ugcCareListed: boolean | null; ugcCareGroup: string | null }) => void;
}

const describe = (listed: UgcCareListedValue, group: string | null | undefined) => {
  if (listed === 'yes') {
    const label = group && group in UGC_CARE_GROUP_LABELS ? UGC_CARE_GROUP_LABELS[group as keyof typeof UGC_CARE_GROUP_LABELS] : 'group not stated';
    return `Listed - ${label}`;
  }
  if (listed === 'no') return 'Not listed';
  return 'Unknown';
};

/** Compact DRD control: show the applicant's UGC-CARE claim and let reviewers confirm or correct it. */
export default function UgcCareReviewControl({ contributionId, ugcCareListed, ugcCareGroup, canEdit, onUpdated }: Props) {
  const [listed, setListed] = useState<UgcCareListedValue>(toUgcCareListedValue(ugcCareListed));
  const [group, setGroup] = useState<UgcCareGroupValue>((ugcCareGroup as UgcCareGroupValue) || '');
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const startEditing = () => {
    setListed(toUgcCareListedValue(ugcCareListed));
    setGroup((ugcCareGroup as UgcCareGroupValue) || '');
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const current = describe(toUgcCareListedValue(ugcCareListed), ugcCareGroup);
  const badgeClass = ugcCareListed === true
    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
    : ugcCareListed === false
      ? 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ugcCareListed: listed === 'yes' ? true : listed === 'no' ? false : null,
        ugcCareGroup: listed === 'yes' && group ? group : null,
        comment: comment.trim() || undefined,
      };
      const response = await api.patch(`/research/${contributionId}/ugc-care`, body);
      const data = response.data?.data || body;
      onUpdated?.({ ugcCareListed: data.ugcCareListed ?? null, ugcCareGroup: data.ugcCareGroup ?? null });
      setEditing(false);
      setComment('');
      setSaved(true);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="col-span-full rounded-lg border border-gray-200 dark:border-gray-700 p-3" data-testid="ugc-care-review">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">UGC-CARE listed</span>
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
          {ugcCareListed === true && <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}
          {current}
        </span>
        {saved && !editing && (
          <span className="inline-flex items-center text-xs text-green-700 dark:text-green-300">
            <CheckCircle className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> Confirmed
          </span>
        )}
        {canEdit && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="ml-auto text-xs font-medium text-wine dark:text-wine-200 hover:underline"
          >
            Confirm / correct
          </button>
        )}
      </div>

      {canEdit && editing && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Listed?</span>
            <select
              value={listed}
              onChange={(e) => { const v = e.target.value as UgcCareListedValue; setListed(v); if (v !== 'yes') setGroup(''); }}
              className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="">Unknown</option>
            </select>
          </label>
          {listed === 'yes' && (
            <label className="text-sm">
              <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Group</span>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value as UgcCareGroupValue)}
                className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">Not stated</option>
                {(Object.keys(UGC_CARE_GROUP_LABELS) as Array<keyof typeof UGC_CARE_GROUP_LABELS>).map((g) => (
                  <option key={g} value={g}>{UGC_CARE_GROUP_LABELS[g]}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm flex-1 min-w-[12rem]">
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Note (optional)</span>
            <input
              type="text"
              value={comment}
              maxLength={1000}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. verified on the UGC-CARE portal"
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-wine-fg bg-wine hover:bg-wine-dark disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              className="px-3 py-1.5 rounded-md text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
