'use client';

import { useCallback, useEffect, useState } from 'react';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';
import { reportsService } from '../services/reports.service';
import type { ReportParams, ReportSummary } from '../types';

interface State {
  data: ReportSummary | null;
  loading: boolean;
  error: string | null;
  status: number | null;
}

const isCanceled = (err: unknown) =>
  !!err && typeof err === 'object' && ((err as { name?: string }).name === 'CanceledError' || (err as { code?: string }).code === 'ERR_CANCELED');

/**
 * Loads the report preview for the chosen period. Changes are debounced and a newer request
 * cancels the one in flight, so quick picker changes never paint stale numbers.
 */
export function useReportSummary(params: ReportParams, { enabled = true, debounceMs = 300 }: { enabled?: boolean; debounceMs?: number } = {}) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, status: null });
  const [nonce, setNonce] = useState(0);
  const { fromYear, toYear, paperYearBasis } = params;
  const fyKey = params.financialYears.join(',');

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null, status: null }));
    const timer = window.setTimeout(async () => {
      try {
        const financialYears = fyKey ? fyKey.split(',') : [];
        const data = await reportsService.getSummary({ fromYear, toYear, paperYearBasis, financialYears }, controller.signal);
        setState({ data, loading: false, error: null, status: null });
      } catch (err) {
        if (isCanceled(err)) return;
        logger.warn('Failed to load report summary', err);
        const status = (err as { response?: { status?: number } })?.response?.status ?? null;
        setState((s) => ({ ...s, loading: false, status, error: extractErrorMessage(err, 'Could not load the report preview.') }));
      }
    }, debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fromYear, toYear, paperYearBasis, fyKey, nonce, debounceMs, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
