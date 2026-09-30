import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { NUDGE_IDLE_MS } from './use-nudge';
import { createResizeKeyer } from './use-resize-key';

const file = (): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [{ id: 'n1', type: 'service', title: 'API Gateway', position: { x: 0, y: 0 } }],
});

const initialUi = useUiStore.getState();

function setup() {
  const doc = fromJSON(file());
  return { doc, editor: createEditor(doc) };
}

beforeEach(() => {
  useUiStore.setState(initialUi, true);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const target = (width = 164, height = 50) => ({ id: 'n1', title: 'API Gateway', width, height });

describe('⌘⇧ arrow resize (017 R9/R10)', () => {
  it('grows 4 px with → and ↓, keeping the top-left corner', () => {
    const { doc, editor } = setup();
    const keyer = createResizeKeyer(editor);
    keyer.key({ key: 'ArrowRight' }, target());
    keyer.key({ key: 'ArrowDown' }, target(168, 50));
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).nodes[0]?.size).toEqual({ width: 168, height: 54 });
    expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });

  it('shrinks 4 px with ← and ↑, clamped to the minimum', () => {
    const { doc, editor } = setup();
    const keyer = createResizeKeyer(editor);
    for (let i = 0; i < 20; i++) keyer.key({ key: 'ArrowLeft' }, target());
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).nodes[0]?.size?.width).toBe(120);
  });

  it('is one undo step for the whole burst, and announces the final size', () => {
    const { doc, editor } = setup();
    const keyer = createResizeKeyer(editor);
    keyer.key({ key: 'ArrowRight' }, target());
    keyer.key({ key: 'ArrowRight' }, target(168, 50));
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).nodes[0]?.size).toEqual({ width: 172, height: 50 });
    expect(useUiStore.getState().announcement.text).toBe('Resized API Gateway to 172 × 50');
    editor.undo();
    expect(toJSON(doc).nodes[0]?.size).toBeUndefined();
  });

  it('ignores a key that is not an arrow', () => {
    const { editor } = setup();
    const keyer = createResizeKeyer(editor);
    expect(keyer.key({ key: 'Enter' }, target())).toBe(false);
  });
});
