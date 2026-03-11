import api from "@/shared/api/api";
import type {
  NoteConfig,
  CreatorInfo,
  Note,
  CreateNotePayload,
  NoteCopy,
} from "../types/noting.types";

const BASE = "/noting";

// ─── Facilitator Club type ──────────────────────────────────────────────────
export interface FacilitatorClub {
  id: string;
  clubId: string;
  name: string;
  categoryName: string | null;
  chairpersonId: string;
  chairpersonName: string | null;
}

// ─── Noting Permission Keys ─────────────────────────────────────────────────
export interface NotingPermissions {
  noting_create: boolean;
  noting_view_own: boolean;
  noting_view_department: boolean;
  noting_view_all: boolean;
  noting_approve: boolean;
  noting_forward: boolean;
  noting_return: boolean;
  noting_add_comment: boolean;
  noting_reject: boolean;
  noting_not_recommend: boolean;
  // Subcategory-level approval permissions
  event_approve?: boolean;
  dsw_approve_noting?: boolean;
  curriculum_approve?: boolean;
  exam_approve?: boolean;
  infrastructure_approve?: boolean;
  accounts_purchase_approve?: boolean;
  student_related_approve?: boolean;
  non_academic_resources_approve?: boolean;
  /** True if user is a chairperson of an active/approved club */
  isClubChairperson?: boolean;
  /** The club's UUID — only present for chairpersons */
  chairpersonClubId?: string;
  /** The club's name — only present for chairpersons */
  chairpersonClubName?: string;
}

/**
 * Derived UI-action permissions computed from the base permission set.
 * These are what the Approval Section buttons check before rendering.
 */
export interface NotingActionPermissions extends NotingPermissions {
  /** Approve button */
  canApprove: boolean;
  /** Reject button (noting_reject OR noting_approve OR noting_return) */
  canReject: boolean;
  /** Revert Back button */
  canRevert: boolean;
  /** Forward + Auto-Forward button */
  canForward: boolean;
  /** Recommend button */
  canRecommend: boolean;
  /** Not Recommend button */
  canNotRecommend: boolean;
}

export const notingService = {
  /**
   * Fetch the current user's noting permissions from the server.
   * The backend computes this from role-defaults + explicit dept assignments.
   * Returns both the raw permission flags AND derived UI-action booleans so
   * every consumer can just destructure what it needs.
   */
  getMyNotingPermissions: (): Promise<NotingActionPermissions> =>
    api.get(`${BASE}/my-permissions`).then((res) => {
      const raw: NotingPermissions = res.data.data;

      return {
        ...raw,
        // Derived action flags reflect only the Approval Actions section.
        canApprove: !!raw.noting_approve,
        canReject: !!raw.noting_reject,
        canRevert: !!raw.noting_return,
        canForward: !!raw.noting_forward,
        canRecommend: !!raw.noting_add_comment,
        canNotRecommend: !!raw.noting_not_recommend,
      };
    }),

  getConfig: (): Promise<NoteConfig> =>
    api.get(`${BASE}/config`, { timeout: 30000 }).then((res) => res.data.data),

  previewNotingId: (
    category: string,
    subcategory: string,
  ): Promise<{ notingId: string }> =>
    api
      .get(`${BASE}/preview-id`, { params: { category, subcategory } })
      .then((res) => res.data.data),

  getMyCreatorInfo: (): Promise<CreatorInfo> =>
    api
      .get(`${BASE}/my-creator-info`, { timeout: 30000 })
      .then((res) => res.data.data),

  /** Get clubs where the current user is the faculty facilitator (for event noting club dropdown) */
  getMyFacilitatorClubs: (): Promise<FacilitatorClub[]> =>
    api
      .get(`${BASE}/my-facilitator-clubs`, { timeout: 15000 })
      .then((res) => res.data.data),

  getCounts: (): Promise<{ mine: number; pending: number; handled: number }> =>
    api.get(`${BASE}/counts`).then((res) => res.data.data),

  list: (params?: {
    filter?: "mine" | "pending" | "handled" | "copies";
    status?: string;
    category?: string;
    search?: string;
    createdById?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    includeCounts?: boolean;
    /** Sub-filter for handled tab: 'approved' = approved+recommended, 'rejected' = rejected+not_recommended */
    handledAction?: "approved" | "rejected";
  }) =>
    api.get(BASE, { params, timeout: 30000 }).then((res) => ({
      data: res.data.data,
      pagination: res.data.pagination,
      counts: res.data.counts as
        | { mine: number; pending: number; handled: number }
        | undefined,
    })),

  getById: (id: string): Promise<Note> =>
    api.get(`${BASE}/${id}`, { timeout: 30000 }).then((res) => res.data.data),

  create: (payload: CreateNotePayload) =>
    api.post(BASE, payload, { timeout: 30000 }).then((res) => res.data),

  updateDraft: (
    id: string,
    payload: {
      category?: string;
      subcategory?: string;
      description?: string;
      approvalPeriod?: string;
      recurringFrequency?: string | null;
      policyCompliance?: "yes" | "no";
      amountRequired?: boolean;
      amount?: number | null;
      points?: string[];
      attachments?: {
        filePath: string;
        fileName: string;
        fileDescription?: string | null;
      }[];
      eventVisibilitySettings?: {
        visibleToRoles?: string[];
        studentFilterType?: 'all' | 'custom';
        allowedSchoolIds?: string[];
        allowedDepartmentIds?: string[];
        allowedProgramIds?: string[];
        allowedBatchYears?: number[];
        allowedSectionIds?: string[];
        allowExtraPasses?: boolean;
        maxExtraPassesPerUser?: number;
      } | null;
    },
  ) =>
    api
      .patch(`${BASE}/${id}`, payload, { timeout: 30000 })
      .then((res) => res.data),

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

  forward: (
    id: string,
    payload: { remarks: string; automated?: boolean; nextHolderId?: string },
  ) => api.post(`${BASE}/${id}/forward`, payload).then((res) => res.data),

  autoForward: (id: string, remarks?: string) =>
    api
      .post(`${BASE}/${id}/auto-forward`, {
        remarks: remarks || "Auto-forwarded to reporting manager",
      })
      .then((res) => res.data),

  recommend: (id: string, remarks: string) =>
    api.post(`${BASE}/${id}/recommend`, { remarks }).then((res) => res.data),

  notRecommend: (id: string, remarks: string) =>
    api
      .post(`${BASE}/${id}/not-recommend`, { remarks })
      .then((res) => res.data),

  sendCopy: (id: string, payload: { userIds: string[]; remarks: string }) =>
    api.post(`${BASE}/${id}/send-copy`, payload).then((res) => res.data),

  getCopies: (id: string): Promise<NoteCopy[]> =>
    api.get(`${BASE}/${id}/copies`).then((res) => res.data.data),

  getMyCopies: (params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    copies: NoteCopy[];
    myManagerId: string | null;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> =>
    api
      .get(`${BASE}/my-copies`, {
        timeout: 30000,
        ...(params ? { params } : {}),
      })
      .then((res) => {
        const d = res.data.data;
        if (Array.isArray(d)) {
          return { copies: d, myManagerId: null };
        }
        return {
          copies: d?.copies ?? [],
          myManagerId: d?.myManagerId ?? null,
          pagination: d?.pagination ?? undefined,
        };
      }),

  replyCopy: (
    copyId: string,
    payload: {
      remarks: string;
      attachments?: {
        filePath: string;
        fileName: string;
        fileDescription?: string;
      }[];
    },
  ) =>
    api.post(`${BASE}/copy/${copyId}/reply`, payload).then((res) => res.data),

  forwardCopy: (copyId: string, remarks: string) =>
    api
      .post(`${BASE}/copy/${copyId}/forward`, { remarks })
      .then((res) => res.data),

  completeCopy: (copyId: string) =>
    api.post(`${BASE}/copy/${copyId}/complete`).then((res) => res.data),

  searchEmployees: (q: string) =>
    api.get(`${BASE}/search-employees`, { params: { q } }).then(
      (res) =>
        res.data.data as {
          id: string;
          uid: string;
          role: string;
          displayName: string;
          empId: string;
          department: string;
          school: string;
        }[],
    ),

  getMyManager: () =>
    api.get(`${BASE}/my-manager`, { timeout: 30000 }).then(
      (res) =>
        res.data.data as {
          id: string;
          uid: string;
          displayName: string;
          empId: string;
          department: string;
          school: string;
        } | null,
    ),

  getForwardPrograms: (departmentId: string) =>
    api
      .get(`${BASE}/forward-options/programs`, { params: { departmentId } })
      .then(
        (res) =>
          res.data.data as {
            id: string;
            programName: string;
            programCode?: string;
          }[],
      ),

  getForwardUsers: (departmentId: string) =>
    api.get(`${BASE}/forward-options/users`, { params: { departmentId } }).then(
      (res) =>
        res.data.data as {
          id: string;
          uid: string;
          role: string;
          displayName: string;
        }[],
    ),

  uploadAttachment: (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "noting");
      api
        .post("/file-upload/upload-noting", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((res) => {
          if (res.data?.success && res.data?.data?.filePath)
            resolve(res.data.data.filePath);
          else reject(new Error(res.data?.message || "Upload failed"));
        })
        .catch(reject);
    }),

  /** Download attachment with auth; triggers browser download. */
  downloadAttachment: async (
    filePath: string,
    fileName: string,
  ): Promise<void> => {
    const base = api.defaults.baseURL || "";
    const url = `${base}/file-upload/download/${filePath}`;
    const res = await api.get(url, { responseType: "blob" });
    const blob = res.data as Blob;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || filePath.split("/").pop() || "attachment";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  },

  /** Open attachment in new tab (view); returns blob URL. Call URL.revokeObjectURL when done. */
  viewAttachment: async (filePath: string): Promise<string> => {
    const base = api.defaults.baseURL || "";
    const url = `${base}/file-upload/download/${filePath}`;
    const res = await api.get(url, { responseType: "blob" });
    const blob = res.data as Blob;
    return URL.createObjectURL(blob);
  },
};
