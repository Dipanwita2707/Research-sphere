'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  MailThread,
  MailMessage,
  MailConversation,
  MailLabel,
  MailDraft,
  MailCounts,
  MailView,
  ComposeMail,
  ReplyMail,
  MailSearchParams,
  MailRecipientOption,
} from '../types';
import * as mailService from '../services/mail.service';

interface MailState {
  // Thread lists
  inboxThreads: MailThread[];
  sentThreads: MailThread[];
  starredThreads: MailThread[];
  trashThreads: MailThread[];

  // Pagination
  inboxPagination: { page: number; totalPages: number; total: number };
  sentPagination: { page: number; totalPages: number; total: number };
  starredPagination: { page: number; totalPages: number; total: number };
  trashPagination: { page: number; totalPages: number; total: number };

  // Conversation
  currentThreadId: string | null;
  conversation: MailConversation | null;

  // Labels
  labels: MailLabel[];
  labelThreads: MailThread[];
  labelPagination: { page: number; totalPages: number; total: number };
  currentLabelId: string | null;

  // Drafts
  drafts: MailDraft[];

  // Counts
  counts: MailCounts;

  // Search
  searchResults: MailThread[];
  searchPagination: { page: number; totalPages: number; total: number };
  activeSearchParams: MailSearchParams | null;

  // UI State
  currentView: MailView;
  isLoading: boolean;
  isLoadingThread: boolean;
  isSending: boolean;
  isSavingDraft: boolean;
  error: string | null;
  showCompose: boolean;
  composeMode: 'new' | 'reply' | 'replyAll' | 'forward';
  composeReplyToId: string | null;
  composeForwardId: string | null;

  // Actions - Thread lists
  fetchInbox: (page?: number) => Promise<void>;
  fetchSent: (page?: number) => Promise<void>;
  fetchStarred: (page?: number) => Promise<void>;
  fetchTrash: (page?: number) => Promise<void>;
  fetchCounts: () => Promise<void>;

  // Actions - Thread
  fetchThread: (threadId: string) => Promise<void>;
  clearThread: () => void;

  // Actions - Compose
  sendMail: (data: ComposeMail) => Promise<boolean>;
  replyToMessage: (messageId: string, data: ReplyMail) => Promise<boolean>;
  replyAllToMessage: (messageId: string, data: ReplyMail) => Promise<boolean>;
  forwardMessage: (messageId: string, data: ComposeMail) => Promise<boolean>;

  // Actions - Thread actions
  markAsRead: (threadId: string) => Promise<void>;
  markAsUnread: (threadId: string) => Promise<void>;
  toggleStar: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  restoreThread: (threadId: string) => Promise<void>;
  archiveThread: (threadId: string) => Promise<void>;
  unarchiveThread: (threadId: string) => Promise<void>;

  // Actions - Labels
  fetchLabels: () => Promise<void>;
  createLabel: (name: string, color?: string) => Promise<void>;
  updateLabel: (labelId: string, data: { name?: string; color?: string }) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<void>;
  applyLabel: (labelId: string, threadId: string) => Promise<void>;
  removeLabel: (labelId: string, threadId: string) => Promise<void>;
  fetchLabelThreads: (labelId: string, labelName?: string, page?: number) => Promise<void>;

  // Actions - Drafts
  fetchDrafts: () => Promise<void>;
  saveDraft: (data: any) => Promise<string | null>;
  deleteDraft: (draftId: string) => Promise<void>;

  // Actions - Search
  searchMail: (params: MailSearchParams) => Promise<void>;
  clearSearch: () => void;
  searchPage: (page: number) => Promise<void>;

  // Actions - UI
  setCurrentView: (view: MailView) => void;
  openCompose: (mode?: 'new' | 'reply' | 'replyAll' | 'forward', messageId?: string) => void;
  closeCompose: () => void;
  setError: (error: string | null) => void;

  // Actions - Refresh current view
  refreshCurrentView: () => Promise<void>;
}

const defaultPagination = { page: 1, totalPages: 1, total: 0 };
const defaultCounts: MailCounts = { unreadCount: 0, draftCount: 0, starredCount: 0, trashCount: 0 };

export const useMailStore = create<MailState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        inboxThreads: [],
        sentThreads: [],
        starredThreads: [],
        trashThreads: [],
        inboxPagination: { ...defaultPagination },
        sentPagination: { ...defaultPagination },
        starredPagination: { ...defaultPagination },
        trashPagination: { ...defaultPagination },
        currentThreadId: null,
        conversation: null,
        labels: [],
        labelThreads: [],
        labelPagination: { ...defaultPagination },
        currentLabelId: null,
        drafts: [],
        counts: { ...defaultCounts },
        searchResults: [],
        searchPagination: { ...defaultPagination },
        activeSearchParams: null,
        currentView: 'inbox' as MailView,
        isLoading: false,
        isLoadingThread: false,
        isSending: false,
        isSavingDraft: false,
        error: null,
        showCompose: false,
        composeMode: 'new' as const,
        composeReplyToId: null,
        composeForwardId: null,

        // Fetch inbox
        fetchInbox: async (page = 1) => {
          set({ isLoading: true, error: null });
          try {
            const res = await mailService.getInbox(page, 20);
            const data = res.data as any;
            set({
              inboxThreads: data.threads || data,
              inboxPagination: data.pagination || { page, totalPages: 1, total: (data.threads || data).length },
              isLoading: false,
            });
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to load inbox', isLoading: false });
          }
        },

        // Fetch sent
        fetchSent: async (page = 1) => {
          set({ isLoading: true, error: null });
          try {
            const res = await mailService.getSent(page, 20);
            const data = res.data as any;
            set({
              sentThreads: data.threads || data,
              sentPagination: data.pagination || { page, totalPages: 1, total: (data.threads || data).length },
              isLoading: false,
            });
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to load sent mail', isLoading: false });
          }
        },

        // Fetch starred
        fetchStarred: async (page = 1) => {
          set({ isLoading: true, error: null });
          try {
            const res = await mailService.getStarred(page, 20);
            const data = res.data as any;
            set({
              starredThreads: data.threads || data,
              starredPagination: data.pagination || { page, totalPages: 1, total: (data.threads || data).length },
              isLoading: false,
            });
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to load starred', isLoading: false });
          }
        },

        // Fetch trash
        fetchTrash: async (page = 1) => {
          set({ isLoading: true, error: null });
          try {
            const res = await mailService.getTrash(page, 20);
            const data = res.data as any;
            set({
              trashThreads: data.threads || data,
              trashPagination: data.pagination || { page, totalPages: 1, total: (data.threads || data).length },
              isLoading: false,
            });
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to load trash', isLoading: false });
          }
        },

        // Fetch counts
        fetchCounts: async () => {
          try {
            const res = await mailService.getMailCounts();
            set({ counts: res.data });
          } catch (err) {
            // Silent fail on counts
          }
        },

        // Fetch thread conversation
        fetchThread: async (threadId: string) => {
          set({ isLoadingThread: true, error: null, currentThreadId: threadId });
          try {
            const res = await mailService.getThread(threadId);
            set({
              conversation: res.data,
              isLoadingThread: false,
            });
            // Refresh counts after viewing
            get().fetchCounts();
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to load conversation', isLoadingThread: false });
          }
        },

        clearThread: () => {
          set({ currentThreadId: null, conversation: null });
        },

        // Send new mail
        sendMail: async (data: ComposeMail) => {
          set({ isSending: true, error: null });
          try {
            await mailService.sendMail(data);
            set({ isSending: false, showCompose: false });
            get().refreshCurrentView();
            get().fetchCounts();
            return true;
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to send mail', isSending: false });
            return false;
          }
        },

        // Reply
        replyToMessage: async (messageId: string, data: ReplyMail) => {
          set({ isSending: true, error: null });
          try {
            await mailService.replyToMessage(messageId, data);
            set({ isSending: false, showCompose: false });
            // Refresh conversation
            const threadId = get().currentThreadId;
            if (threadId) get().fetchThread(threadId);
            get().fetchCounts();
            return true;
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to send reply', isSending: false });
            return false;
          }
        },

        // Reply all
        replyAllToMessage: async (messageId: string, data: ReplyMail) => {
          set({ isSending: true, error: null });
          try {
            await mailService.replyAllToMessage(messageId, data);
            set({ isSending: false, showCompose: false });
            const threadId = get().currentThreadId;
            if (threadId) get().fetchThread(threadId);
            get().fetchCounts();
            return true;
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to send reply', isSending: false });
            return false;
          }
        },

        // Forward
        forwardMessage: async (messageId: string, data: ComposeMail) => {
          set({ isSending: true, error: null });
          try {
            await mailService.forwardMessage(messageId, data);
            set({ isSending: false, showCompose: false });
            get().refreshCurrentView();
            get().fetchCounts();
            return true;
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to forward', isSending: false });
            return false;
          }
        },

        // Thread actions
        markAsRead:async (threadId: string) => {
          try {
            await mailService.markRead(threadId);
            // Update local state
            set((state) => ({
              inboxThreads: state.inboxThreads.map((t) =>
                t.id ===
   threadId ? { ...t, unreadCount: 0 } : t
              ),
            }));
            get().fetchCounts();
          } catch (err) {}
        },

        markAsUnread: async (threadId: string) => {
          try {
            await mailService.markUnread(threadId);
            set((state) => ({
              inboxThreads: state.inboxThreads.map((t) =>
                t.id ===
   threadId ? { ...t, unreadCount: 1 } : t
              ),
            }));
            get().fetchCounts();
          } catch (err) {}
        },

        toggleStar: async (threadId: string) => {
          try {
            const res = await mailService.toggleStar(threadId);
            const newStarred = res?.data?.isStarred ?? !get().inboxThreads.find((t) => t.id ===
   threadId)?.isStarred;
            const updateStar = (threads: MailThread[]) =>
              threads.map((t) => (t.id ===
   threadId ? { ...t, isStarred: newStarred } : t));
            set((state) => ({
              inboxThreads: updateStar(state.inboxThreads),
              sentThreads: updateStar(state.sentThreads),
              starredThreads: updateStar(state.starredThreads),
              trashThreads: updateStar(state.trashThreads),
              // Also update conversation if it's the same thread
              conversation: state.conversation?.id ===
   threadId
                ? { ...state.conversation, isStarred: newStarred }
                : state.conversation,
            }));
          } catch (err) { console.error('Toggle star error:', err); }
        },

        deleteThread: async (threadId: string) => {
          try {
            await mailService.deleteThread(threadId);
            const removeThread = (threads: MailThread[]) => threads.filter((t) => t.id !== threadId);
            set((state) => ({
              inboxThreads: removeThread(state.inboxThreads),
              sentThreads: removeThread(state.sentThreads),
              starredThreads: removeThread(state.starredThreads),
              currentThreadId: state.currentThreadId ===
   threadId ? null : state.currentThreadId,
              conversation: state.currentThreadId ===
   threadId ? null : state.conversation,
            }));
            get().fetchCounts();
          } catch (err) {}
        },

        restoreThread: async (threadId: string) => {
          try {
            await mailService.restoreThread(threadId);
            set((state) => ({
              trashThreads: state.trashThreads.filter((t) => t.id !== threadId),
            }));
            get().fetchCounts();
          } catch (err) {}
        },

        archiveThread: async (threadId: string) => {
          try {
            await mailService.archiveThread(threadId);
            const removeThread = (threads: MailThread[]) => threads.filter((t) => t.id !== threadId);
            set((state) => ({
              inboxThreads: removeThread(state.inboxThreads),
              currentThreadId: state.currentThreadId ===
   threadId ? null : state.currentThreadId,
              conversation: state.currentThreadId ===
   threadId ? null : state.conversation,
            }));
          } catch (err) {}
        },

        unarchiveThread: async (threadId: string) => {
          try {
            await mailService.unarchiveThread(threadId);
            get().refreshCurrentView();
          } catch (err) {}
        },

        // Labels
        fetchLabels: async () => {
          try {
            const res = await mailService.getLabels();
            const data = res.data as any;
            set({ labels: data.labels || data });
          } catch (err) {}
        },

        createLabel: async (name: string, color?: string) => {
          try {
            const data: any = { name };
            if (color) data.color = color;
            await mailService.createLabel(data);
            get().fetchLabels();
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to create label' });
          }
        },

        updateLabel: async (labelId: string, data: { name?: string; color?: string }) => {
          try {
            await mailService.updateLabel(labelId, data);
            get().fetchLabels();
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to update label' });
          }
        },

        deleteLabel: async (labelId: string) => {
          try {
            await mailService.deleteLabel(labelId);
            get().fetchLabels();
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to delete label' });
          }
        },

        applyLabel: async (labelId: string, threadId: string) => {
          try {
            await mailService.applyLabel({ labelId, threadId });
            // Refresh label threads if currently viewing this label
            if (get().currentLabelId ===
   labelId) {
              get().fetchLabelThreads(labelId);
            }
          } catch (err) {}
        },

        removeLabel: async (labelId: string, threadId: string) => {
          try {
            await mailService.removeLabel({ labelId, threadId });
            // Remove thread from label view optimistically
            if (get().currentLabelId ===
   labelId) {
              set((s) => ({ labelThreads: s.labelThreads.filter((t) => t.id !== threadId) }));
            }
          } catch (err) {}
        },

        fetchLabelThreads: async (labelId: string, _labelName?: string, page = 1) => {
          set({ isLoading: true, error: null, currentLabelId: labelId, currentView: 'label' as MailView });
          try {
            const res = await mailService.getLabelThreads(labelId, page, 50);
            const data = (res as any).data as any;
            set({
              labelThreads: data.threads || [],
              labelPagination: { page: data.page || 1, totalPages: data.totalPages || 1, total: data.total || 0 },
              isLoading: false,
            });
          } catch (err: any) {
            set({ error: 'Failed to load label threads', isLoading: false });
          }
        },

        // Drafts
        fetchDrafts: async () => {
          try {
            const res = await mailService.getDrafts();
            const data = res.data as any;
            set({ drafts: data.drafts || data });
          } catch (err) {}
        },

        saveDraft: async (data: any) => {
          set({ isSavingDraft: true });
          try {
            const res = await mailService.saveDraft(data);
            const resData = res.data as any;
            set({ isSavingDraft: false });
            get().fetchDrafts();
            get().fetchCounts();
            return resData?.id || resData?.draft?.id || null;
          } catch (err) {
            set({ isSavingDraft: false });
            return null;
          }
        },

        deleteDraft: async (draftId: string) => {
          try {
            await mailService.deleteDraft(draftId);
            set((state) => ({
              drafts: state.drafts.filter((d) => d.id !== draftId),
            }));
            get().fetchCounts();
          } catch (err) {}
        },

        // Search
        searchMail: async (params: MailSearchParams) => {
          set({ isLoading: true, error: null, currentView: 'search' as MailView, activeSearchParams: params });
          try {
            const res = await mailService.searchMail(params);
            const data = res.data as any;
            const threads = data?.threads || data || [];
            const pagination = data?.pagination || { page: 1, totalPages: 1, total: threads.length };
            set({
              searchResults: threads,
              searchPagination: pagination,
              isLoading: false,
            });
          } catch (err: any) {
            set({ error: err.response?.data?.message || 'Search failed', isLoading: false });
          }
        },

        clearSearch: () => {
          set({ searchResults: [], searchPagination: { ...defaultPagination }, activeSearchParams: null });
        },

        searchPage: async (page: number) => {
          const { activeSearchParams, searchMail: doSearch } = get();
          if (!activeSearchParams) return;
          await doSearch({ ...activeSearchParams, page });
        },

        // UI actions
        setCurrentView: (view: MailView) => {
          set({ currentView: view, currentThreadId: null, conversation: null });
        },

        openCompose: (mode = 'new', messageId?: string) => {
          set({
            showCompose: true,
            composeMode: mode,
            composeReplyToId: mode ===
   'reply' || mode ===
   'replyAll' ? (messageId || null) : null,
            composeForwardId: mode ===
   'forward' ? (messageId || null) : null,
          });
        },

        closeCompose: () => {
          set({
            showCompose: false,
            composeMode: 'new',
            composeReplyToId: null,
            composeForwardId: null,
          });
        },

        setError: (error: string | null) => {
          set({ error });
        },

        // Refresh current view
        refreshCurrentView: async () => {
          const view = get().currentView;
          switch (view) {
            case 'inbox':
              await get().fetchInbox();
              break;
            case 'sent':
              await get().fetchSent();
              break;
            case 'starred':
              await get().fetchStarred();
              break;
            case 'trash':
              await get().fetchTrash();
              break;
            case 'drafts':
              await get().fetchDrafts();
              break;
            case 'label': {
              const lid = get().currentLabelId;
              if (lid) await get().fetchLabelThreads(lid);
              break;
            }
          }
        },
      }),
      {
        name: 'mail-store',
        partialize: (state) => ({
          currentView: state.currentView,
          currentThreadId: state.currentThreadId,
        }),
      }
    ),
    { name: 'MailStore' }
  )
);

// Selector hooks for performance
export const useMailThreads = () => {
  const view = useMailStore((s) => s.currentView);
  const inbox = useMailStore((s) => s.inboxThreads);
  const sent = useMailStore((s) => s.sentThreads);
  const starred = useMailStore((s) => s.starredThreads);
  const trash = useMailStore((s) => s.trashThreads);
  const search = useMailStore((s) => s.searchResults);
  const label = useMailStore((s) => s.labelThreads);

  switch (view) {
    case 'inbox': return inbox;
    case 'sent': return sent;
    case 'starred': return starred;
    case 'trash': return trash;
    case 'search': return search;
    case 'label': return label;
    default: return inbox;
  }
};

export const useMailCounts = () => useMailStore((s) => s.counts);
export const useCurrentConversation = () => useMailStore((s) => s.conversation);
export const useMailLabels = () => useMailStore((s) => s.labels);
export const useMailDrafts = () => useMailStore((s) => s.drafts);
export const useIsMailLoading = () => useMailStore((s) => s.isLoading);
