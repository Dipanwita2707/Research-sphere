/**
 * Mail API Service
 * All API calls for the mail module
 */
import api from '@/shared/api/api';
import type {
  MailApiResponse,
  MailThread,
  MailConversation,
  MailLabel,
  MailDraft,
  MailCounts,
  ComposeMail,
  ReplyMail,
  MailRecipientOption,
  MailSearchParams,
  MailMessage,
  MailAttachment,
} from '../types';

const BASE_URL = '/mail';

// ============ COMPOSE ====
export const sendMail = async (data: ComposeMail): Promise<MailApiResponse<{ thread: MailThread; message: MailMessage }>> => {
  const response = await api.post(`${BASE_URL}/compose/send`, data);
  return response.data;
};

export const replyToMessage = async (messageId: string, data: ReplyMail): Promise<MailApiResponse<MailMessage>> => {
  const response = await api.post(`${BASE_URL}/compose/reply/${messageId}`, data);
  return response.data;
};

export const replyAllToMessage = async (messageId: string, data: ReplyMail): Promise<MailApiResponse<MailMessage>> => {
  const response = await api.post(`${BASE_URL}/compose/reply-all/${messageId}`, data);
  return response.data;
};

export const forwardMessage = async (messageId: string, data: ComposeMail): Promise<MailApiResponse<{ thread: MailThread; message: MailMessage }>> => {
  const response = await api.post(`${BASE_URL}/compose/forward/${messageId}`, data);
  return response.data;
};

// ============ INBOX / VIEWS ====
export const getInbox = async (page = 1, limit = 50): Promise<MailApiResponse<MailThread[]>> => {
  const response = await api.get(`${BASE_URL}/inbox`, { params: { page, limit } });
  return response.data;
};

export const getSent = async (page = 1, limit = 50): Promise<MailApiResponse<MailThread[]>> => {
  const response = await api.get(`${BASE_URL}/inbox/sent`, { params: { page, limit } });
  return response.data;
};

export const getStarred = async (page = 1, limit = 50): Promise<MailApiResponse<MailThread[]>> => {
  const response = await api.get(`${BASE_URL}/inbox/starred`, { params: { page, limit } });
  return response.data;
};

export const getTrash = async (page = 1, limit = 50): Promise<MailApiResponse<MailThread[]>> => {
  const response = await api.get(`${BASE_URL}/inbox/trash`, { params: { page, limit } });
  return response.data;
};

export const getMailCounts = async (): Promise<MailApiResponse<MailCounts>> => {
  const response = await api.get(`${BASE_URL}/inbox/counts`);
  return response.data;
};

// ============ THREAD ====
export const getThread = async (threadId: string): Promise<MailApiResponse<MailConversation>> => {
  const response = await api.get(`${BASE_URL}/threads/${threadId}`);
  return response.data;
};

// ============ ACTIONS ====
export const markRead = async (threadId: string): Promise<MailApiResponse<null>> => {
  const response = await api.post(`${BASE_URL}/inbox/mark-read/${threadId}`);
  return response.data;
};

export const markUnread = async (threadId: string): Promise<MailApiResponse<null>> => {
  const response = await api.post(`${BASE_URL}/inbox/mark-unread/${threadId}`);
  return response.data;
};

export const toggleStar = async (threadId: string): Promise<MailApiResponse<{ isStarred: boolean }>> => {
  const response = await api.post(`${BASE_URL}/inbox/star/${threadId}`);
  return response.data;
};

export const deleteThread = async (threadId: string): Promise<MailApiResponse<null>> => {
  const response = await api.delete(`${BASE_URL}/inbox/delete/${threadId}`);
  return response.data;
};

export const restoreThread = async (threadId: string): Promise<MailApiResponse<null>> => {
  const response = await api.post(`${BASE_URL}/inbox/restore/${threadId}`);
  return response.data;
};

export const archiveThread = async (threadId: string): Promise<MailApiResponse<null>> => {
  const response = await api.post(`${BASE_URL}/inbox/archive/${threadId}`);
  return response.data;
};

export const unarchiveThread = async (threadId: string): Promise<MailApiResponse<null>> => {
  const response = await api.post(`${BASE_URL}/inbox/unarchive/${threadId}`);
  return response.data;
};

// ============ LABELS ====
export const getLabels = async (): Promise<MailApiResponse<MailLabel[]>> => {
  const response = await api.get(`${BASE_URL}/labels`);
  return response.data;
};

export const createLabel = async (data: { name: string; color?: string; icon?: string }): Promise<MailApiResponse<MailLabel>> => {
  const response = await api.post(`${BASE_URL}/labels`, data);
  return response.data;
};

export const updateLabel = async (labelId: string, data: { name?: string; color?: string; icon?: string }): Promise<MailApiResponse<MailLabel>> => {
  const response = await api.put(`${BASE_URL}/labels/${labelId}`, data);
  return response.data;
};

export const deleteLabel = async (labelId: string): Promise<MailApiResponse<null>> => {
  const response = await api.delete(`${BASE_URL}/labels/${labelId}`);
  return response.data;
};

export const applyLabel = async (data: { messageId?: string; threadId?: string; labelId: string }): Promise<MailApiResponse<null>> => {
  const response = await api.post(`${BASE_URL}/labels/apply`, data);
  return response.data;
};

export const removeLabel = async (data: { messageId?: string; threadId?: string; labelId: string }): Promise<MailApiResponse<null>> => {
  const response = await api.post(`${BASE_URL}/labels/remove`, data);
  return response.data;
};

export const getLabelThreads = async (labelId: string, page = 1, limit = 50): Promise<MailApiResponse<{ threads: MailThread[]; total: number; page: number; totalPages: number }>> => {
  const response = await api.get(`${BASE_URL}/labels/${labelId}/threads`, { params: { page, limit } });
  return response.data;
};

export const getThreadLabels = async (threadId: string): Promise<MailApiResponse<MailLabel[]>> => {
  const response = await api.get(`${BASE_URL}/labels/thread/${threadId}`);
  return response.data;
};

// ============ DRAFTS ====
export const getDrafts = async (page = 1, limit = 50): Promise<MailApiResponse<MailDraft[]>> => {
  const response = await api.get(`${BASE_URL}/drafts`, { params: { page, limit } });
  return response.data;
};

export const getDraft = async (draftId: string): Promise<MailApiResponse<MailDraft>> => {
  const response = await api.get(`${BASE_URL}/drafts/${draftId}`);
  return response.data;
};

export const saveDraft = async (data: Partial<MailDraft>): Promise<MailApiResponse<MailDraft>> => {
  const response = await api.post(`${BASE_URL}/drafts`, data);
  return response.data;
};

export const deleteDraft = async (draftId: string): Promise<MailApiResponse<null>> => {
  const response = await api.delete(`${BASE_URL}/drafts/${draftId}`);
  return response.data;
};

// ============ SEARCH ====
export const searchMail = async (params: MailSearchParams): Promise<MailApiResponse<MailMessage[]>> => {
  const response = await api.get(`${BASE_URL}/search`, { params });
  return response.data;
};

export const searchUsersForMail = async (query: string, includeGroups = false): Promise<MailApiResponse<MailRecipientOption[]>> => {
  const response = await api.get(`${BASE_URL}/search/users/${encodeURIComponent(query)}`, {
    params: { includeGroups: includeGroups ? 'true' : 'false' },
  });
  return response.data;
};

export const getMailGroups = async (): Promise<MailApiResponse<{
  centralDepts: MailRecipientOption[];
  schools: MailRecipientOption[];
  departments: MailRecipientOption[];
}>> => {
  const response = await api.get(`${BASE_URL}/search/groups`);
  return response.data;
};

// ============ ATTACHMENTS ====
export const uploadAttachments = async (files: File[]): Promise<MailApiResponse<MailAttachment[]>> => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await api.post(`${BASE_URL}/attachments/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
