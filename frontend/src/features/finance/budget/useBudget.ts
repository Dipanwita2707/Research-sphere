import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { budgetService } from './budget.service';
import type { AllocationInput, BudgetInput, BudgetNodeType, CycleInput } from './types';

/** Under the finance root so payout actions (which change utilisation) refresh budgets too. */
export const budgetKeys = {
  all: ['finance', 'budgets'] as const,
  cycles: ['finance', 'budgets', 'cycles'] as const,
  policies: (cycle: string) => ['finance', 'budgets', 'policies', cycle] as const,
  tree: (cycle: string) => ['finance', 'budgets', 'tree', cycle] as const,
  analytics: (cycle: string) => ['finance', 'budgets', 'analytics', cycle] as const,
  node: (cycle: string, type: string, id: string) => ['finance', 'budgets', 'node', cycle, type, id] as const,
};

const retryUnlessClientError = (count: number, err: unknown) => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return count < 1;
};

export function useBudgetTree(cycle: string, enabled = true) {
  return useQuery({
    queryKey: budgetKeys.tree(cycle),
    queryFn: () => budgetService.getTree(cycle),
    enabled: enabled && !!cycle,
    staleTime: 30_000,
    retry: retryUnlessClientError,
  });
}

export function useBudgetAnalytics(cycle: string, enabled = true) {
  return useQuery({
    queryKey: budgetKeys.analytics(cycle),
    queryFn: () => budgetService.getAnalytics(cycle),
    enabled: enabled && !!cycle,
    staleTime: 30_000,
    retry: retryUnlessClientError,
  });
}

export function useBudgetNode(cycle: string, nodeType: BudgetNodeType | null, nodeId: string | null) {
  return useQuery({
    queryKey: budgetKeys.node(cycle, nodeType || '', nodeId || ''),
    queryFn: () => budgetService.getNode(cycle, nodeType as BudgetNodeType, nodeId as string),
    enabled: !!nodeType && !!nodeId,
    staleTime: 15_000,
    retry: retryUnlessClientError,
  });
}

export function useSaveBudget(cycle: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BudgetInput) => budgetService.saveBudget(cycle, input),
    onSettled: () => qc.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}

export function useSaveAllocation(cycle: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AllocationInput) => budgetService.saveAllocation(cycle, input),
    onSettled: () => qc.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}

export function useCycles(enabled = true) {
  return useQuery({
    queryKey: budgetKeys.cycles,
    queryFn: () => budgetService.listCycles(),
    enabled,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

export function useCyclePolicies(cycle: string, enabled = true) {
  return useQuery({
    queryKey: budgetKeys.policies(cycle),
    queryFn: () => budgetService.getPolicies(cycle),
    enabled: enabled && !!cycle,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

/** Create (no id) or update a cycle. Moving dates re-links payout lines, so every budget view refreshes. */
export function useSaveCycle(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CycleInput) => (id ? budgetService.updateCycle(id, input) : budgetService.createCycle(input)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}

export function useDeleteCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => budgetService.deleteCycle(id),
    onSettled: () => qc.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}
