import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useReducedMotion } from '../src/hooks/use-reduced-motion';

type Listener = (event: MediaQueryListEvent) => void;

/** A matchMedia stand-in whose `matches` value the test can flip. */
function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const list = {
    matches: initial,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((_type: string, listener: Listener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: Listener) => listeners.delete(listener)),
  };
  vi.spyOn(window, 'matchMedia').mockReturnValue(list as unknown as MediaQueryList);
  return {
    list,
    listeners,
    set(matches: boolean) {
      list.matches = matches;
      for (const listener of listeners) listener({ matches } as MediaQueryListEvent);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useReducedMotion', () => {
  it('follows the media query live', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      media.set(true);
    });
    expect(result.current).toBe(true);
  });

  it('unsubscribes on unmount', () => {
    const media = mockMatchMedia(true);
    const { result, unmount } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
    unmount();
    expect(media.list.removeEventListener).toHaveBeenCalled();
    expect(media.listeners.size).toBe(0);
  });

  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    try {
      const { result } = renderHook(() => useReducedMotion());
      expect(result.current).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
