import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotingDraftAttachment {
  filePath: string;
  fileName: string;
  fileDescription?: string;
}

export interface NotingDraftState {
  category: 'academic' | 'administrative';
  subcategory: string;
  departmentId: string;
  departmentScope: '' | 'school' | 'central';
  description: string;
  approvalPeriod: 'one_time' | 'recurring';
  recurringFrequency: string;
  policyCompliance: 'yes' | 'no' | null;
  amountRequired: boolean;
  amount: string;
  points: string[];
  attachments: NotingDraftAttachment[];
  draftId: string | null;
  updatedAt: number;
}

const initialState: NotingDraftState = {
  category: 'academic',
  subcategory: '',
  departmentId: '',
  departmentScope: '',
  description: '',
  approvalPeriod: 'one_time',
  recurringFrequency: '',
  policyCompliance: null,
  amountRequired: false,
  amount: '',
  points: [''],
  attachments: [],
  draftId: null,
  updatedAt: 0,
};

interface NotingDraftStore extends NotingDraftState {
  setForm: (data: Partial<NotingDraftState>) => void;
  setDraftId: (id: string | null) => void;
  clearDraft: () => void;
  hydrateFromNote: (note: {
    category: string;
    subcategory: string;
    departmentId?: string | null;
    departmentScope?: string | null;
    description: string;
    approvalPeriod: string;
    recurringFrequency?: string | null;
    policyCompliant?: boolean | null;
    amountRequired: boolean;
    amount?: number | string | null;
    points?: { content: string }[];
    attachments?: { filePath: string; fileName: string; fileDescription?: string | null }[];
  }) => void;
  getPayload: () => Omit<NotingDraftState, 'draftId' | 'updatedAt'>;
}

export const useNotingDraftStore = create<NotingDraftStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setForm: (data) =>
        set((state) => ({
          ...state,
          ...data,
          updatedAt: Date.now(),
        })),

      setDraftId: (draftId) => set({ draftId, updatedAt: Date.now() }),

      clearDraft: () => set(initialState),

      hydrateFromNote: (note) =>
        set({
          category: (note.category as 'academic' | 'administrative') || 'academic',
          subcategory: note.subcategory || '',
          departmentId: note.departmentId || '',
          departmentScope:
            note.departmentScope ===
   'school' || note.departmentScope ===
   'central'
              ? note.departmentScope
              : '',
          description: note.description || '',
          approvalPeriod: (note.approvalPeriod as 'one_time' | 'recurring') || 'one_time',
          recurringFrequency: note.recurringFrequency ?? '',
          policyCompliance:
            note.policyCompliant ===
   true ? 'yes' : note.policyCompliant ===
   false ? 'no' : null,
          amountRequired: note.amountRequired ===
   true,
          amount: note.amount != null ? String(note.amount) : '',
          points:
            note.points?.length && note.points.some((p) => p?.content?.trim())
              ? note.points.map((p) => (typeof p ===
   'string' ? p : p?.content ?? '')).filter(Boolean)
              : [''],
          attachments: (note.attachments ?? []).map((a) => ({
            filePath: a.filePath,
            fileName: a.fileName || a.filePath,
            fileDescription: a.fileDescription ?? undefined,
          })),
          updatedAt: Date.now(),
        }),

      getPayload: () => {
        const s = get();
        return {
          category: s.category,
          subcategory: s.subcategory,
          departmentId: s.departmentId,
          departmentScope: s.departmentScope,
          description: s.description,
          approvalPeriod: s.approvalPeriod,
          recurringFrequency: s.recurringFrequency || '',
          policyCompliance: s.policyCompliance,
          amountRequired: s.amountRequired,
          amount: s.amount,
          points: s.points,
          attachments: s.attachments,
        };
      },
    }),
    { name: 'noting-draft-form' }
  )
);
