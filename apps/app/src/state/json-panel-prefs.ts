/**
 * JSON panel preferences (004 data-model.md): UI-only, per browser, never in the deck. Stored in
 * localStorage, which can be blocked, so reads fall back to defaults and writes are best-effort.
 */
export type JsonTab = 'selection' | 'deck';

export interface JsonPanelPrefs {
  open: boolean;
  /** px; clamped to the main area when rendered (`clampPanelHeight`). */
  height: number;
  tab: JsonTab;
}

export const JSON_PANEL_KEY = 'sododeck.jsonPanel';

export const DEFAULT_JSON_PANEL: JsonPanelPrefs = { open: true, height: 212, tab: 'deck' };

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Validates a stored value field by field; anything invalid falls back to its default. */
export function readJsonPanelPrefs(raw: string | null): JsonPanelPrefs {
  const value = raw === null ? null : parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_JSON_PANEL;
  }
  const { open, height, tab } = value as Record<string, unknown>;
  return {
    open: typeof open === 'boolean' ? open : DEFAULT_JSON_PANEL.open,
    height:
      typeof height === 'number' && Number.isFinite(height) ? height : DEFAULT_JSON_PANEL.height,
    tab: tab === 'deck' || tab === 'selection' ? tab : DEFAULT_JSON_PANEL.tab,
  };
}

export function loadJsonPanelPrefs(): JsonPanelPrefs {
  try {
    return readJsonPanelPrefs(localStorage.getItem(JSON_PANEL_KEY));
  } catch {
    return DEFAULT_JSON_PANEL; // storage can be blocked (private mode, policies)
  }
}

export function saveJsonPanelPrefs(prefs: JsonPanelPrefs): void {
  try {
    localStorage.setItem(JSON_PANEL_KEY, JSON.stringify(prefs));
  } catch {
    // non-critical preference
  }
}
