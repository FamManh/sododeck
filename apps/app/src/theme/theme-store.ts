import { create } from 'zustand';

export type Theme = 'light' | 'dark';

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * The web app remembers the choice (`theme-init.ts` registers where). Kept out of this file so the
 * embed build, which must not touch browser storage (067 FR-020), carries no storage code.
 */
let persist: ((theme: Theme) => void) | null = null;

export function setThemePersistence(write: ((theme: Theme) => void) | null) {
  persist = write;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: 'light',
  setTheme: (theme) => {
    applyTheme(theme);
    persist?.(theme);
    set({ theme });
  },
}));

/**
 * The host owns the scheme inside an embed (067 R9): applied and shown, never remembered.
 * Anything but `'dark'` reads as light.
 */
export function setThemeFromHost(scheme: unknown) {
  const theme: Theme = scheme === 'dark' ? 'dark' : 'light';
  applyTheme(theme);
  useThemeStore.setState({ theme });
}
