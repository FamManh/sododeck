import * as model from '@sododeck/model';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeckSnapshot } from '../model/use-deck-snapshot';
import { demoDeck } from './demo-deck';
import { deckPanelText, useThrottledDeckText } from './use-throttled-deck-text';

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

describe('deckPanelText (055)', () => {
  const asset = 'c'.repeat(64);
  const withImages = {
    ...demoDeck,
    images: [{ id: 'i1', asset, position: { x: 0, y: 0 }, size: { width: 80, height: 40 } }],
    assets: {
      [asset]: {
        type: 'image/png' as const,
        bytes: 90,
        width: 8,
        height: 4,
        name: 'a.png',
        data: '',
      },
    },
  };

  it('shows image records and picture facts, never picture data, and stays valid JSON', () => {
    const text = deckPanelText(withImages);
    expect(text).not.toContain('"data"');
    expect(text).not.toMatch(/[A-Za-z0-9+/]{100,}/);
    const parsed = JSON.parse(text) as { images: unknown[]; assets: Record<string, unknown> };
    expect(parsed.images).toHaveLength(1);
    expect(parsed.assets[asset]).toEqual({
      type: 'image/png',
      bytes: 90,
      width: 8,
      height: 4,
      name: 'a.png',
    });
  });

  it('is exactly the exported file for a deck without images', () => {
    expect(deckPanelText(demoDeck)).toBe(model.serializeDeck(demoDeck));
  });

  it('stays small for many images: a few hundred bytes each', () => {
    const many = {
      ...withImages,
      images: Array.from({ length: 50 }, (_, i) => ({
        id: `i${String(i)}`,
        asset,
        position: { x: i, y: 0 },
        size: { width: 80, height: 40 },
      })),
    };
    expect(deckPanelText(many).length - deckPanelText(demoDeck).length).toBeLessThan(
      50 * 400 + 400,
    );
  });
});
