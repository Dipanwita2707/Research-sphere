'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Force light theme
    const initialTheme = 'light';
    
    setThemeState(initialTheme);
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  const setTheme = (newTheme: Theme) => {
    // Force light theme
    setThemeState('light');
    localStorage.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
  };

  const toggleTheme = () => {
    // Do nothing or enforce light
    setTheme('light');
  };

  // Render children immediately to avoid a flash-of-blank.
  // The initial render uses the default 'light' theme; once the effect runs
  // (client-only), the correct saved/system theme is applied. Any mismatch
  // is a harmless class toggle (< 1 frame) instead of a full blank page.

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
