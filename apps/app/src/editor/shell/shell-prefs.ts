import { DRAWER_DEFAULT, DRAWER_MAX, DRAWER_MIN } from './shell-geometry';

/**
 * Per-deck shell preferences (018 data-model, §g-50): UI only, per browser, never in the deck
 * file or the Yjs document, and not synced between tabs (read once when a deck opens). Stored in
 * localStorage, which can be blocked, so reads fall back to defaults and writes are best-effort.
 */
export const FLYOUT_IDS = ['palette', 'outline', 'flows', 'rules', 'problems'] as const;
export type FlyoutId = (typeof FLYOUT_IDS)[number];

export interface ShellPrefs {
  /** px, 320–560. */
  drawerWidth: number;
  pinnedFlyout: FlyoutId | null;
  jsonOpen: boolean;
}

export const DEFAULT_SHELL_PREFS: ShellPrefs = {
  drawerWidth: DRAWER_DEFAULT,
  pinnedFlyout: null,
  jsonOpen: false,
};

const PREFIX = 'sododeck.shell.';

export function shellPrefsKey(deckId: string): string {
  return `${PREFIX}${deckId}`;
}

export function isFlyoutId(value: unknown): value is FlyoutId {
  return typeof value === 'string' && (FLYOUT_IDS as readonly string[]).includes(value);
}

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Validates a stored value field by field; anything invalid falls back to its default. */
export function readShellPrefs(raw: string | null): ShellPrefs {
  const value = raw === null ? null : parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_SHELL_PREFS;
  }
  const { drawerWidth, pinnedFlyout, jsonOpen } = value as Record<string, unknown>;
  return {
    drawerWidth:
      typeof drawerWidth === 'number' && Number.isFinite(drawerWidth)
        ? Math.min(Math.max(drawerWidth, DRAWER_MIN), DRAWER_MAX)
        : DEFAULT_SHELL_PREFS.drawerWidth,
    pinnedFlyout: isFlyoutId(pinnedFlyout) ? pinnedFlyout : null,
    jsonOpen: typeof jsonOpen === 'boolean' ? jsonOpen : DEFAULT_SHELL_PREFS.jsonOpen,
  };
}

/** `null` (the demo or an in-memory deck) has no stable id: defaults, never saved. */
export function loadShellPrefs(deckId: string | null): ShellPrefs {
  if (deckId === null) return DEFAULT_SHELL_PREFS;
  try {
    return readShellPrefs(localStorage.getItem(shellPrefsKey(deckId)));
  } catch {
    return DEFAULT_SHELL_PREFS; // storage can be blocked (private mode, policies)
  }
}

export function saveShellPrefs(deckId: string | null, prefs: ShellPrefs): void {
  if (deckId === null) return;
  try {
    localStorage.setItem(shellPrefsKey(deckId), JSON.stringify(prefs));
  } catch {
    // non-critical preference
  }
}

/** Called when the library purges a deck, so preferences do not outlive it. */
export function removeShellPrefs(deckId: string): void {
  try {
    localStorage.removeItem(shellPrefsKey(deckId));
  } catch {
    // non-critical preference
  }
}
