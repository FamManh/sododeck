import type { toJSON } from '@sododeck/model';
import { assetId } from '@sododeck/model';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PNG_1X1 } from '../images/test-pictures';
import * as download from '../storage/download';
import { deckOf, editorWrapper } from '../test/render-canvas';
import { useExportDeck } from './use-export-deck';

const id = assetId(PNG_1X1);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useExportDeck (055)', () => {
  it('writes the pictures its images use into the downloaded file', async () => {
    const spy = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
    const env = editorWrapper(
      deckOf({
        name: 'Pics',
        images: [
          { id: 'i1', asset: id, position: { x: 0, y: 0 }, size: { width: 64, height: 64 } },
        ],
        assets: {
          [id]: {
            type: 'image/png',
            bytes: PNG_1X1.length,
            width: 1,
            height: 1,
            name: 'dot.png',
            data: '',
          },
        },
      }),
    );
    await env.store.put(id, { type: 'image/png', bytes: PNG_1X1 });
    const { result } = renderHook(() => useExportDeck(), { wrapper: env.wrapper });
    act(() => {
      result.current();
    });
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
    const [name, text] = spy.mock.calls[0] ?? [];
    expect(name).toBe('Pics.sododeck.json');
    const file = JSON.parse(text ?? '{}') as ReturnType<typeof toJSON>;
    expect(file.assets?.[id]?.data.length).toBeGreaterThan(10);
  });

  it('exports a deck without images exactly as before', async () => {
    const spy = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
    const env = editorWrapper(deckOf({ name: 'Plain' }));
    const { result } = renderHook(() => useExportDeck(), { wrapper: env.wrapper });
    act(() => {
      result.current();
    });
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
    expect(spy.mock.calls[0]?.[1]).not.toContain('"assets"');
  });
});
