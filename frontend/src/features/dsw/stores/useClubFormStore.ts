import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ClubFormData {
  clubName: string;
  clubCategoryId: string;
  purpose: string;
  academicSession: string;
  facultyFacilitatorId: string;
  initialMembers: string[];
  targetStudentGroup: string[];
  expectedActivityTypes: string[];
  codeOfConductAccepted: boolean;
  antiDiscriminationAccepted: boolean;
  meetingFrequency:
    | "monthly"
    | "quarterly"
    | "half_yearly"
    | "annually"
    | "event_based"
    | "";
  estimatedAnnualActivityCount: number;
  proposedEmail: string;
  socialMediaHandles: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  expectedStudentStrength: number | null;
}

interface ClubFormStore {
  // ── Form data ────────────────────────────────────────────────────────────
  data: Partial<ClubFormData>;

  // ── UI state that is meaningful enough to survive a refresh ─────────────
  /** Which wizard step the user was on (1 | 2 | 3) */
  currentStep: number;
  /** The parent-category id selected in the two-level category picker */
  selectedMainCategory: string;

  // ── Actions ──────────────────────────────────────────────────────────────
  setField: <K extends keyof ClubFormData>(
    field: K,
    value: ClubFormData[K],
  ) => void;
  setData: (data: Partial<ClubFormData>) => void;
  /**
   * Accepts a number or an updater function, matching the React setState API
   * so existing callers like `setCurrentStep(p => p + 1)` keep working.
   */
  setCurrentStep: (step: number | ((prev: number) => number)) => void;
  setSelectedMainCategory: (id: string) => void;
  /** Wipe everything — call this after a successful submission. */
  reset: () => void;
}

const INITIAL_STATE = {
  data: { socialMediaHandles: {} } as Partial<ClubFormData>,
  currentStep: 1,
  selectedMainCategory: "",
} as const;

export const useClubFormStore = create<ClubFormStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setField: (field, value) =>
        set((state) => ({ data: { ...state.data, [field]: value } })),

      setData: (newData) =>
        set((state) => ({ data: { ...state.data, ...newData } })),

      setCurrentStep: (step) =>
        set((state) => ({
          currentStep:
            typeof step === "function" ? step(state.currentStep) : step,
        })),

      setSelectedMainCategory: (id) => set({ selectedMainCategory: id }),

      reset: () => set({ ...INITIAL_STATE, data: { socialMediaHandles: {} } }),
    }),
    {
      name: "club-form-draft",
      // sessionStorage: cleared when the tab/window is closed, so stale
      // drafts never linger across separate visits.
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : localStorage,
      ),
      // Only persist the fields we care about; skip any transient keys
      // that might be added in the future.
      partialize: (state) => ({
        data: state.data,
        currentStep: state.currentStep,
        selectedMainCategory: state.selectedMainCategory,
      }),
    },
  ),
);
