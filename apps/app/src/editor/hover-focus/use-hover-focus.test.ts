import { act, renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { editorWrapper } from '../../test/render-canvas';
import { useUiStore } from '../../state/ui-store';
import { GRACE_MS, REST_MS, useHoverFocus } from './use-hover-focus';

const mouse = {} as ReactMouseEvent;
const node = (id: string) => ({ id }) as never;
const hover = () => useUiStore.getState().hoverFocus;

function setup() {
  const { wrapper } = editorWrapper();
  return renderHook(() => useHoverFocus(), { wrapper });
}

describe('useHoverFocus (034 R3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for a 150 ms rest before lighting a card', () => {
    const { result } = setup();
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
    });
    act(() => {
      vi.advanceTimersByTime(REST_MS - 1);
    });
    expect(hover()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hover()).toEqual({ id: 'a', source: 'pointer' });
  });

  it('does nothing for a sweep shorter than the rest', () => {
    const { result } = setup();
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(60);
      result.current.onNodeMouseLeave(mouse, node('a'));
      result.current.onNodeMouseEnter(mouse, node('b'));
      vi.advanceTimersByTime(60);
      result.current.onNodeMouseLeave(mouse, node('b'));
      vi.advanceTimersByTime(1000);
    });
    expect(hover()).toBeNull();
  });

  it('switches at once when moving card to card while a hover shows', () => {
    const { result } = setup();
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(REST_MS);
    });
    act(() => {
      result.current.onNodeMouseLeave(mouse, node('a'));
      result.current.onNodeMouseEnter(mouse, node('b'));
    });
    expect(hover()).toEqual({ id: 'b', source: 'pointer' });
  });

  it('clears 100 ms after leaving, and re-entering within it cancels the clear', () => {
    const { result } = setup();
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(REST_MS);
    });
    act(() => {
      result.current.onNodeMouseLeave(mouse, node('a'));
      vi.advanceTimersByTime(GRACE_MS - 1);
    });
    expect(hover()?.id).toBe('a');
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(GRACE_MS);
    });
    expect(hover()?.id).toBe('a');
    act(() => {
      result.current.onNodeMouseLeave(mouse, node('a'));
      vi.advanceTimersByTime(GRACE_MS);
    });
    expect(hover()).toBeNull();
  });

  it('ignores touch', () => {
    const { result } = setup();
    act(() => {
      result.current.notePointerType('touch');
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(REST_MS * 2);
    });
    expect(hover()).toBeNull();
    act(() => {
      result.current.notePointerType('mouse');
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(REST_MS);
    });
    expect(hover()?.id).toBe('a');
  });

  it('lights a focused card at once from the keyboard, and clears on blur', () => {
    const { result } = setup();
    act(() => {
      result.current.onCardFocus('a');
    });
    expect(hover()).toEqual({ id: 'a', source: 'keyboard' });
    act(() => {
      result.current.onCardBlur();
    });
    expect(hover()).toBeNull();
  });

  it('does not let a blur clear a pointer hover', () => {
    const { result } = setup();
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(REST_MS);
      result.current.onCardBlur();
    });
    expect(hover()?.source).toBe('pointer');
  });

  it.each(['sticky:s1', 'port:p1', 'scope-label:g'])('never starts a hover on %s', (id) => {
    const { result } = setup();
    act(() => {
      result.current.onNodeMouseEnter(mouse, node(id));
      result.current.onCardFocus(id);
      vi.advanceTimersByTime(REST_MS * 2);
    });
    expect(hover()).toBeNull();
  });

  it.each([
    ['pinned focus', { focusMode: true }],
    ['a shown flow', { activeFlow: { flowId: 'f' } }],
    ['a flow session', { flowSession: { flowId: 'f' } }],
    ['a drag', { canvasGesture: 'drag' }],
    ['a resize', { canvasGesture: 'card-resize' }],
    ['a connector end drag', { endpointPreview: { edgeId: 'e1' } }],
    ['the hand tool', { tool: 'hand' }],
    ['an open popover', { popover: { kind: 'edge', edgeId: 'e1' } }],
    ['an open menu', { contextMenu: { target: { kind: 'canvas' } } }],
  ])('is suspended during %s', (_name, patch) => {
    const { result } = setup();
    act(() => {
      useUiStore.setState(patch as never);
    });
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
      result.current.onCardFocus('b');
      vi.advanceTimersByTime(REST_MS * 2);
    });
    expect(hover()).toBeNull();
  });

  it('clears a hover that is showing when a suspension starts', () => {
    const { result } = setup();
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(REST_MS);
    });
    expect(hover()?.id).toBe('a');
    act(() => {
      useUiStore.setState({ canvasGesture: 'drag' });
    });
    expect(hover()).toBeNull();
  });

  it('announces a keyboard focus politely, never a pointer hover', () => {
    const { result } = setup();
    act(() => {
      result.current.onNodeMouseEnter(mouse, node('a'));
      vi.advanceTimersByTime(REST_MS);
    });
    expect(useUiStore.getState().announcement.text).toBe('');
    act(() => {
      result.current.onCardFocus('b', 'B: 3 connections');
    });
    expect(useUiStore.getState().announcement.text).toBe('B: 3 connections');
  });
});
