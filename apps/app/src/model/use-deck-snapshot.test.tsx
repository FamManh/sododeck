import { fromJSON } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type * as Y from 'yjs';

import { useDeckSnapshot } from './use-deck-snapshot';

describe('useDeckSnapshot', () => {
  it('re-renders with fresh JSON when the Yjs document changes', () => {
    const doc = fromJSON({ ...emptySododeckFile(), nodes: [{ id: 'a', title: 'A' }] });
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
});
