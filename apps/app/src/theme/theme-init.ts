import { applyTheme, setThemePersistence, useThemeStore, type Theme } from './theme-store';

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

/** Call once before first render to avoid a theme flash; the choice is remembered from now on. */
export function initTheme() {
  setThemePersistence((theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // non-critical preference
    }
  });
  const theme = readStoredTheme() ?? systemTheme();
  applyTheme(theme);
  useThemeStore.setState({ theme });
}
