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

const target = (width = 184, height = 76) => ({ id: 'n1', title: 'API Gateway', width, height });

describe('⌘⇧ arrow resize (017 R9/R10)', () => {
  it('grows 4 px with → and ↓, keeping the top-left corner', () => {
    const { doc, editor } = setup();
    const keyer = createResizeKeyer(editor);
    keyer.key({ key: 'ArrowRight' }, target());
    keyer.key({ key: 'ArrowDown' }, target(188, 76));
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).nodes[0]?.size).toEqual({ width: 188, height: 80 });
    expect(toJSON(doc).nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });

  it('shrinks 4 px with ← and ↑, clamped to the minimum', () => {
    const { doc, editor } = setup();
    const keyer = createResizeKeyer(editor);
    for (let i = 0; i < 20; i++) keyer.key({ key: 'ArrowLeft' }, target());
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).nodes[0]?.size?.width).toBe(120);
  });

  it('clamps a shape to its own minimum (031)', () => {
    const { doc, editor } = setup();
    const keyer = createResizeKeyer(editor);
    const limits = {
      min: { width: 40, height: 24 },
      max: { width: 800, height: 600 },
      step: 4,
    };
    for (let i = 0; i < 60; i++) keyer.key({ key: 'ArrowLeft' }, { ...target(160, 40), limits });
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).nodes[0]?.size?.width).toBe(40);
  });

  it('is one undo step for the whole burst, and announces the final size', () => {
    const { doc, editor } = setup();
    const keyer = createResizeKeyer(editor);
    keyer.key({ key: 'ArrowRight' }, target());
    keyer.key({ key: 'ArrowRight' }, target(188, 76));
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(toJSON(doc).nodes[0]?.size).toEqual({ width: 192, height: 76 });
    expect(useUiStore.getState().announcement.text).toBe('Resized API Gateway to 192 × 76');
    editor.undo();
    expect(toJSON(doc).nodes[0]?.size).toBeUndefined();
  });

  it('ignores a key that is not an arrow', () => {
    const { editor } = setup();
    const keyer = createResizeKeyer(editor);
    expect(keyer.key({ key: 'Enter' }, target())).toBe(false);
  });
});
