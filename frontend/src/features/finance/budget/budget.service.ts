import api, { isAxiosError } from '@/shared/api/api';
import type {
  AllocationInput, BudgetAnalytics, BudgetInput, BudgetEvent, BudgetTreeResponse, CycleInput, CycleList, CyclePolicies, IncentiveCycle,
  NodeDetail, ResearchBudget, BudgetNodeType,
} from './types';

const BASE = '/finance/budgets';
type Envelope<T> = { success: boolean; data: T };
const unwrap = <T>(p: Promise<{ data: Envelope<T> }>) => p.then((r) => r.data.data);

async function rethrowBlobError(err: unknown): Promise<never> {
  if (isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      err.response.data = JSON.parse(await err.response.data.text());
    } catch {
      /* leave as is */
    }
  }
  throw err;
}

/** `cycle` is an incentive cycle id, or "current" (the cycle containing today). */
export const budgetService = {
  listCycles: () => unwrap<CycleList>(api.get(`${BASE}/cycles`)),
  createCycle: (input: CycleInput) => unwrap<IncentiveCycle & { relinkedPayoutLines: number }>(api.post(`${BASE}/cycles`, input)),
  updateCycle: (id: string, input: CycleInput) => unwrap<IncentiveCycle & { relinkedPayoutLines: number }>(api.put(`${BASE}/cycles/${id}`, input)),
  deleteCycle: (id: string) => unwrap<{ id: string; deleted: boolean }>(api.delete(`${BASE}/cycles/${id}`)),
  getPolicies: (cycle: string) => unwrap<CyclePolicies>(api.get(`${BASE}/${cycle}/policies`)),
  getTree: (cycle: string) => unwrap<BudgetTreeResponse>(api.get(`${BASE}/${cycle}`)),
  getAnalytics: (cycle: string) => unwrap<BudgetAnalytics>(api.get(`${BASE}/${cycle}/analytics`)),
  getNode: (cycle: string, nodeType: BudgetNodeType, nodeId: string) =>
    unwrap<NodeDetail>(api.get(`${BASE}/${cycle}/nodes/${nodeType}/${nodeId}`)),
  history: (cycle: string, params: { nodeType?: BudgetNodeType; nodeId?: string } = {}) =>
    unwrap<BudgetEvent[]>(api.get(`${BASE}/${cycle}/history`, { params })),
  saveBudget: (cycle: string, input: BudgetInput) => unwrap<ResearchBudget>(api.put(`${BASE}/${cycle}`, input)),
  saveAllocation: (cycle: string, input: AllocationInput) => unwrap<unknown>(api.put(`${BASE}/${cycle}/allocations`, input)),

  async exportXlsx(cycle: string, fileLabel: string): Promise<void> {
    const res = await api.get<Blob>(`${BASE}/${cycle}/export`, { responseType: 'blob' }).catch(rethrowBlobError);
    const url = URL.createObjectURL(res.data);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `research-budget-${fileLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cycle'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },
};
