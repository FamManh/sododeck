import { toJSON } from '@sododeck/model';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { createBurst, NUDGE_IDLE_MS, nudgeDistance, useNudge } from './use-nudge';

const ui = () => useUiStore.getState();
const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'g', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
  ],
  groups: [
    { id: 'g', title: 'G', position: { x: -24, y: -24 }, size: { width: 212, height: 152 } },
  ],
});
const arrow = (key: string, shiftKey = false) => ({
  key,
  altKey: true,
  shiftKey,
  metaKey: false,
  ctrlKey: false,
});

function setup() {
  const env = editorWrapper(deck);
  const { result } = renderHook(() => useNudge(), { wrapper: env.wrapper });
  return { ...env, nudger: () => result.current };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('⌥ arrow nudges (016 US5, R8)', () => {
  it('moves 1 px, or 10 px with ⇧', () => {
    const { doc, nudger } = setup();
    act(() => {
      ui().select({ nodes: ['b'] });
      nudger().key(arrow('ArrowRight'));
      nudger().key(arrow('ArrowDown', true));
    });
    expect(toJSON(doc).nodes[1]?.position).toEqual({ x: 301, y: 10 });
  });

  it('undoes a burst in one step and announces it when the burst ends', () => {
    const { doc, editor, nudger } = setup();
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
      for (let i = 0; i < 3; i++) nudger().key(arrow('ArrowRight', true));
      vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    });
    expect(toJSON(doc).nodes[1]?.position).toEqual({ x: 330, y: 0 });
    expect(ui().announcement.text).toBe('Moved 2 components 30 px right');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).nodes[1]?.position).toEqual({ x: 300, y: 0 });
    expect(editor().canUndo()).toBe(false);
  });

  it('starts a new step after a 1 s pause', () => {
    const { doc, editor, nudger } = setup();
    act(() => {
      ui().select({ nodes: ['b'] });
      nudger().key(arrow('ArrowLeft'));
      vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
      nudger().key(arrow('ArrowLeft'));
      vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
      editor().undo();
    });
    expect(toJSON(doc).nodes[1]?.position).toEqual({ x: 299, y: 0 });
  });

  it('ends the burst on another key or a pointer down', () => {
    const { doc, editor, nudger } = setup();
    act(() => {
      ui().select({ nodes: ['b'] });
      nudger().key(arrow('ArrowUp'));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      nudger().key(arrow('ArrowUp'));
      document.dispatchEvent(new Event('pointerdown'));
      editor().undo();
    });
    expect(toJSON(doc).nodes[1]?.position).toEqual({ x: 300, y: -1 });
  });

  it('moves a selected group with its frame and members', () => {
    const { doc, nudger } = setup();
    act(() => {
      ui().select({ groups: ['g'] });
      nudger().key(arrow('ArrowRight', true));
    });
    const file = toJSON(doc);
    expect(file.nodes[0]?.position).toEqual({ x: 10, y: 0 });
    expect(file.groups[0]?.position).toEqual({ x: -14, y: -24 });
  });

  it('leaves plain arrows alone and does nothing without a selection or in flow mode', () => {
    const { doc, nudger } = setup();
    expect(nudger().key({ ...arrow('ArrowRight'), altKey: false })).toBe(false);
    expect(nudger().key(arrow('ArrowRight'))).toBe(false);
    act(() => {
      ui().select({ nodes: ['b'] });
      useUiStore.setState({
        activeFlow: {
          flowId: 'f',
          stepId: null,
          branchId: null,
          alternativeId: null,
          playing: false,
          speed: 1,
        },
        selection: { ...ui().selection, nodes: ['b'] },
      });
    });
    expect(nudger().key(arrow('ArrowRight'))).toBe(false);
    expect(toJSON(doc).nodes[1]?.position).toEqual({ x: 300, y: 0 });
  });

  it('names the distance', () => {
    expect(nudgeDistance({ x: 30, y: 0 })).toBe('30 px right');
    expect(nudgeDistance({ x: 0, y: -10 })).toBe('10 px up');
    expect(nudgeDistance({ x: -1, y: 2 })).toBe('1 px left and 2 px down');
  });
});

describe('createBurst (017 R9)', () => {
  it('opens on the first step, calls onStep every step, and closes once after the idle timeout', () => {
    const onFirst = vi.fn();
    const onStep = vi.fn();
    const onEnd = vi.fn();
    const burst = createBurst(onFirst, onStep, onEnd);
    expect(burst.isOpen()).toBe(false);
    burst.step();
    expect(onFirst).toHaveBeenCalledOnce();
    expect(onStep).toHaveBeenCalledOnce();
    expect(burst.isOpen()).toBe(true);
    burst.step();
    burst.step();
    expect(onFirst).toHaveBeenCalledOnce();
    expect(onStep).toHaveBeenCalledTimes(3);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NUDGE_IDLE_MS + 10);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(burst.isOpen()).toBe(false);
  });

  it('ends on demand, and a second end is a no-op', () => {
    const onEnd = vi.fn();
    const burst = createBurst(vi.fn(), vi.fn(), onEnd);
    burst.step();
    burst.end();
    expect(onEnd).toHaveBeenCalledOnce();
    burst.end();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('starts a fresh burst (onFirst again) after ending', () => {
    const onFirst = vi.fn();
    const burst = createBurst(onFirst, vi.fn(), vi.fn());
    burst.step();
    burst.end();
    burst.step();
    expect(onFirst).toHaveBeenCalledTimes(2);
  });

  it('resets the idle timer on every step', () => {
    const onEnd = vi.fn();
    const burst = createBurst(vi.fn(), vi.fn(), onEnd);
    burst.step();
    vi.advanceTimersByTime(NUDGE_IDLE_MS - 10);
    burst.step();
    vi.advanceTimersByTime(NUDGE_IDLE_MS - 10);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(onEnd).toHaveBeenCalledOnce();
  });
});

describe('locked cards (043 FR-024)', () => {
  it('nudges only the unlocked cards of a selection', () => {
    const env = editorWrapper(
      deckOf({
        nodes: [
          { id: 'a', type: 'service', title: 'A', locked: true, position: { x: 0, y: 0 } },
          { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
        ],
      }),
    );
    const { result } = renderHook(() => useNudge(), { wrapper: env.wrapper });
    act(() => {
      ui().select({ nodes: ['a', 'b'] });
      result.current.key(arrow('ArrowRight'));
    });
    const nodes = toJSON(env.doc).nodes;
    expect(nodes[0]?.position).toEqual({ x: 0, y: 0 });
    expect(nodes[1]?.position).toEqual({ x: 301, y: 0 });
  });
});
