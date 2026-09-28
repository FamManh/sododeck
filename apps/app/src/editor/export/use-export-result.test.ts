import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { exportReducer, initialExportState, type ExportAction } from './export-dialog-state';
import { exportRequest, exportRequestKey, pngSizeHint } from './use-export-result';

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

describe('pngSizeHint', () => {
  it('formats the pixel size at the given scale', () => {
    expect(pngSizeHint({ width: 1090, height: 660 }, 2)).toBe('2180 × 1320 px');
  });
});
