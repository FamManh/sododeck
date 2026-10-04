import { describe, expect, it } from 'vitest';

import { exportReducer, initialExportState, type ExportResult } from './export-dialog-state';

const result: ExportResult = {
  fileName: 'deck.svg',
  sizeHint: '1.0 KB',
  text: '<svg/>',
  svg: '<svg/>',
  bounds: { width: 100, height: 50 },
  notes: [],
};

describe('export dialog state', () => {
  it('defaults based on flow mode', () => {
    const ordinary = initialExportState({ flowMode: false });
    expect(ordinary.format).toBe('json');
    expect(ordinary.imageScope).toBe('deck');
    expect(ordinary.options).toEqual({
      json: { includeKnowledge: true, pretty: true },
      png: { scale: 2, transparent: false },
      svg: { transparent: false },
      sql: { enumsAndIndexes: true, junctionTables: true, ifNotExists: false },
    });
    expect(ordinary.schemaScope).toBe('deck');
    expect(ordinary.sqlDialect).toBeNull();
    expect(initialExportState({ flowMode: false, schemaScope: 'database' }).schemaScope).toBe(
      'database',
    );
    const flow = initialExportState({ flowMode: true });
    expect(flow.format).toBe('png');
    expect(flow.imageScope).toBe('flow');
  });

  it('keeps image scope across format changes and rejects unavailable flow', () => {
    let state = initialExportState({ flowMode: true });
    state = exportReducer(state, { type: 'format', format: 'json' });
    expect(state.imageScope).toBe('flow');
    state = exportReducer(state, { type: 'format', format: 'png' });
    expect(state.imageScope).toBe('flow');
    state = exportReducer(state, { type: 'flowGone' });
    expect(state.imageScope).toBe('deck');
    expect(state.scopeNote).toBe('flow-deleted');
    expect(exportReducer(state, { type: 'scope', scope: 'flow' })).toBe(state);
  });

  it('settles only current work and can retry', () => {
    let state = initialExportState({ flowMode: false });
    state = exportReducer(state, { type: 'preparing', key: 'new' });
    expect(exportReducer(state, { type: 'settled', key: 'old', result })).toBe(state);
    state = exportReducer(state, { type: 'settled', key: 'new', result });
    expect(state.result).toEqual({ status: 'ready', key: 'new', result });
    state = exportReducer(state, { type: 'settled', key: 'new', result: 'error' });
    state = exportReducer(state, { type: 'retry' });
    expect(state.result).toEqual({ status: 'preparing', key: 'new' });
    expect(state.retryCount).toBe(1);
  });

  it('changes options and clamps the PNG scale', () => {
    let state = initialExportState({ flowMode: false });
    state = exportReducer(state, {
      type: 'option',
      options: { png: { scale: 3, transparent: true } },
    });
    state = exportReducer(state, { type: 'clampScale', max: 1 });
    expect(state.options.png).toEqual({ scale: 1, transparent: true });
  });

  it('merges SQL options without touching the other formats (045)', () => {
    const before = initialExportState({ flowMode: false });
    const after = exportReducer(before, {
      type: 'option',
      options: { sql: { ifNotExists: true } },
    });
    expect(after.options.sql).toEqual({
      enumsAndIndexes: true,
      junctionTables: true,
      ifNotExists: true,
    });
    expect(after.options.json).toBe(before.options.json);
    expect(after.options.png).toBe(before.options.png);
  });

  it('keeps the schema scope and the picked dialect across format switches (045)', () => {
    let state = initialExportState({ flowMode: false });
    state = exportReducer(state, { type: 'format', format: 'sql' });
    state = exportReducer(state, { type: 'sqlDialect', dialect: 'mysql' });
    state = exportReducer(state, { type: 'schemaScope', scope: 'selection' });
    state = exportReducer(state, { type: 'format', format: 'png' });
    state = exportReducer(state, { type: 'format', format: 'sql' });
    expect(state.sqlDialect).toBe('mysql');
    expect(state.schemaScope).toBe('selection');
    expect(state.imageScope).toBe('deck');
  });

  it('settles a SQL request that waits for a dialect', () => {
    let state = exportReducer(initialExportState({ flowMode: false }), {
      type: 'preparing',
      key: 'k',
    });
    state = exportReducer(state, { type: 'settled', key: 'k', result: 'needs-dialect' });
    expect(state.result).toEqual({ status: 'needs-dialect', key: 'k' });
  });
});
