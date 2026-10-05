import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_JSON_PANEL,
  JSON_PANEL_KEY,
  loadJsonPanelPrefs,
  readJsonPanelPrefs,
  saveJsonPanelPrefs,
} from './json-panel-prefs';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('readJsonPanelPrefs', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(readJsonPanelPrefs(null)).toEqual({
      open: true,
      height: 212,
      tab: 'deck',
      format: 'json',
      schemaScope: 'selection',
      sqlPreviewDialect: 'postgres',
      codeDrawer: { open: false, width: 560, format: 'dbml' },
    });
    expect(DEFAULT_JSON_PANEL).toEqual({
      open: true,
      height: 212,
      tab: 'deck',
      format: 'json',
      schemaScope: 'selection',
      sqlPreviewDialect: 'postgres',
      codeDrawer: { open: false, width: 560, format: 'dbml' },
    });
  });

  it('reads a valid value', () => {
    const raw = JSON.stringify({ open: false, height: 300, tab: 'selection' });
    expect(readJsonPanelPrefs(raw)).toEqual({
      ...DEFAULT_JSON_PANEL,
      open: false,
      height: 300,
      tab: 'selection',
    });
  });

  it('reads the 046 fields and falls back field by field', () => {
    const raw = JSON.stringify({
      schemaScope: 'schema',
      sqlPreviewDialect: 'mysql',
    });
    expect(readJsonPanelPrefs(raw)).toEqual({
      ...DEFAULT_JSON_PANEL,
      schemaScope: 'schema',
      sqlPreviewDialect: 'mysql',
    });
    const bad = JSON.stringify({ format: 'yaml', schemaScope: 3, sqlPreviewDialect: 'oracle' });
    expect(readJsonPanelPrefs(bad)).toEqual(DEFAULT_JSON_PANEL);
  });

  it.each(['dbml', 'sql', 'yaml'])('reads a stored format %s as json (054)', (format) => {
    expect(readJsonPanelPrefs(JSON.stringify({ format })).format).toBe('json');
  });

  it('keeps a stored schema scope as read (054: the switch is hidden, not removed)', () => {
    expect(readJsonPanelPrefs(JSON.stringify({ schemaScope: 'schema' })).schemaScope).toBe(
      'schema',
    );
    expect(readJsonPanelPrefs(JSON.stringify({ schemaScope: 'selection' })).schemaScope).toBe(
      'selection',
    );
  });

  it('reads the code drawer field by field (054)', () => {
    const read = (codeDrawer: unknown) =>
      readJsonPanelPrefs(JSON.stringify({ codeDrawer })).codeDrawer;
    expect(read({ open: true, width: 900, format: 'sql' })).toEqual({
      open: true,
      width: 900,
      format: 'sql',
    });
    expect(read({ open: 'yes', width: '900', format: 'json' })).toEqual({
      open: false,
      width: 560,
      format: 'dbml',
    });
    expect(read({ width: 100 }).width).toBe(320);
    expect(read({ width: Number.NaN }).width).toBe(560);
    for (const bad of [null, 5, 'x', [1]]) expect(read(bad)).toEqual(DEFAULT_JSON_PANEL.codeDrawer);
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['a non-object', '42'],
    ['null', 'null'],
    ['an array', '[1,2]'],
  ])('falls back to the defaults for %s', (_, raw) => {
    expect(readJsonPanelPrefs(raw)).toEqual(DEFAULT_JSON_PANEL);
  });

  it('validates field by field', () => {
    expect(readJsonPanelPrefs(JSON.stringify({ open: 'no', height: 300, tab: 'nope' }))).toEqual({
      ...DEFAULT_JSON_PANEL,
      height: 300,
    });
    expect(readJsonPanelPrefs(JSON.stringify({ open: false, height: '300' }))).toEqual({
      ...DEFAULT_JSON_PANEL,
      open: false,
    });
    // JSON cannot hold Infinity or NaN; they arrive as null.
    expect(readJsonPanelPrefs('{"height": null, "tab": "selection"}')).toEqual({
      ...DEFAULT_JSON_PANEL,
      tab: 'selection',
    });
  });

  it('keeps a partial object', () => {
    expect(readJsonPanelPrefs(JSON.stringify({ tab: 'selection' }))).toEqual({
      ...DEFAULT_JSON_PANEL,
      tab: 'selection',
    });
  });
});

describe('load and save', () => {
  it('round-trips through localStorage', () => {
    const prefs = { ...DEFAULT_JSON_PANEL, open: false, height: 150, tab: 'selection' as const };
    saveJsonPanelPrefs(prefs);
    expect(localStorage.getItem(JSON_PANEL_KEY)).toBe(JSON.stringify(prefs));
    expect(loadJsonPanelPrefs()).toEqual(prefs);
  });

  it('uses the defaults and ignores writes when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadJsonPanelPrefs()).toEqual(DEFAULT_JSON_PANEL);
    expect(() => {
      saveJsonPanelPrefs(DEFAULT_JSON_PANEL);
    }).not.toThrow();
  });
});
