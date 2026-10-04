import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { exportReducer, initialExportState, type ExportAction } from './export-dialog-state';
import { DEFAULT_SQL_OPTIONS } from '../../db/export/types';
import {
  exportRequest,
  exportRequestKey,
  pngSizeHint,
  type SchemaRequest,
} from './use-export-result';

const ui = {
  currentViewId: null,
  revealed: new Set<string>(),
  drill: [],
  activeFlowId: null,
  notesDisplay: 'dimmed' as const,
};

function keyAfter(...actions: ExportAction[]) {
  const deck = emptySododeckFile();
  const state = actions.reduce(exportReducer, initialExportState({ flowMode: false }));
  return (d = deck) => exportRequestKey(exportRequest(state), d, ui);
}

describe('exportRequestKey', () => {
  it('is stable for the same inputs', () => {
    const deck = emptySododeckFile();
    const state = initialExportState({ flowMode: false });
    expect(exportRequestKey(exportRequest(state), deck, ui)).toBe(
      exportRequestKey(exportRequest(state), deck, { ...ui, revealed: new Set() }),
    );
  });

  it('changes with the deck snapshot, the format and each option', () => {
    const deck = emptySododeckFile();
    const base = keyAfter()(deck);
    expect(keyAfter()(structuredClone(deck))).not.toBe(base);
    expect(keyAfter({ type: 'format', format: 'svg' })(deck)).not.toBe(base);
    expect(keyAfter({ type: 'option', options: { json: { pretty: false } } })(deck)).not.toBe(base);
    expect(
      keyAfter({ type: 'option', options: { json: { includeKnowledge: false } } })(deck),
    ).not.toBe(base);
    const svg = keyAfter({ type: 'format', format: 'svg' })(deck);
    expect(
      keyAfter(
        { type: 'format', format: 'svg' },
        { type: 'option', options: { svg: { transparent: true } } },
      )(deck),
    ).not.toBe(svg);
    expect(
      keyAfter({ type: 'format', format: 'svg' }, { type: 'scope', scope: 'view' })(deck),
    ).not.toBe(svg);
    expect(keyAfter({ type: 'retry' })(deck)).not.toBe(base);
  });

  it('ignores the PNG scale (the footer derives the size from the bounds)', () => {
    const deck = emptySododeckFile();
    const png = keyAfter({ type: 'format', format: 'png' })(deck);
    expect(
      keyAfter(
        { type: 'format', format: 'png' },
        { type: 'option', options: { png: { scale: 3 } } },
      )(deck),
    ).toBe(png);
  });

  it('includes the view and flow UI values only for those scopes', () => {
    const deck = emptySododeckFile();
    const state = exportReducer(initialExportState({ flowMode: false }), {
      type: 'format',
      format: 'png',
    });
    const deckKey = exportRequestKey(exportRequest(state), deck, ui);
    expect(exportRequestKey(exportRequest(state), deck, { ...ui, currentViewId: 'v' })).toBe(
      deckKey,
    );
    const view = exportReducer(state, { type: 'scope', scope: 'view' });
    expect(exportRequestKey(exportRequest(view), deck, { ...ui, currentViewId: 'v' })).not.toBe(
      exportRequestKey(exportRequest(view), deck, ui),
    );
  });
});

describe('exportRequestKey for schema formats (045)', () => {
  const deck = emptySododeckFile();
  const sql = exportReducer(initialExportState({ flowMode: false }), {
    type: 'format',
    format: 'sql',
  });
  const schema = (patch: Partial<SchemaRequest['request']> = {}): SchemaRequest => ({
    request: {
      format: 'sql',
      scope: { kind: 'deck' },
      dialect: null,
      sql: DEFAULT_SQL_OPTIONS,
      ...patch,
    },
    scopeTitle: null,
    needsDialect: false,
  });
  const key = (s: SchemaRequest) => exportRequestKey(exportRequest(sql, s), deck, ui);

  it('changes with the scope ids, the dialect and each SQL option', () => {
    const base = key(schema());
    expect(key(schema())).toBe(base);
    expect(key(schema({ scope: { kind: 'selection', tableIds: ['a'] } }))).not.toBe(base);
    expect(key(schema({ scope: { kind: 'selection', tableIds: ['a', 'b'] } }))).not.toBe(
      key(schema({ scope: { kind: 'selection', tableIds: ['a'] } })),
    );
    expect(key(schema({ scope: { kind: 'database', cardId: 'c' } }))).not.toBe(base);
    expect(key(schema({ dialect: 'mysql' }))).not.toBe(base);
    expect(key(schema({ sql: { ...DEFAULT_SQL_OPTIONS, ifNotExists: true } }))).not.toBe(base);
  });

  it('drops the schema request for the other formats, so their keys do not change', () => {
    const json = initialExportState({ flowMode: false });
    expect(exportRequest(json, schema()).schema).toBeNull();
    expect(exportRequestKey(exportRequest(json, schema()), deck, ui)).toBe(
      exportRequestKey(exportRequest(json), deck, ui),
    );
  });
});

describe('pngSizeHint', () => {
  it('formats the pixel size at the given scale', () => {
    expect(pngSizeHint({ width: 1090, height: 660 }, 2)).toBe('2180 × 1320 px');
  });
});
