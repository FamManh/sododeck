import { act, render, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { memoryPictureStore, PictureStoreContext, type PictureStore } from './picture-store';
import { RETRY_MS } from './picture-url-cache';
import { PNG_1X1 } from './test-pictures';
import { usePictureUrl } from './use-picture-url';

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  let n = 0;
  URL.createObjectURL = () => {
    const url = `blob:test/${String(n++)}`;
    created.push(url);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
});

afterEach(() => {
  vi.useRealTimers();
});

function wrapperFor(store: PictureStore | null) {
  return ({ children }: { children: ReactNode }) => (
    <PictureStoreContext value={store}>{children}</PictureStoreContext>
  );
}

describe('usePictureUrl (055)', () => {
  it('is loading, then ready with an object URL for a stored picture', async () => {
    const store = memoryPictureStore();
    await store.put('p1', { type: 'image/png', bytes: PNG_1X1 });
    const { result } = renderHook(() => usePictureUrl('p1'), { wrapper: wrapperFor(store) });
    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', url: 'blob:test/0' });
    });
  });

  it('shares one URL between views of a picture and revokes it with the last one', async () => {
    const store = memoryPictureStore();
    await store.put('p1', { type: 'image/png', bytes: PNG_1X1 });
    const wrapper = wrapperFor(store);
    const a = renderHook(() => usePictureUrl('p1'), { wrapper });
    const b = renderHook(() => usePictureUrl('p1'), { wrapper });
    await waitFor(() => {
      expect(a.result.current.status).toBe('ready');
      expect(b.result.current.status).toBe('ready');
    });
    expect(created).toHaveLength(1);
    a.unmount();
    expect(revoked).toEqual([]);
    b.unmount();
    expect(revoked).toEqual(['blob:test/0']);
  });

  it('retries once after a second, then reports the picture missing', async () => {
    vi.useFakeTimers();
    const store = memoryPictureStore();
    const get = vi.spyOn(store, 'get');
    const { result } = renderHook(() => usePictureUrl('absent'), { wrapper: wrapperFor(store) });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('loading');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_MS);
    });
    expect(result.current.status).toBe('missing');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('picks up a row that arrives late, on the retry', async () => {
    vi.useFakeTimers();
    const store = memoryPictureStore();
    const { result } = renderHook(() => usePictureUrl('late'), { wrapper: wrapperFor(store) });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await store.put('late', { type: 'image/png', bytes: PNG_1X1 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_MS);
    });
    expect(result.current.status).toBe('ready');
  });

  it('looks again when the window regains focus while missing', async () => {
    vi.useFakeTimers();
    const store = memoryPictureStore();
    const { result } = renderHook(() => usePictureUrl('focus'), { wrapper: wrapperFor(store) });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETRY_MS + 10);
    });
    expect(result.current.status).toBe('missing');
    await store.put('focus', { type: 'image/png', bytes: PNG_1X1 });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe('ready');
  });

  it('is missing without a store', () => {
    const { result } = renderHook(() => usePictureUrl('x'), { wrapper: wrapperFor(null) });
    expect(result.current.status).toBe('missing');
  });

  it('renders nothing different for unrelated decks: two stores keep two URLs', async () => {
    const one = memoryPictureStore();
    const two = memoryPictureStore();
    await one.put('p', { type: 'image/png', bytes: PNG_1X1 });
    await two.put('p', { type: 'image/png', bytes: PNG_1X1 });
    function Probe() {
      return null;
    }
    render(<Probe />);
    const a = renderHook(() => usePictureUrl('p'), { wrapper: wrapperFor(one) });
    const b = renderHook(() => usePictureUrl('p'), { wrapper: wrapperFor(two) });
    await waitFor(() => {
      expect(a.result.current.status).toBe('ready');
      expect(b.result.current.status).toBe('ready');
    });
    expect(created).toHaveLength(2);
  });
});
