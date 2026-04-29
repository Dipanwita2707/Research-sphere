import { useColorScheme } from 'react-native';
import { useThemePreferenceStore } from '../state/themePreferenceStore';

export const lightColors = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surface2: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textSub: '#475569',
  textMuted: '#94a3b8',
  primary: '#6366f1',
  primaryBg: '#eef2ff',
  success: '#059669',
  successBg: '#d1fae5',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  warning: '#d97706',
  headerBg: '#f8fafc',
  headerText: '#0f172a',
  tabBg: '#f8fafc',
  tabBorder: '#e2e8f0',
  tabActive: '#6366f1',
  tabInactive: '#94a3b8',
  inputBg: '#f1f5f9',
  placeholder: '#94a3b8',
  switchTrackFalse: '#cbd5e1',
  switchTrackTrue: '#4f46e5',
  cardShadow: '#0000001a',
};

export const darkColors = {
  bg: '#0f172a',
  surface: '#1e293b',
  surface2: '#0f172a',
  border: '#1e293b',
  text: '#f1f5f9',
  textSub: '#94a3b8',
  textMuted: '#475569',
  primary: '#6366f1',
  primaryBg: '#312e81',
  success: '#10b981',
  successBg: '#065f46',
  danger: '#ef4444',
  dangerBg: '#7f1d1d',
  warning: '#f59e0b',
  headerBg: '#1e293b',
  headerText: '#f1f5f9',
  tabBg: '#1e293b',
  tabBorder: '#334155',
  tabActive: '#6366f1',
  tabInactive: '#94a3b8',
  inputBg: '#0f172a',
  placeholder: '#475569',
  switchTrackFalse: '#475569',
  switchTrackTrue: '#4f46e5',
  cardShadow: '#00000066',
};

export type AppColors = typeof lightColors;

export function useTheme() {
  const scheme = useColorScheme();
  const themeMode = useThemePreferenceStore((state) => state.themeMode);
  const setThemeMode = useThemePreferenceStore((state) => state.setThemeMode);
  const toggleTheme = useThemePreferenceStore((state) => state.toggleTheme);
  const isDark = themeMode === 'system' ? scheme === 'dark' : themeMode === 'dark';
  const colors: AppColors = isDark ? darkColors : lightColors;
  return { colors, isDark, themeMode, setThemeMode, toggleTheme };
}
