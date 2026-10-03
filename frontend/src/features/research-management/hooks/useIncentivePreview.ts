import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { researchService } from '@/features/research-management/services/research.service';
import type { IncentivePreviewPayload } from '@/features/research-management/utils/incentivePreview';

export const INCENTIVE_PREVIEW_DEBOUNCE_MS = 400;

const retryUnlessClientError = (count: number, err: unknown) => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return count < 1;
};

/**
 * Server-computed incentive & points per author for the form being filled in.
 * The payload is debounced (~400 ms) so typing does not fire a request per keystroke; the
 * previous answer stays on screen while the next one loads (`isUpdating`).
 *
 * @param payload  toIncentivePreviewPayload(buildSubmitData()), or null when there is nothing to preview
 */
export function useIncentivePreview(payload: IncentivePreviewPayload | null, delay = INCENTIVE_PREVIEW_DEBOUNCE_MS) {
  const key = payload ? JSON.stringify(payload) : null;
  // Debounced copy of the key; starts empty so the burst of state updates while the form
  // mounts also ends in a single request.
  const [debouncedKey, setDebouncedKey] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(key), delay);
    return () => clearTimeout(timer);
  }, [key, delay]);

  const query = useQuery({
    queryKey: ['research', 'incentive-preview', debouncedKey],
    queryFn: ({ signal }) => researchService.previewIncentive(JSON.parse(debouncedKey as string), signal),
    enabled: Boolean(debouncedKey),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: retryUnlessClientError,
    retryDelay: 300,
  });

  const settled = Boolean(key) && key === debouncedKey;
  // A failed request never leaves earlier numbers on screen.
  const data = query.isError ? undefined : query.data;
  const isError = query.isError && settled;
  return {
    /** The preview for the current payload (or the previous one while the next loads). */
    data,
    isError,
    /** Nothing to show yet: the first answer is still on its way. */
    isLoading: Boolean(key) && !data && !isError,
    /** The numbers on screen belong to an earlier version of the form. */
    isUpdating: Boolean(key) && Boolean(data) && (!settled || query.isFetching),
    refetch: query.refetch,
  };
}
