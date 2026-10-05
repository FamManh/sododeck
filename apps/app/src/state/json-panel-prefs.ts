/**
 * JSON panel preferences (004 data-model.md): UI-only, per browser, never in the deck. Stored in
 * localStorage, which can be blocked, so reads fall back to defaults and writes are best-effort.
 */
export type JsonTab = 'selection' | 'deck';

/**
 * Tab of the code drawer (046, moved to its own drawer in 054): DBML is editable, SQL is a
 * preview. The JSON panel no longer has code tabs.
 */
export type CodeFormat = 'dbml' | 'sql';
/**
 * Scope of the DBML and SQL text: the selected tables or the whole schema. The drawer always
 * shows the whole schema (054); the stored value is kept so the Selection switch can come back.
 */
export type SchemaScope = 'selection' | 'schema';
/** SQL preview dialect of a Generic deck. */
export type SqlPreviewDialect = 'postgres' | 'mysql' | 'sqlite';

/** The right-hand drawer with the DBML and SQL tabs (054). */
export interface CodeDrawerPrefs {
  open: boolean;
  /** px; at least 320, clamped to the window when rendered (`clampCodeDrawerWidth`). */
  width: number;
  format: CodeFormat;
}

export interface JsonPanelPrefs {
  open: boolean;
  /** px; clamped to the main area when rendered (`clampPanelHeight`). */
  height: number;
  tab: JsonTab;
  /** Always `json` since 054: an older stored `dbml` or `sql` reads as `json`. */
  format: 'json';
  schemaScope: SchemaScope;
  sqlPreviewDialect: SqlPreviewDialect;
  codeDrawer: CodeDrawerPrefs;
}

export const JSON_PANEL_KEY = 'sododeck.jsonPanel';

export const CODE_DRAWER_MIN_WIDTH = 320;

export const DEFAULT_CODE_DRAWER: CodeDrawerPrefs = { open: false, width: 560, format: 'dbml' };

export const DEFAULT_JSON_PANEL: JsonPanelPrefs = {
  open: true,
  height: 212,
  tab: 'deck',
  format: 'json',
  schemaScope: 'selection',
  sqlPreviewDialect: 'postgres',
  codeDrawer: DEFAULT_CODE_DRAWER,
};

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readCodeDrawer(value: unknown): CodeDrawerPrefs {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_CODE_DRAWER;
  }
  const { open, width, format } = value as Record<string, unknown>;
  return {
    open: typeof open === 'boolean' ? open : DEFAULT_CODE_DRAWER.open,
    width:
      typeof width === 'number' && Number.isFinite(width)
        ? Math.max(width, CODE_DRAWER_MIN_WIDTH)
        : DEFAULT_CODE_DRAWER.width,
    format: format === 'dbml' || format === 'sql' ? format : DEFAULT_CODE_DRAWER.format,
  };
}

/** Validates a stored value field by field; anything invalid falls back to its default. */
export function readJsonPanelPrefs(raw: string | null): JsonPanelPrefs {
  const value = raw === null ? null : parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_JSON_PANEL;
  }
  const { open, height, tab, schemaScope, sqlPreviewDialect, codeDrawer } = value as Record<
    string,
    unknown
  >;
  return {
    open: typeof open === 'boolean' ? open : DEFAULT_JSON_PANEL.open,
    height:
      typeof height === 'number' && Number.isFinite(height) ? height : DEFAULT_JSON_PANEL.height,
    tab: tab === 'deck' || tab === 'selection' ? tab : DEFAULT_JSON_PANEL.tab,
    format: 'json',
    schemaScope:
      schemaScope === 'selection' || schemaScope === 'schema'
        ? schemaScope
        : DEFAULT_JSON_PANEL.schemaScope,
    sqlPreviewDialect:
      sqlPreviewDialect === 'postgres' ||
      sqlPreviewDialect === 'mysql' ||
      sqlPreviewDialect === 'sqlite'
        ? sqlPreviewDialect
        : DEFAULT_JSON_PANEL.sqlPreviewDialect,
    codeDrawer: readCodeDrawer(codeDrawer),
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
