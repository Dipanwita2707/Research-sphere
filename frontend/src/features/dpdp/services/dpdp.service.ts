import api from '@/shared/api/api';
import type {
  BreachIncident,
  BreachInput,
  BreachUpdate,
  ConsentNotice,
  ConsentSubmission,
  ContactSettingsInput,
  DataPrincipalRequest,
  DpdpOverview,
  DpoContact,
  GuardianConsentInfo,
  MyConsentState,
  NewRequestInput,
  Nominee,
  NomineeInput,
  NoticeInput,
  PublicPrivacy,
  RequestFilters,
  RequestListResult,
  RetentionPolicy,
} from '../types';

interface Envelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

/** Unwraps `{ success, data }` responses (falls back to the raw body). */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Envelope<T>)) {
    return (body as Envelope<T>).data as T;
  }
  return body as T;
}

const BASE = '/dpdp';

function filenameFromDisposition(header: unknown, fallback: string): string {
  if (typeof header !== 'string') return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/"/g, ''));
    } catch {
      /* ignore */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] || fallback;
}

/** Turns a Blob error body (from responseType: 'blob') back into JSON so error messages survive. */
async function normaliseBlobError(error: unknown): Promise<never> {
  const err = error as { response?: { data?: unknown } };
  const data = err?.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const text = await data.text();
      (err.response as { data?: unknown }).data = JSON.parse(text);
    } catch {
      /* leave as is */
    }
  }
  throw error;
}

export const dpdpService = {
  // ---------------- Data principal ----------------
  async getMyConsents(): Promise<MyConsentState> {
    const res = await api.get(`${BASE}/consents/me`);
    return unwrap<MyConsentState>(res.data);
  },

  async submitConsent(payload: ConsentSubmission): Promise<MyConsentState> {
    const res = await api.post(`${BASE}/consents`, payload);
    return unwrap<MyConsentState>(res.data);
  },

  async withdrawConsent(purpose: string): Promise<MyConsentState> {
    const res = await api.post(`${BASE}/consents/${encodeURIComponent(purpose)}/withdraw`);
    return unwrap<MyConsentState>(res.data);
  },

  async getMyRequests(): Promise<DataPrincipalRequest[]> {
    const res = await api.get(`${BASE}/requests/me`);
    return unwrap<DataPrincipalRequest[]>(res.data) || [];
  },

  async createRequest(input: NewRequestInput): Promise<DataPrincipalRequest> {
    const res = await api.post(`${BASE}/requests`, input);
    return unwrap<DataPrincipalRequest>(res.data);
  },

  /** Downloads the caller's personal-data export and triggers a browser save. */
  async downloadMyData(): Promise<string> {
    try {
      const res = await api.get(`${BASE}/export/me`, { responseType: 'blob' });
      const headers = res.headers as Record<string, unknown>;
      const filename = filenameFromDisposition(
        headers['content-disposition'],
        `my-data-${new Date().toISOString().slice(0, 10)}.json`,
      );
      const blob =
        res.data instanceof Blob
          ? res.data
          : new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return filename;
    } catch (error) {
      return normaliseBlobError(error);
    }
  },

  async getMyNominee(): Promise<Nominee | null> {
    const res = await api.get(`${BASE}/nominee/me`);
    return unwrap<Nominee | null>(res.data) ?? null;
  },

  async saveMyNominee(input: NomineeInput): Promise<Nominee> {
    const res = await api.put(`${BASE}/nominee/me`, input);
    return unwrap<Nominee>(res.data);
  },

  async deleteMyNominee(): Promise<void> {
    await api.delete(`${BASE}/nominee/me`);
  },

  async getContact(): Promise<DpoContact> {
    const res = await api.get(`${BASE}/contact`);
    return unwrap<DpoContact>(res.data) || {};
  },

  // ---------------- Public (no auth) ----------------
  async getPublicPrivacy(universitySlug: string): Promise<PublicPrivacy> {
    const res = await api.get(`${BASE}/public/${encodeURIComponent(universitySlug)}/privacy`);
    return unwrap<PublicPrivacy>(res.data);
  },

  async getGuardianConsent(token: string): Promise<GuardianConsentInfo> {
    const res = await api.get(`${BASE}/public/guardian-consent/${encodeURIComponent(token)}`);
    return unwrap<GuardianConsentInfo>(res.data);
  },

  async respondGuardianConsent(token: string, approve: boolean): Promise<{ verified: boolean }> {
    const res = await api.post(`${BASE}/public/guardian-consent/${encodeURIComponent(token)}`, { approve });
    return unwrap<{ verified: boolean }>(res.data);
  },

  // ---------------- Admin / DPO ----------------
  async getOverview(): Promise<DpdpOverview> {
    const res = await api.get(`${BASE}/admin/overview`);
    return unwrap<DpdpOverview>(res.data);
  },

  async listRequests(filters: RequestFilters = {}): Promise<RequestListResult> {
    const params: Record<string, string | number> = {};
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    const res = await api.get(`${BASE}/admin/requests`, { params });
    const data = unwrap<RequestListResult | DataPrincipalRequest[]>(res.data);
    if (Array.isArray(data)) return { items: data, total: data.length };
    return { items: data?.items || [], total: data?.total ?? 0 };
  },

  async updateRequest(id: string, body: { status?: string; response?: string }): Promise<DataPrincipalRequest> {
    const res = await api.patch(`${BASE}/admin/requests/${id}`, body);
    return unwrap<DataPrincipalRequest>(res.data);
  },

  /** `force` erases even when the user still has open workflows (backend answers 409 otherwise). */
  async fulfilRequest(id: string, body: { response?: string; force?: boolean }): Promise<DataPrincipalRequest> {
    const res = await api.post(`${BASE}/admin/requests/${id}/fulfil`, body);
    return unwrap<DataPrincipalRequest>(res.data);
  },

  async listNotices(): Promise<ConsentNotice[]> {
    const res = await api.get(`${BASE}/admin/notices`);
    return unwrap<ConsentNotice[]>(res.data) || [];
  },

  async createNotice(input: NoticeInput): Promise<ConsentNotice> {
    const res = await api.post(`${BASE}/admin/notices`, input);
    return unwrap<ConsentNotice>(res.data);
  },

  async activateNotice(id: string): Promise<ConsentNotice> {
    const res = await api.post(`${BASE}/admin/notices/${id}/activate`);
    return unwrap<ConsentNotice>(res.data);
  },

  async listBreaches(): Promise<BreachIncident[]> {
    const res = await api.get(`${BASE}/admin/breaches`);
    return unwrap<BreachIncident[]>(res.data) || [];
  },

  async createBreach(input: BreachInput): Promise<BreachIncident> {
    const res = await api.post(`${BASE}/admin/breaches`, input);
    return unwrap<BreachIncident>(res.data);
  },

  async updateBreach(id: string, body: BreachUpdate): Promise<BreachIncident> {
    const res = await api.patch(`${BASE}/admin/breaches/${id}`, body);
    return unwrap<BreachIncident>(res.data);
  },

  async notifyPrincipals(id: string, message: string): Promise<{ notified: number; total?: number }> {
    const res = await api.post(`${BASE}/admin/breaches/${id}/notify-principals`, { message });
    return unwrap<{ notified: number; total?: number }>(res.data);
  },

  async listRetentionPolicies(): Promise<RetentionPolicy[]> {
    const res = await api.get(`${BASE}/admin/retention-policies`);
    return unwrap<RetentionPolicy[]>(res.data) || [];
  },

  async saveRetentionPolicies(
    policies: Array<{ category: string; retentionDays: number; action: string }>,
  ): Promise<RetentionPolicy[]> {
    const res = await api.put(`${BASE}/admin/retention-policies`, { policies });
    return unwrap<RetentionPolicy[]>(res.data) || [];
  },

  async saveContactSettings(input: ContactSettingsInput): Promise<DpoContact> {
    const res = await api.put(`${BASE}/admin/contact`, input);
    return unwrap<DpoContact>(res.data);
  },
};

export default dpdpService;
