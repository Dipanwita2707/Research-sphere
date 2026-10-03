import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/auth/authStore';
import { financeService } from '../services/finance.service';
import type { BatchStatus, PayoutListParams, RecordPaymentInput } from '../types';

/** All finance queries live under this root so one invalidation refreshes every screen. */
export const financeKeys = {
  all: ['finance'] as const,
  dashboard: (fy: string) => ['finance', 'dashboard', fy] as const,
  payouts: (params: PayoutListParams) => ['finance', 'payouts', params] as const,
  payout: (id: string) => ['finance', 'payout', id] as const,
  batches: (params: { status?: BatchStatus; financialYear?: string }) => ['finance', 'batches', params] as const,
  batch: (id: string) => ['finance', 'batch', id] as const,
  mine: (userId: string | null) => ['finance', 'my-incentives', userId ?? 'anonymous'] as const,
  settings: ['finance', 'settings'] as const,
};

/** Don't hammer the server with retries for permission or not-found answers. */
const retryUnlessClientError = (count: number, err: unknown) => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return count < 1;
};

export function useFinanceDashboard(financialYear: string, enabled = true) {
  return useQuery({
    queryKey: financeKeys.dashboard(financialYear),
    queryFn: () => financeService.getDashboard(financialYear),
    enabled,
    staleTime: 30_000,
    retry: retryUnlessClientError,
  });
}

export function usePayouts(params: PayoutListParams, enabled = true) {
  return useQuery({
    queryKey: financeKeys.payouts(params),
    queryFn: () => financeService.listPayouts(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: retryUnlessClientError,
  });
}

export function usePayout(id: string | null) {
  return useQuery({
    queryKey: financeKeys.payout(id || ''),
    queryFn: () => financeService.getPayout(id as string),
    enabled: !!id,
    retry: retryUnlessClientError,
  });
}

export function useBatches(params: { status?: BatchStatus; financialYear?: string }, enabled = true) {
  return useQuery({
    queryKey: financeKeys.batches(params),
    queryFn: () => financeService.listBatches(params),
    enabled,
    staleTime: 15_000,
    retry: retryUnlessClientError,
  });
}

export function useBatch(id: string | null) {
  return useQuery({
    queryKey: financeKeys.batch(id || ''),
    queryFn: () => financeService.getBatch(id as string),
    enabled: !!id,
    retry: retryUnlessClientError,
  });
}

export function useMyIncentives() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: financeKeys.mine(userId),
    queryFn: () => financeService.getMyIncentives(),
    enabled: !!userId,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

function useFinanceMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export const useRecommendPayouts = () =>
  useFinanceMutation((v: { ids: string[]; comments?: string }) => financeService.recommend(v.ids, v.comments));

export const useHoldPayout = () =>
  useFinanceMutation((v: { id: string; reason: string }) => financeService.hold(v.id, v.reason));

export const useAdjustPayout = () =>
  useFinanceMutation((v: { id: string; amount: number; reason: string }) => financeService.adjust(v.id, v.amount, v.reason));

export const useCancelPayout = () =>
  useFinanceMutation((v: { id: string; reason: string }) => financeService.cancelPayout(v.id, v.reason));

export const useCreateBatch = () =>
  useFinanceMutation((v: { ids: string[]; title?: string }) => financeService.createBatch(v.ids, v.title));

export const useApproveBatch = () =>
  useFinanceMutation((v: { id: string; comments?: string; selfApprovalReason?: string }) =>
    financeService.approveBatch(v.id, v.comments, v.selfApprovalReason));

/** Finance rules for this university (self-approval). Defaults to the two-person rule while loading. */
export function useFinanceSettings(enabled = true) {
  return useQuery({
    queryKey: financeKeys.settings,
    queryFn: () => financeService.getSettings(),
    enabled,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

export const useUpdateFinanceSettings = () =>
  useFinanceMutation((v: { allowSelfApproval: boolean; reason: string }) => financeService.updateSettings(v));

export const usePayBatch = () =>
  useFinanceMutation((v: { id: string } & RecordPaymentInput) =>
    financeService.payBatch(v.id, { paymentReference: v.paymentReference, paymentDate: v.paymentDate, tds: v.tds }));

export const useCancelBatch = () =>
  useFinanceMutation((v: { id: string; reason: string }) => financeService.cancelBatch(v.id, v.reason));
