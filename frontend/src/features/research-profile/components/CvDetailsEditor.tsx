'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { CvDetails } from '@/features/research-profile/services/researchProfile.service';
import { panel } from './manageUi';

/**
 * Research CV sections the author fills in (education, experience, presentations, awards,
 * teaching, skills, memberships, references). Publications, grants, patents, metrics and the
 * contact block are added to the CV automatically. Saved with the rest of the profile settings.
 */

type RecordKey = 'education' | 'experience' | 'references';
type ListKey = 'presentations' | 'awards' | 'teaching' | 'skills' | 'memberships';

const RECORDS: Record<RecordKey, { title: string; hint: string; fields: Array<{ key: string; label: string; wide?: boolean }>; add: string }> = {
  education: {
    title: 'Education',
    hint: 'Newest first.',
    add: 'Add degree',
    fields: [
      { key: 'degree', label: 'Degree' },
      { key: 'institution', label: 'Institution' },
      { key: 'year', label: 'Year (or expected)' },
      { key: 'thesis', label: 'Thesis title (optional)', wide: true },
    ],
  },
  experience: {
    title: 'Research experience',
    hint: 'Roles, labs, field work or projects, with what you did.',
    add: 'Add role',
    fields: [
      { key: 'role', label: 'Role' },
      { key: 'organization', label: 'Organisation / lab' },
      { key: 'period', label: 'Period (e.g. 2021-present)' },
      { key: 'details', label: 'Contribution and tools (optional)', wide: true },
    ],
  },
  references: {
    title: 'References',
    hint: 'Printed only on your own copy of the CV; others see "available on request".',
    add: 'Add reference',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'designation', label: 'Designation' },
      { key: 'organization', label: 'Organisation' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone (optional)' },
    ],
  },
};

const LISTS: Array<{ key: ListKey; title: string; placeholder: string }> = [
  { key: 'presentations', title: 'Presentations and posters', placeholder: 'Keynote: Deepfakes and trust, IEEE ICCS 2024, Bengaluru' },
  { key: 'awards', title: 'Honors and awards', placeholder: 'Best Paper Award, ISCON 2023' },
  { key: 'teaching', title: 'Teaching experience', placeholder: 'Deep Learning (M.Tech), 2022-2025' },
  { key: 'skills', title: 'Skills', placeholder: 'Python' },
  { key: 'memberships', title: 'Professional memberships', placeholder: 'Senior Member, IEEE' },
];

const input = panel.input;
const textarea = panel.textarea;
const groupTitle = 'text-sm font-semibold text-ink dark:text-white';
const groupHint = 'text-xs text-ink-muted dark:text-gray-400';

export default function CvDetailsEditor({ value, onChange }: { value: CvDetails; onChange: (next: CvDetails) => void }) {
  const cv = value || {};
  const set = (patch: Partial<CvDetails>) => onChange({ ...cv, ...patch });

  const records = (key: RecordKey) => ((cv[key] as Array<Record<string, string>> | undefined) || []);
  const setRecord = (key: RecordKey, i: number, field: string, v: string) => {
    const next = records(key).map((r, idx) => (idx === i ? { ...r, [field]: v } : r));
    set({ [key]: next } as Partial<CvDetails>);
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="cv-scholar" className={groupTitle}>Google Scholar profile <span className="font-normal text-ink-subtle">(optional)</span></label>
        <input
          id="cv-scholar"
          type="url"
          value={cv.googleScholarUrl || ''}
          onChange={(e) => set({ googleScholarUrl: e.target.value })}
          placeholder="https://scholar.google.com/citations?user=..."
          className={`mt-1.5 ${input}`}
        />
      </div>

      {(Object.keys(RECORDS) as RecordKey[]).filter((k) => k !== 'references').map((key) => (
        <RecordList key={key} cfg={RECORDS[key]} rows={records(key)} onRow={(i, f, v) => setRecord(key, i, f, v)}
          onAdd={() => set({ [key]: [...records(key), {}] } as Partial<CvDetails>)}
          onRemove={(i) => set({ [key]: records(key).filter((_, idx) => idx !== i) } as Partial<CvDetails>)} />
      ))}

      <div className="grid gap-5 border-t border-blush-line/70 pt-6 md:grid-cols-2 dark:border-gray-700">
        {LISTS.map(({ key, title, placeholder }) => (
          <div key={key} className={key === 'presentations' ? 'md:col-span-2' : undefined}>
            <label htmlFor={`cv-${key}`} className={groupTitle}>{title}</label>
            <p className={groupHint}>One per line.</p>
            <textarea
              id={`cv-${key}`}
              rows={key === 'skills' ? 3 : 4}
              value={(cv[key] || []).join('\n')}
              onChange={(e) => set({ [key]: e.target.value.split('\n') } as Partial<CvDetails>)}
              onBlur={(e) => set({ [key]: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) } as Partial<CvDetails>)}
              placeholder={placeholder}
              className={`mt-1.5 ${textarea}`}
            />
          </div>
        ))}
      </div>

      <RecordList cfg={RECORDS.references} rows={records('references')} onRow={(i, f, v) => setRecord('references', i, f, v)}
        onAdd={() => set({ references: [...records('references'), {}] } as Partial<CvDetails>)}
        onRemove={(i) => set({ references: records('references').filter((_, idx) => idx !== i) } as Partial<CvDetails>)} />
    </div>
  );
}

function RecordList({ cfg, rows, onRow, onAdd, onRemove }: {
  cfg: (typeof RECORDS)[RecordKey];
  rows: Array<Record<string, string>>;
  onRow: (i: number, field: string, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <fieldset className="border-t border-blush-line/70 pt-6 dark:border-gray-700">
      <legend className="sr-only">{cfg.title}</legend>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className={groupTitle} aria-hidden="true">{cfg.title}</div>
          <p className={groupHint}>{cfg.hint}</p>
        </div>
        {rows.length < 15 && (
          <button type="button" onClick={onAdd} className={panel.btnSecondary}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {cfg.add}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-3">
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-blush-line px-4 py-4 text-center text-xs text-ink-muted dark:border-gray-600 dark:text-gray-400">
            Nothing added yet.
          </p>
        )}
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-blush-line bg-blush-light/50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">#{i + 1}</span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {cfg.fields.map((f) => (
                <label key={f.key} className={f.wide ? 'sm:col-span-3' : undefined}>
                  <span className="sr-only">{f.label}</span>
                  <input value={row[f.key] || ''} onChange={(e) => onRow(i, f.key, e.target.value)} placeholder={f.label} className={input} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
