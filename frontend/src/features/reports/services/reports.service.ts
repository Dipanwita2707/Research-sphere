import api from '@/shared/api/api';
import type { DownloadProgress, NaacParams, ReportParams, ReportSummary } from '../types';

const BASE = '/reports';
const DOWNLOAD_TIMEOUT_MS = 180_000;

type Envelope<T> = { success: boolean; data: T; message?: string };

/** The Indian financial year containing a date, e.g. 2025-10-02 → 2025 (FY 2025-26). */
export function fyStartOf(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

/** 2024 → "2024-25". */
export function fyLabel(start: number): string {
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const naacQuery = (p: NaacParams) => ({ fromYear: p.fromYear, toYear: p.toYear, paperYearBasis: p.paperYearBasis });

/**
 * A blob request's JSON error arrives as a Blob. Decode it so callers get the server's message.
 */
async function decodeBlobError(err: unknown): Promise<never> {
  const response = (err as { response?: { data?: unknown } })?.response;
  if (response && response.data instanceof Blob) {
    try {
      response.data = JSON.parse(await response.data.text());
    } catch {
      // not JSON — keep the generic error
    }
  }
  throw err;
}

async function downloadXlsx(
  url: string,
  params: Record<string, string | number>,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  try {
    const res = await api.get<Blob>(url, {
      params,
      responseType: 'blob',
      timeout: DOWNLOAD_TIMEOUT_MS,
      signal,
      onDownloadProgress: (e) => onProgress?.({ loaded: e.loaded, total: e.total ?? null }),
    });
    return res.data;
  } catch (err) {
    return decodeBlobError(err);
  }
}

export const reportsService = {
  async getSummary(p: ReportParams, signal?: AbortSignal): Promise<ReportSummary> {
    const res = await api.get<Envelope<ReportSummary>>(`${BASE}/summary`, {
      params: { ...naacQuery(p), financialYears: p.financialYears.join(',') },
      signal,
    });
    return res.data.data;
  },

  downloadNaac(p: NaacParams, onProgress?: (p: DownloadProgress) => void, signal?: AbortSignal) {
    return downloadXlsx(`${BASE}/naac/criterion3`, naacQuery(p), onProgress, signal);
  },

  downloadNirf(financialYears: string[], onProgress?: (p: DownloadProgress) => void, signal?: AbortSignal) {
    return downloadXlsx(`${BASE}/nirf/research`, { financialYears: financialYears.join(',') }, onProgress, signal);
  },
};

/** Hand a blob to the browser as a file download. */
export function saveBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
}
