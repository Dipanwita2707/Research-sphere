import api, { API_URL } from '@/shared/api/api';
import type {
  ChatMessage,
  ChatSession,
  PipelineRun,
  RipAccess,
  RipAccessFilter,
  RipAccessOverview,
  RipPermissionKey,
  RipUserPage,
  RipStatus,
  StreamEvent,
  UniversityModuleState,
} from '../types';

const BASE = '/research-intelligence';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T>(p: Promise<{ data: Envelope<T> }>) => p.then((r) => r.data.data);

/** Headers the axios interceptor adds, repeated for the streaming fetch call. */
function tenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const id = localStorage.getItem('superadmin-impersonate-university-id');
    return id ? { 'x-university-id': id } : {};
  } catch {
    return {};
  }
}

export const researchIntelligenceService = {
  getStatus: () => unwrap<RipStatus>(api.get(`${BASE}/status`)),

  // Access: own, university admin (user-wise), platform superadmin
  getMyAccess: () => unwrap<RipAccess>(api.get(`${BASE}/access/me`)),
  getAccessOverview: () => unwrap<RipAccessOverview>(api.get(`${BASE}/access`)),
  listAccessUsers: (params: { q?: string; role?: string; access?: RipAccessFilter; page?: number; pageSize?: number }) =>
    unwrap<RipUserPage>(api.get(`${BASE}/access/users`, { params })),
  setUserAccess: (userId: string, body: { permissions: RipPermissionKey[]; expiresAt?: string | null; note?: string }) =>
    unwrap<{ userId: string; permissions: RipPermissionKey[]; expiresAt: string | null }>(api.put(`${BASE}/access/users/${userId}`, body)),
  removeUserAccess: (userId: string) => unwrap<{ removed: boolean }>(api.delete(`${BASE}/access/users/${userId}`)),
  bulkUpdateAccess: (body: { userIds: string[]; permissions: RipPermissionKey[]; mode: 'add' | 'remove' | 'replace'; expiresAt?: string | null }) =>
    unwrap<{ updated: number; skipped: { userId: string; reason: string }[] }>(api.post(`${BASE}/access/bulk`, body)),
  listUniversityModules: () => unwrap<UniversityModuleState[]>(api.get(`${BASE}/platform/universities`)),
  setUniversityModule: (universityId: string, body: { enabled: boolean; notes?: string }) =>
    unwrap<{ enabled: boolean; enabledAt: string | null; disabledAt: string | null; notes: string | null }>(api.put(`${BASE}/platform/universities/${universityId}`, body)),

  // Pipeline
  startPipeline: (options: { rebuild?: boolean; useAi?: boolean; skipClassification?: boolean } = {}) =>
    unwrap<PipelineRun & { mode: string }>(api.post(`${BASE}/pipeline/runs`, options)),
  listPipelineRuns: (limit = 5) => unwrap<PipelineRun[]>(api.get(`${BASE}/pipeline/runs`, { params: { limit } })),

  // Chat sessions
  listSessions: (search?: string) => unwrap<ChatSession[]>(api.get(`${BASE}/chat/sessions`, { params: { search } })),
  createSession: (title?: string) => unwrap<ChatSession>(api.post(`${BASE}/chat/sessions`, { title })),
  updateSession: (id: string, patch: { title?: string; pinned?: boolean }) => unwrap<ChatSession>(api.patch(`${BASE}/chat/sessions/${id}`, patch)),
  deleteSession: (id: string) => unwrap<{ deleted: boolean }>(api.delete(`${BASE}/chat/sessions/${id}`)),
  getMessages: (id: string) => unwrap<ChatMessage[]>(api.get(`${BASE}/chat/sessions/${id}/messages`)),
  setFeedback: (messageId: string, value: 1 | -1 | 0) => unwrap<{ id: string; feedback: number | null }>(api.post(`${BASE}/chat/messages/${messageId}/feedback`, { value })),

  /**
   * Send a message and consume the Server-Sent Events stream.
   * Resolves when the stream ends; abort with the signal to stop generation.
   */
  async streamMessage(sessionId: string, message: string, onEvent: (e: StreamEvent) => void, signal?: AbortSignal): Promise<void> {
    const res = await fetch(`${API_URL}${BASE}/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...tenantHeaders() },
      body: JSON.stringify({ message }),
      signal,
    });
    if (!res.ok || !res.body) {
      let msg = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.message) msg = body.message;
      } catch {
        // non-JSON error body
      }
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let event = 'message';
        const data: string[] = [];
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        }
        if (!data.length) continue; // heartbeat comment
        try {
          onEvent({ event, data: JSON.parse(data.join('\n')) } as StreamEvent);
        } catch {
          // ignore malformed event
        }
      }
    }
  },
};
