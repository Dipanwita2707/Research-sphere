'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { ui } from '@/components/analytics/theme';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { saveBlob } from '../services/reports.service';
import type { DownloadProgress } from '../types';

type Phase = 'idle' | 'preparing' | 'downloading' | 'done' | 'error';

interface Props {
  label: string;
  filename: string;
  disabled?: boolean;
  disabledReason?: string;
  download: (onProgress: (p: DownloadProgress) => void, signal: AbortSignal) => Promise<Blob>;
}

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024)).toLocaleString('en-IN')} KB`;

/**
 * Fetches a workbook as a blob and saves it, showing server-preparation and transfer
 * progress. Errors are announced inline (role="alert") and can be dismissed or retried.
 */
export function DownloadButton({ label, filename, disabled, disabledReason, download }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (phase !== 'done') return undefined;
    const t = window.setTimeout(() => setPhase('idle'), 4000);
    return () => window.clearTimeout(t);
  }, [phase]);

  const busy = phase === 'preparing' || phase === 'downloading';

  const start = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setProgress(null);
    setPhase('preparing');
    try {
      const blob = await download((p) => {
        setProgress(p);
        setPhase('downloading');
      }, controller.signal);
      saveBlob(blob, filename);
      setPhase('done');
    } catch (err) {
      if (controller.signal.aborted) {
        setPhase('idle');
        return;
      }
      logger.error('Report download failed', err);
      setError(extractErrorMessage(err, 'The workbook could not be generated. Please try again.'));
      setPhase('error');
    }
  };

  const percent = progress?.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          disabled={disabled || busy}
          className={`${ui.btnPrimary} disabled:cursor-not-allowed`}
          aria-describedby={disabled && disabledReason ? `${filename}-disabled` : undefined}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : phase === 'done' ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          {phase === 'preparing' ? 'Preparing workbook…' : phase === 'downloading' ? 'Downloading…' : phase === 'done' ? 'Downloaded' : label}
        </button>
        {busy && (
          <button type="button" onClick={() => controllerRef.current?.abort()} className={ui.btnSecondary}>
            Cancel
          </button>
        )}
        <span className="truncate text-xs text-stone-500 dark:text-gray-400" title={filename}>{filename}</span>
      </div>

      {disabled && disabledReason && (
        <p id={`${filename}-disabled`} className="text-xs text-stone-500 dark:text-gray-400">{disabledReason}</p>
      )}

      <div aria-live="polite" className="sr-only">
        {phase === 'preparing' ? 'Preparing workbook' : phase === 'downloading' ? `Downloading ${percent ?? ''}%` : phase === 'done' ? `${filename} downloaded` : ''}
      </div>

      {busy && (
        <div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700"
            role="progressbar"
            aria-label="Download progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
          >
            {percent === null ? (
              <div className="h-full w-1/3 animate-pulse rounded-full bg-wine/70" />
            ) : (
              <div className="h-full rounded-full bg-wine transition-[width]" style={{ width: `${percent}%` }} />
            )}
          </div>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-gray-400">
            {phase === 'preparing'
              ? 'Collecting records and building sheets…'
              : `${kb(progress?.loaded ?? 0)}${progress?.total ? ` of ${kb(progress.total)}` : ''}`}
          </p>
        </div>
      )}

      {phase === 'error' && error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={start} className="font-semibold underline underline-offset-2">Retry</button>
          <button type="button" onClick={() => setPhase('idle')} aria-label="Dismiss error" className="rounded p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/40">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
