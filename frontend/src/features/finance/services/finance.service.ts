import api, { isAxiosError } from '@/shared/api/api';
import type {
  FinanceDashboard,
  MyIncentives,
  PayoutBatch,
  PayoutBatchDetail,
  PayoutDetail,
  PayoutLine,
  PayoutListParams,
  PayoutPage,
  BatchStatus,
  BudgetWarning,
  FinanceSettings,
  RecordPaymentInput,
} from '../types';

const BASE = '/finance';

type Envelope<T> = { success: boolean; data: T; message?: string; code?: string };
const unwrap = <T>(p: Promise<{ data: Envelope<T> }>) => p.then((r) => r.data.data);

/** With responseType 'blob', error bodies arrive as a Blob; turn them back into JSON so callers see code/message. */
async function rethrowBlobError(err: unknown): Promise<never> {
  if (isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      err.response.data = JSON.parse(text);
    } catch {
      /* leave as is */
    }
  }
  throw err;
}

function filenameFrom(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : fallback;
}

export const financeService = {
  getDashboard: (financialYear?: string) =>
    unwrap<FinanceDashboard>(api.get(`${BASE}/payouts/dashboard`, { params: { financialYear } })),

  listPayouts: ({ status, ...rest }: PayoutListParams = {}) =>
    unwrap<PayoutPage>(
      api.get(`${BASE}/payouts`, {
        params: {
          ...rest,
          status: status && status.length ? status.join(',') : undefined,
          search: rest.search?.trim() || undefined,
          workType: rest.workType || undefined,
          financialYear: rest.financialYear || undefined,
          cycleId: rest.cycleId || undefined,
          schoolId: rest.schoolId || undefined,
          departmentId: rest.departmentId || undefined,
        },
      }),
    ),

  getPayout: (id: string) => unwrap<PayoutDetail>(api.get(`${BASE}/payouts/${id}`)),

  recommend: (ids: string[], comments?: string) =>
    unwrap<{ recommended: number; budgetWarnings?: BudgetWarning[] }>(api.post(`${BASE}/payouts/recommend`, { ids, comments: comments?.trim() || undefined })),

  hold: (id: string, reason: string) => unwrap<PayoutLine>(api.post(`${BASE}/payouts/${id}/hold`, { reason })),

  adjust: (id: string, amount: number, reason: string) =>
    unwrap<PayoutLine>(api.post(`${BASE}/payouts/${id}/adjust`, { amount, reason })),

  cancelPayout: (id: string, reason: string) => unwrap<PayoutLine>(api.post(`${BASE}/payouts/${id}/cancel`, { reason })),

  listBatches: (params: { status?: BatchStatus; financialYear?: string } = {}) =>
    unwrap<PayoutBatch[]>(
      api.get(`${BASE}/batches`, { params: { status: params.status || undefined, financialYear: params.financialYear || undefined } }),
    ),

  createBatch: (ids: string[], title?: string) =>
    unwrap<PayoutBatch>(api.post(`${BASE}/batches`, { ids, title: title?.trim() || undefined })),

  getBatch: (id: string) => unwrap<PayoutBatchDetail>(api.get(`${BASE}/batches/${id}`)),

  approveBatch: (id: string, comments?: string, selfApprovalReason?: string) =>
    unwrap<PayoutBatch & { budgetWarnings?: BudgetWarning[] }>(api.post(`${BASE}/batches/${id}/approve`, {
      comments: comments?.trim() || undefined,
      selfApprovalReason: selfApprovalReason?.trim() || undefined,
    })),

  getSettings: () => unwrap<FinanceSettings>(api.get(`${BASE}/settings`)),
  updateSettings: (input: { allowSelfApproval: boolean; reason: string }) => unwrap<FinanceSettings>(api.put(`${BASE}/settings`, input)),

  payBatch: (id: string, input: RecordPaymentInput) => unwrap<PayoutBatch>(api.post(`${BASE}/batches/${id}/pay`, input)),

  cancelBatch: (id: string, reason: string) => unwrap<PayoutBatch>(api.post(`${BASE}/batches/${id}/cancel`, { reason })),

  /** Downloads the payroll sheet for an approved or paid batch. */
  async exportBatch(id: string, fallbackName = 'payout-batch.xlsx'): Promise<void> {
    const res = await api
      .get<Blob>(`${BASE}/batches/${id}/export`, { responseType: 'blob' })
      .catch(rethrowBlobError);
    const name = filenameFrom(res.headers?.['content-disposition'] as string | undefined, fallbackName);
    const url = URL.createObjectURL(res.data);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },

  getMyIncentives: () => unwrap<MyIncentives>(api.get(`${BASE}/my-incentives`)),
};

export type FinanceService = typeof financeService;
