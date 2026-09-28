import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SHELL_PREFS,
  loadShellPrefs,
  readShellPrefs,
  removeShellPrefs,
  saveShellPrefs,
  shellPrefsKey,
} from './shell-prefs';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readShellPrefs', () => {
  it('returns the defaults for nothing stored or invalid JSON', () => {
    expect(DEFAULT_SHELL_PREFS).toEqual({ drawerWidth: 360, pinnedFlyout: null, jsonOpen: false });
    expect(readShellPrefs(null)).toEqual(DEFAULT_SHELL_PREFS);
    expect(readShellPrefs('{oops')).toEqual(DEFAULT_SHELL_PREFS);
    expect(readShellPrefs('[1]')).toEqual(DEFAULT_SHELL_PREFS);
  });

  it('keeps valid fields and replaces invalid ones', () => {
    expect(
      readShellPrefs(JSON.stringify({ drawerWidth: 480, pinnedFlyout: 'outline', jsonOpen: true })),
    ).toEqual({ drawerWidth: 480, pinnedFlyout: 'outline', jsonOpen: true });
    expect(
      readShellPrefs(
        JSON.stringify({ drawerWidth: 'wide', pinnedFlyout: 'inspector', jsonOpen: 1 }),
      ),
    ).toEqual(DEFAULT_SHELL_PREFS);
  });

  it('clamps the drawer width to 320–560', () => {
    expect(readShellPrefs(JSON.stringify({ drawerWidth: 100 })).drawerWidth).toBe(320);
    expect(readShellPrefs(JSON.stringify({ drawerWidth: 9000 })).drawerWidth).toBe(560);
  });
});

describe('per-deck storage', () => {
  it('saves and loads per deck id', () => {
    saveShellPrefs('a', { drawerWidth: 400, pinnedFlyout: 'flows', jsonOpen: true });
    expect(localStorage.getItem(shellPrefsKey('a'))).not.toBeNull();
    expect(shellPrefsKey('a')).toBe('sododeck.shell.a');
    expect(loadShellPrefs('a')).toEqual({
      drawerWidth: 400,
      pinnedFlyout: 'flows',
      jsonOpen: true,
    });
    expect(loadShellPrefs('b')).toEqual(DEFAULT_SHELL_PREFS);
  });

  it('never saves for a deck without a stable id', () => {
    saveShellPrefs(null, { drawerWidth: 400, pinnedFlyout: 'flows', jsonOpen: true });
    expect(localStorage.length).toBe(0);
    expect(loadShellPrefs(null)).toEqual(DEFAULT_SHELL_PREFS);
  });

  it('removes a deck’s preferences', () => {
    saveShellPrefs('a', { ...DEFAULT_SHELL_PREFS, jsonOpen: true });
    removeShellPrefs('a');
    expect(loadShellPrefs('a')).toEqual(DEFAULT_SHELL_PREFS);
  });

  it('falls back to defaults and does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadShellPrefs('a')).toEqual(DEFAULT_SHELL_PREFS);
    expect(() => {
      saveShellPrefs('a', DEFAULT_SHELL_PREFS);
      removeShellPrefs('a');
    }).not.toThrow();
  });
});
