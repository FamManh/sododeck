import { createEditor, getObject } from '@sododeck/model';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { confirmCrop } from './crop-commands';
import { useCropInterruptions } from './use-crop-interruptions';

const ASSET = 'a'.repeat(64);
const deck = deckOf({
  nodes: [{ id: 'n', type: 'service', title: 'N', position: { x: 0, y: 400 } }],
  images: [{ id: 'i', asset: ASSET, position: { x: 0, y: 0 }, size: { width: 400, height: 200 } }],
  assets: {
    [ASSET]: { type: 'image/png', bytes: 1, width: 400, height: 200, name: 'a.png', data: '' },
  },
});
const RIGHT = { x: 0.5, y: 0, width: 0.5, height: 1 };
const ui = () => useUiStore.getState();

function open(): void {
  act(() => {
    ui().select({ images: ['i'] });
    ui().openCrop('i', RIGHT);
  });
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  ui().resetForDeck();
});

describe('useCropInterruptions (057)', () => {
  it('cancels without a write when the selection changes', () => {
    const { wrapper, doc } = editorWrapper(deck);
    renderHook(
      () => {
        useCropInterruptions('i', false);
      },
      { wrapper },
    );
    open();
    act(() => {
      ui().select({ nodes: ['n'] });
    });
    expect(ui().cropSession).toBeNull();
    expect(getObject(doc, 'images', 'i')?.crop).toBeUndefined();
  });

  it('keeps the session when the same image is selected again', () => {
    const { wrapper } = editorWrapper(deck);
    renderHook(
      () => {
        useCropInterruptions('i', false);
      },
      { wrapper },
    );
    open();
    act(() => {
      ui().select({ images: ['i'] });
    });
    expect(ui().cropSession).not.toBeNull();
  });

  it('cancels when the image becomes locked', () => {
    const { wrapper } = editorWrapper(deck);
    open();
    const { rerender } = renderHook(
      ({ locked }) => {
        useCropInterruptions('i', locked);
      },
      {
        wrapper,
        initialProps: { locked: false },
      },
    );
    expect(ui().cropSession).not.toBeNull();
    rerender({ locked: true });
    expect(ui().cropSession).toBeNull();
  });

  it('cancels when the image node unmounts (deleted, hidden in a collapsed group)', async () => {
    const { wrapper } = editorWrapper(deck);
    open();
    const { unmount } = renderHook(
      () => {
        useCropInterruptions('i', false);
      },
      { wrapper },
    );
    await flush();
    expect(ui().cropSession).not.toBeNull();
    unmount();
    await flush();
    expect(ui().cropSession).toBeNull();
  });

  it('closes on a deck switch and when flow mode starts', () => {
    open();
    act(() => {
      ui().resetForDeck('other');
    });
    expect(ui().cropSession).toBeNull();
    open();
    act(() => {
      ui().openFlow('f');
    });
    expect(ui().cropSession).toBeNull();
  });

  it('keeps the session through a remote move and applies to the latest box', () => {
    const { wrapper, doc, editor } = editorWrapper(deck);
    renderHook(
      () => {
        useCropInterruptions('i', false);
      },
      { wrapper },
    );
    open();
    // Another tab moves and flips the image while crop mode is open.
    const remote = createEditor(doc);
    act(() => {
      remote.moveImage('i', { x: 100, y: 50 });
      remote.setImageFlip(['i'], 'y', true);
    });
    expect(ui().cropSession).not.toBeNull();
    act(() => {
      confirmCrop(editor());
    });
    const image = getObject(doc, 'images', 'i');
    expect(image?.crop).toEqual(RIGHT);
    expect(image?.position).toEqual({ x: 300, y: 50 });
    expect(image?.size).toEqual({ width: 200, height: 200 });
    expect(image?.flipY).toBe(true);
  });
});
