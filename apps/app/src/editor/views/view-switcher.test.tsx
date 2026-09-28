import { serializeDeck, toJSON } from '@sododeck/model';
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';

const deck = deckOf({
  nodes: [
    { id: 'app', type: 'client', title: 'App', tech: 'Swift', host: 'App Store' },
    { id: 'api', type: 'service', title: 'API', tech: 'Go', host: 'k8s' },
  ],
  edges: [{ id: 'e', from: 'app', to: 'api' }],
});

describe('views never write on open or switch (FR-001, FR-005)', () => {
  it('leaves a deck without views byte-identical after three switches', () => {
    const { doc, editor } = renderWithEditor(<Canvas />, deck);
    const before = serializeDeck(toJSON(doc));
    for (const id of ['infra', 'feature', 'system']) {
      act(() => {
        useUiStore.getState().switchView(id);
      });
    }
    expect(serializeDeck(toJSON(doc))).toBe(before);
    expect(editor().canUndo()).toBe(false);
  });
});
