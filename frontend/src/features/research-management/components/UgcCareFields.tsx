'use client';

import React from 'react';

export type UgcCareListedValue = '' | 'yes' | 'no';
export type UgcCareGroupValue = '' | 'group_1' | 'group_2';

/** UGC-CARE groups: Group I = qualified through the UGC-CARE protocol; Group II = indexed in Scopus / Web of Science. */
export const UGC_CARE_GROUP_LABELS: Record<Exclude<UgcCareGroupValue, ''>, string> = {
  group_1: 'Group I (UGC-CARE protocol)',
  group_2: 'Group II (Scopus / Web of Science indexed)',
};

/**
 * Indexing categories that mean "indexed in Scopus or Web of Science". UGC-CARE Group II is exactly
 * those journals, so ticking any of these answers the UGC-CARE question (mirrors the backend rule
 * in research/utils/ugcCare.js, which applies it on save).
 */
export const SCOPUS_WOS_CATEGORY_LABELS: Record<string, string> = {
  scopus: 'SCOPUS',
  scie_wos: 'SCIE/SCI (WOS)',
  abdc_scopus_wos: 'ABDC (SCOPUS/WOS)',
  nature_science_lancet_cell_nejm: 'Nature/Science/The Lancet/Cell/NEJM',
  subsidiary_if_above_20: 'Subsidiary Journals (IF > 20)',
};

/** Labels of the selected categories that imply UGC-CARE Group II (empty = the author must answer). */
export const ugcCareImpliedBy = (indexingCategories: string[] | undefined | null): string[] =>
  (indexingCategories || []).filter((c) => c in SCOPUS_WOS_CATEGORY_LABELS).map((c) => SCOPUS_WOS_CATEGORY_LABELS[c]);

/** Backend value (true / false / null) → form value. */
export const toUgcCareListedValue = (v: unknown): UgcCareListedValue => (v === true ? 'yes' : v === false ? 'no' : '');

/** Form values → request fields (group only when listed). */
export const ugcCarePayload = (listed: UgcCareListedValue, group: UgcCareGroupValue, indexingCategories?: string[]) =>
  ugcCareImpliedBy(indexingCategories).length
    ? { ugcCareListed: true, ugcCareGroup: 'group_2' as const }
    : {
        ugcCareListed: listed === 'yes' ? true : listed === 'no' ? false : null,
        ugcCareGroup: listed === 'yes' && group ? group : null,
      };

interface Props {
  listed: UgcCareListedValue;
  group: UgcCareGroupValue;
  onChange: (listed: UgcCareListedValue, group: UgcCareGroupValue) => void;
  disabled?: boolean;
  /** The paper's selected indexing categories; Scopus / WoS ones answer the question automatically. */
  indexingCategories?: string[];
}

const OPTIONS: Array<{ value: UgcCareListedValue; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: '', label: "Don't know" },
];

/** "Journal is in the UGC-CARE list" (yes / no / unknown) + group, for journal papers. */
export default function UgcCareFields({ listed, group, onChange, disabled, indexingCategories }: Props) {
  const impliedBy = ugcCareImpliedBy(indexingCategories);
  if (impliedBy.length) {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4"
      >
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          UGC-CARE: <span className="text-emerald-700 dark:text-emerald-300">Listed — {UGC_CARE_GROUP_LABELS.group_2}</span>
        </p>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Set automatically because you selected {impliedBy.join(', ')}. UGC-CARE Group II covers journals indexed in
          Scopus / Web of Science, so you don&apos;t need to answer this. Used for NAAC reporting; DRD verifies it during review.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-blush-line dark:border-gray-600 bg-blush/50 dark:bg-gray-700/40 p-4">
      <fieldset disabled={disabled}>
        <legend className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Is the journal in the UGC-CARE list?
        </legend>
        <p className="-mt-1 mb-2 text-xs text-gray-500 dark:text-gray-400">
          Not needed for Scopus / Web of Science journals (answered automatically). For other journals, check the UGC-CARE list (Group I).
        </p>
        <div className="flex flex-wrap gap-3">
          {OPTIONS.map((o) => (
            <label
              key={o.value || 'unknown'}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                listed === o.value
                  ? 'border-wine bg-wine/10 text-wine dark:text-wine-200 dark:border-wine-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'
              }`}
            >
              <input
                type="radio"
                name="ugcCareListed"
                value={o.value}
                checked={listed === o.value}
                onChange={() => onChange(o.value, o.value === 'yes' ? group : '')}
                className="accent-wine"
              />
              {o.label}
            </label>
          ))}
        </div>
        {listed === 'yes' && (
          <div className="mt-3">
            <label htmlFor="ugcCareGroup" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              UGC-CARE group
            </label>
            <select
              id="ugcCareGroup"
              name="ugcCareGroup"
              value={group}
              onChange={(e) => onChange('yes', e.target.value as UgcCareGroupValue)}
              className="w-full md:w-96 px-3 py-2.5 border border-blush-line dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-wine"
            >
              <option value="">Not sure</option>
              {(Object.keys(UGC_CARE_GROUP_LABELS) as Array<keyof typeof UGC_CARE_GROUP_LABELS>).map((g) => (
                <option key={g} value={g}>{UGC_CARE_GROUP_LABELS[g]}</option>
              ))}
            </select>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Used for NAAC reporting. DRD verifies this during review.
        </p>
      </fieldset>
    </div>
  );
}
