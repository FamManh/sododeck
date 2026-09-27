import { createEditor, fromJSON } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type * as Y from 'yjs';

import { useDeckSnapshot } from './use-deck-snapshot';

const twoNodes = () =>
  fromJSON({
    ...emptySododeckFile(),
    nodes: [
      { id: 'a', type: 'service', title: 'A' },
      { id: 'b', type: 'database', title: 'B' },
    ],
  });

describe('useDeckSnapshot', () => {
  it('re-renders with fresh JSON when the Yjs document changes', () => {
    const doc = twoNodes();
    const { result } = renderHook(() => useDeckSnapshot(doc));
    const first = result.current;
    expect(first.nodes[0]?.title).toBe('A');

    act(() => {
      doc.getArray<Y.Map<unknown>>('nodes').get(0).set('title', 'B');
    });

    expect(result.current.nodes[0]?.title).toBe('B');
    expect(result.current).not.toBe(first);
  });

  it('returns a stable snapshot between updates', () => {
    const doc = fromJSON(emptySododeckFile());
    const { result, rerender } = renderHook(() => useDeckSnapshot(doc));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('re-renders once per edit and keeps untouched nodes identical', () => {
    const doc = twoNodes();
    const editor = createEditor(doc);
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useDeckSnapshot(doc);
    });
    const before = result.current;
    const rendersBefore = renders;
    act(() => {
      editor.update('nodes', 'a', { position: { x: 5, y: 5 } });
    });
    expect(renders - rendersBefore).toBe(1);
    expect(result.current.nodes[0]).not.toBe(before.nodes[0]);
    expect(result.current.nodes[1]).toBe(before.nodes[1]);
  });
});
