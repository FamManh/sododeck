import { afterEach, describe, expect, it, vi } from 'vitest';

import { initTheme } from './theme-init';
import { setThemeFromHost, setThemePersistence, useThemeStore } from './theme-store';

afterEach(() => {
  setThemePersistence(null);
  document.documentElement.classList.remove('dark');
  useThemeStore.setState({ theme: 'light' });
  vi.restoreAllMocks();
});

describe('setThemeFromHost (067)', () => {
  it('applies dark and treats anything else as light, without touching localStorage', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    setThemeFromHost('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(useThemeStore.getState().theme).toBe('dark');
    setThemeFromHost('sepia');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(useThemeStore.getState().theme).toBe('light');
    setThemeFromHost(undefined);
    expect(useThemeStore.getState().theme).toBe('light');
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});

describe('web theme choice', () => {
  it('is remembered once initTheme has registered storage', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    useThemeStore.getState().setTheme('dark');
    expect(set).not.toHaveBeenCalled();
    initTheme();
    useThemeStore.getState().setTheme('dark');
    expect(set).toHaveBeenCalledWith('sododeck:theme', 'dark');
  });
});
