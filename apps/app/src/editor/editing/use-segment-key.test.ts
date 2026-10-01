import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { NUDGE_IDLE_MS } from './use-nudge';
import { createSegmentKeyer } from './use-segment-key';

const horizontalFile = (): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b' }],
});

const verticalFile = (): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 0, y: 300 } },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b' }],
});

const initialUi = useUiStore.getState();

function setup(file: SododeckFile) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc) };
}

beforeEach(() => {
  useUiStore.setState(initialUi, true);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const arrow = (key: string, shift = false) => ({
  key,
  shiftKey: shift,
  metaKey: false,
  ctrlKey: false,
});

describe('⌥(⇧) arrow segment move (017 R9)', () => {
  it('moves a horizontal (left/right) connection by 1 / 10 px across the segment', () => {
    const { doc, editor } = setup(horizontalFile());
    useUiStore.getState().select({ edges: ['e'] });
    const keyer = createSegmentKeyer(editor);
    expect(keyer.key(arrow('ArrowRight'), 'container')).toBe(true);
    expect(keyer.key(arrow('ArrowRight', true), 'container')).toBe(true);
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).edges[0]?.route).toEqual({ offset: 11 });
    expect(useUiStore.getState().announcement.text).toBe('Moved middle segment to +11');
  });

  it('does nothing for the arrow along the segment (still handled, no nudge fallback)', () => {
    const { doc, editor } = setup(horizontalFile());
    useUiStore.getState().select({ edges: ['e'] });
    const keyer = createSegmentKeyer(editor);
    expect(keyer.key(arrow('ArrowUp'), 'container')).toBe(true);
    expect(toJSON(doc).edges[0]?.route).toBeUndefined();
  });

  it('moves a vertical (top/bottom) connection with up/down, undoing in one step', () => {
    const { doc, editor } = setup(verticalFile());
    useUiStore.getState().select({ edges: ['e'] });
    const keyer = createSegmentKeyer(editor);
    keyer.key(arrow('ArrowUp'), 'container');
    keyer.key(arrow('ArrowUp'), 'container');
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).edges[0]?.route).toEqual({ offset: -2 });
    editor.undo();
    expect(toJSON(doc).edges[0]?.route).toBeUndefined();
  });

  it('does nothing when more than the connection is selected, or nothing is', () => {
    const { editor } = setup(horizontalFile());
    const keyer = createSegmentKeyer(editor);
    expect(keyer.key(arrow('ArrowRight'), 'container')).toBe(false);
    useUiStore.getState().select({ edges: ['e'], nodes: ['a'] });
    expect(keyer.key(arrow('ArrowRight'), 'container')).toBe(false);
  });

  it('ignores a key that is not an arrow', () => {
    const { editor } = setup(horizontalFile());
    useUiStore.getState().select({ edges: ['e'] });
    const keyer = createSegmentKeyer(editor);
    expect(
      keyer.key({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false }, 'container'),
    ).toBe(false);
  });
});
