import * as model from '@sododeck/model';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { demoDeck } from './demo-deck';
import { useThrottledDeckText } from './use-throttled-deck-text';

vi.mock('@sododeck/model', async (importOriginal) => {
  const actual = await importOriginal<typeof model>();
  return { ...actual, serializeDeck: vi.fn(actual.serializeDeck) };
});

const serializeDeck = vi.mocked(model.serializeDeck);

function setup(enabled: boolean) {
  const doc = model.fromJSON(demoDeck);
  const editor = model.createEditor(doc);
  const hook = renderHook(
    ({ on }: { on: boolean }) => useThrottledDeckText(useDeckSnapshot(doc), on),
    { initialProps: { on: enabled } },
  );
  const exported = () => serializeDeck.getMockImplementation()?.(model.toJSON(doc)) ?? '';
  return { doc, editor, hook, exported };
}

beforeEach(() => {
  vi.useFakeTimers();
  serializeDeck.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useThrottledDeckText', () => {
  it('returns the deck text on the first render (leading)', () => {
    const { hook, exported } = setup(true);
    expect(hook.result.current).toBe(exported());
    expect(serializeDeck).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst of edits into one trailing update within 250 ms', () => {
    const { editor, hook, exported } = setup(true);
    serializeDeck.mockClear();
    for (let i = 0; i < 5; i++) {
      act(() => {
        editor.update('nodes', 'web-app', { title: `Web ${String(i)}` });
        vi.advanceTimersByTime(20);
      });
    }
    expect(serializeDeck).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(serializeDeck).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toBe(exported());
    expect(hook.result.current).toContain('"Web 4"');
  });

  it('updates at once when the last update is older than 250 ms', () => {
    const { editor, hook } = setup(true);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      editor.update('nodes', 'web-app', { title: 'Now' });
    });
    expect(hook.result.current).toContain('"Now"');
  });

  it('never serializes while disabled, and computes once when enabled', () => {
    const { editor, hook, exported } = setup(false);
    act(() => {
      editor.update('nodes', 'web-app', { title: 'Hidden' });
      vi.advanceTimersByTime(1000);
    });
    expect(serializeDeck).not.toHaveBeenCalled();
    hook.rerender({ on: true });
    expect(serializeDeck).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toBe(exported());
  });

  it('computes at once when enabled again, even inside the throttle window', () => {
    const { editor, hook, exported } = setup(true);
    hook.rerender({ on: false });
    act(() => {
      editor.update('nodes', 'web-app', { title: 'While hidden' });
    });
    hook.rerender({ on: true });
    expect(hook.result.current).toBe(exported());
    expect(hook.result.current).toContain('"While hidden"');
  });
});
