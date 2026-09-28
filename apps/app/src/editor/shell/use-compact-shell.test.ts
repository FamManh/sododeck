import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { COMPACT_QUERY, useCompactShell } from './use-compact-shell';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCompactShell (018 FR-041)', () => {
  it('follows the 1279 px media query', () => {
    let matches = true;
    let listener: (() => void) | undefined;
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === COMPACT_QUERY && matches;
      },
      addEventListener: (_: string, fn: () => void) => {
        listener = fn;
      },
      removeEventListener: () => undefined,
    }));
    const { result } = renderHook(() => useCompactShell());
    expect(result.current).toBe(true);
    act(() => {
      matches = false;
      listener?.();
    });
    expect(result.current).toBe(false);
  });

  it('is never compact without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useCompactShell());
    expect(result.current).toBe(false);
  });
});
