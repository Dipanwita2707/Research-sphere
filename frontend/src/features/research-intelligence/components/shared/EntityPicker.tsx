'use client';

import React, { useId, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { useDebounced, useEntitySearch } from '../../hooks/useKnowledgeGraph';
import type { EntitySearchResult } from '../../graph.types';

export interface PickedEntity {
  id: string;
  label: string;
  sub?: string | null;
}

type Kind = 'researchers' | 'schools' | 'departments';

function optionsFor(kind: Kind, data: EntitySearchResult | undefined): PickedEntity[] {
  if (!data) return [];
  if (kind === 'researchers') return data.researchers.map((r) => ({ id: r.id, label: r.name, sub: [r.designation, r.department].filter(Boolean).join(' · ') }));
  if (kind === 'schools') return data.schools.map((s) => ({ id: s.id, label: s.name, sub: s.shortName }));
  return data.departments.map((d) => ({ id: d.id, label: d.name, sub: d.school }));
}

/** Accessible typeahead (combobox) over /search/entities. */
export function EntityPicker({
  kind,
  label,
  placeholder,
  value,
  onChange,
  className = '',
}: {
  kind: Kind;
  label: string;
  placeholder: string;
  value: PickedEntity | null;
  onChange: (v: PickedEntity | null) => void;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text, 250);
  const search = useEntitySearch(q, open && !value);
  const options = optionsFor(kind, search.data);

  const pick = (o: PickedEntity) => {
    onChange(o);
    setText('');
    setOpen(false);
  };

  if (value) {
    return (
      <div className={className}>
        <span className={`${ui.label} mb-1 block`}>{label}</span>
        <div className="flex h-9 items-center gap-2 rounded-lg border border-wine/30 bg-wine/5 px-3 text-sm text-stone-800 dark:border-amber/30 dark:bg-wine/20 dark:text-gray-100">
          <span className="min-w-0 flex-1 truncate" title={value.label}>{value.label}</span>
          <button type="button" onClick={() => onChange(null)} aria-label={`Clear ${label.toLowerCase()}`} className="rounded p-0.5 text-stone-500 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 dark:text-gray-300 dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const listId = `${id}-list`;
  const showList = open && text.trim().length >= 2;
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={`${id}-input`} className={`${ui.label} mb-1 block`}>
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && options[active]) {
              e.preventDefault();
              pick(options[active]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          className={`${ui.input} w-full pl-8`}
        />
        {search.isFetching && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" aria-hidden />}
      </div>
      {showList && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute z-30 mt-1 max-h-72 w-full min-w-[240px] overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-stone-500 dark:text-gray-400" role="option" aria-selected={false} aria-disabled>
              {search.isFetching ? 'Searching…' : search.isError ? 'Search failed' : 'No matches'}
            </li>
          ) : (
            options.map((o, i) => (
              <li
                key={o.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-wine/10 dark:bg-wine/30' : ''}`}
              >
                <div className="truncate font-medium text-stone-800 dark:text-gray-100">{o.label}</div>
                {o.sub && <div className="truncate text-xs text-stone-500 dark:text-gray-400">{o.sub}</div>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
