import api from '@/shared/api/api';
import type { NoteConfig, CreatorInfo, Note, CreateNotePayload } from '../types/noting.types';

const BASE = '/noting';

export const notingService = {
  getConfig: (): Promise<NoteConfig> =>
    api.get(`${BASE}/config`).then((res) => res.data.data),

  previewNotingId: (category: string, subcategory: string): Promise<{ notingId: string }> =>
    api.get(`${BASE}/preview-id`, { params: { category, subcategory } }).then((res) => res.data.data),

  getMyCreatorInfo: (): Promise<CreatorInfo> =>
    api.get(`${BASE}/my-creator-info`).then((res) => res.data.data),

  getCounts: (): Promise<{ mine: number; pending: number; handled: number }> =>
    api.get(`${BASE}/counts`).then((res) => res.data.data),

  list: (params?: { 
    filter?: 'mine' | 'pending' | 'handled'; 
    status?: string; 
    category?: string; 
    search?: string;
    createdById?: string;
    startDate?: string;
    endDate?: string;
    page?: number; 
    limit?: number;
    includeCounts?: boolean;
  }) =>
    api.get(BASE, { params }).then((res) => ({
      data: res.data.data,
      pagination: res.data.pagination,
      counts: res.data.counts as { mine: number; pending: number; handled: number } | undefined,
    })),

  getById: (id: string): Promise<Note> =>
    api.get(`${BASE}/${id}`).then((res) => res.data.data),

  create: (payload: CreateNotePayload) =>
    api.post(BASE, payload).then((res) => res.data),

  updateDraft: (
    id: string,
    payload: {
      description?: string;
      approvalPeriod?: string;
      recurringFrequency?: string | null;
      policyCompliance?: 'yes' | 'no';
      amountRequired?: boolean;
      amount?: number | null;
      points?: string[];
      attachments?: { filePath: string; fileName: string; fileDescription?: string | null }[];
    }
  ) => api.patch(`${BASE}/${id}`, payload).then((res) => res.data),

  deleteDraft: (id: string) =>
    api.delete(`${BASE}/${id}`).then((res) => res.data),

  submitDraft: (id: string) =>
    api.post(`${BASE}/${id}/submit`).then((res) => res.data),

  approve: (id: string, remarks?: string) =>
    api.post(`${BASE}/${id}/approve`, { remarks }).then((res) => res.data),

  reject: (id: string, remarks: string) =>
    api.post(`${BASE}/${id}/reject`, { remarks }).then((res) => res.data),

  revert: (id: string, remarks: string) =>
    api.post(`${BASE}/${id}/revert`, { remarks }).then((res) => res.data),

  forward: (id: string, payload: { remarks: string; automated?: boolean; nextHolderId?: string }) =>
    api.post(`${BASE}/${id}/forward`, payload).then((res) => res.data),

  autoForward: (id: string, remarks?: string) =>
    api.post(`${BASE}/${id}/auto-forward`, { remarks: remarks || 'Auto-forwarded to reporting manager' }).then((res) => res.data),

  searchEmployees: (q: string) =>
    api.get(`${BASE}/search-employees`, { params: { q } }).then((res) => res.data.data as { id: string; uid: string; role: string; displayName: string; empId: string; department: string; school: string }[]),

  getMyManager: () =>
    api.get(`${BASE}/my-manager`).then((res) => res.data.data as { id: string; uid: string; displayName: string; empId: string; department: string; school: string } | null),

  getForwardPrograms: (departmentId: string) =>
    api.get(`${BASE}/forward-options/programs`, { params: { departmentId } }).then((res) => res.data.data as { id: string; programName: string; programCode?: string }[]),

  getForwardUsers: (departmentId: string) =>
    api.get(`${BASE}/forward-options/users`, { params: { departmentId } }).then((res) => res.data.data as { id: string; uid: string; role: string; displayName: string }[]),

  uploadAttachment: (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'noting');
      api
        .post('/file-upload/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((res) => {
          if (res.data?.success && res.data?.data?.filePath) resolve(res.data.data.filePath);
          else reject(new Error(res.data?.message || 'Upload failed'));
        })
        .catch(reject);
    }),

  /** Download attachment with auth; triggers browser download. */
  downloadAttachment: async (filePath: string, fileName: string): Promise<void> => {
    const base = api.defaults.baseURL || '';
    const url = `${base}/file-upload/download/${filePath}`;
    const res = await api.get(url, { responseType: 'blob' });
    const blob = res.data as Blob;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || filePath.split('/').pop() || 'attachment';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  },

  /** Open attachment in new tab (view); returns blob URL. Call URL.revokeObjectURL when done. */
  viewAttachment: async (filePath: string): Promise<string> => {
    const base = api.defaults.baseURL || '';
    const url = `${base}/file-upload/download/${filePath}`;
    const res = await api.get(url, { responseType: 'blob' });
    const blob = res.data as Blob;
    return URL.createObjectURL(blob);
  },
};
