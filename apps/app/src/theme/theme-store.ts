import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sododeck:theme';

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // storage can be blocked (private mode, policies)
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: 'light',
  setTheme: (theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // non-critical preference
    }
    set({ theme });
  },
}));

/** Call once before first render to avoid a theme flash. */
export function initTheme() {
  const theme = readStoredTheme() ?? systemTheme();
  applyTheme(theme);
  useThemeStore.setState({ theme });
}
