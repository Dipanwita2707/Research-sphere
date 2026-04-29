import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemePreferenceState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemePreferenceStore = create<ThemePreferenceState>()(
  persist(
    (set, get) => ({
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
      toggleTheme: () => {
        const nextMode = get().themeMode === 'dark' ? 'light' : 'dark';
        set({ themeMode: nextMode });
      },
    }),
    {
      name: 'sgt-connect-theme-preference',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);