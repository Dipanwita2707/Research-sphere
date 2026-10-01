'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { researchIntelligenceService as svc } from '../../services/researchIntelligence.service';
import type { UniversityModuleState } from '../../types';

/**
 * Superadmin control: turn Research Intelligence on or off for one university.
 * Independent of the university's subscription plan.
 */
export function UniversityModulesCard({ universityId }: { universityId: string }) {
  const [state, setState] = useState<UniversityModuleState | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    svc
      .listUniversityModules()
      .then((all) => {
        if (!alive) return;
        const s = all.find((u) => u.universityId === universityId) || null;
        setState(s);
        setNotes(s?.notes || '');
      })
      .catch((e) => alive && setError(e?.response?.data?.message || 'Could not load module access.'));
    return () => {
      alive = false;
    };
  }, [universityId]);

  const toggle = async () => {
    if (!state) return;
    const enabling = !state.enabled;
    if (!enabling && !window.confirm(`Turn off Research Intelligence for ${state.name}? Every user there loses access immediately (their data is kept).`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await svc.setUniversityModule(universityId, { enabled: enabling, notes });
      setState({ ...state, ...r });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not update.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-wine/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-wine" />
        </div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider dark:text-gray-400">Modules</h3>
      </div>
      {!state && !error ? (
        <Loader2 className="w-5 h-5 animate-spin text-wine" />
      ) : error && !state ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        state && (
          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Research Intelligence</p>
                <p className="text-xs text-gray-500">AI research assistant, topic taxonomy, expertise &amp; knowledge graph. Not tied to the plan.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={state.enabled}
                onClick={toggle}
                disabled={busy}
                className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${state.enabled ? 'bg-wine' : 'bg-gray-300 dark:bg-gray-700'}`}
                title={state.enabled ? 'Turn off' : 'Turn on'}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${state.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {state.enabled
                ? `On since ${state.enabledAt ? new Date(state.enabledAt).toLocaleDateString('en-IN') : '—'} · ${state.userGrants} individual grant(s)`
                : state.disabledAt
                  ? `Off since ${new Date(state.disabledAt).toLocaleDateString('en-IN')}`
                  : 'Off (never enabled)'}
            </p>
            <input
              value={notes}
              maxLength={512}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note (e.g. pilot until March)"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs dark:bg-gray-900 dark:border-gray-800 dark:text-gray-100"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )
      )}
    </div>
  );
}
