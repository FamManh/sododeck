import { assetId, toJSON } from '@sododeck/model';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PNG_1X1 } from '../../images/test-pictures';
import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { Canvas } from '../canvas';
import { ConfirmDeleteDialog } from '../confirm-delete-dialog';
import { useEditorShortcuts } from '../use-canvas-shortcuts';

const ASSET = assetId(PNG_1X1);

const deck = deckOf({
  nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
  images: [
    {
      id: 'i1',
      asset: ASSET,
      position: { x: 300, y: 0 },
      size: { width: 120, height: 80 },
      alt: 'Logo',
    },
  ],
  assets: {
    [ASSET]: {
      type: 'image/png',
      bytes: PNG_1X1.length,
      width: 1,
      height: 1,
      name: 'logo.png',
      data: '',
    },
  },
});

function Harness() {
  useEditorShortcuts({ canvas: true });
  const deckNow = useDeckSnapshot(useEditor().doc);
  return (
    <>
      <Canvas />
      <ConfirmDeleteDialog deck={deckNow} />
    </>
  );
}

beforeEach(() => {
  URL.createObjectURL = () => 'blob:test/canvas';
  URL.revokeObjectURL = () => undefined;
});

async function mount() {
  const rendered = renderWithEditor(<Harness />, deck);
  await rendered.store.put(ASSET, { type: 'image/png', bytes: PNG_1X1 });
  return rendered;
}

describe('images on the canvas (055)', () => {
  it('draws an image next to the cards, with its picture', async () => {
    await mount();
    expect(screen.getAllByTestId('deck-node')).toHaveLength(1);
    expect(screen.getAllByTestId('image-node')).toHaveLength(1);
    expect(await screen.findByRole('img', { name: 'Logo' })).toBeInTheDocument();
  });

  it('selects an image by click and deletes it at once; undo brings it back with its picture', async () => {
    const { doc, editor } = await mount();
    await screen.findByRole('img', { name: 'Logo' });
    fireEvent.click(screen.getByTestId('image-node'));
    expect(useUiStore.getState().selection.images).toEqual(['i1']);

    fireEvent.keyDown(document.body, { key: 'Backspace' });
    await waitFor(() => {
      expect(toJSON(doc).images).toBeUndefined();
    });
    expect(screen.queryByTestId('image-node')).not.toBeInTheDocument();

    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).images).toHaveLength(1);
    expect(await screen.findByRole('img', { name: 'Logo' })).toBeInTheDocument();

    act(() => {
      editor().redo();
    });
    expect(toJSON(doc).images).toBeUndefined();
  });

  it('moves a selected image with the arrow keys, and refuses when it is locked', async () => {
    const { doc, editor } = await mount();
    act(() => {
      useUiStore.getState().select({ images: ['i1'] });
    });
    fireEvent.keyDown(screen.getByTestId('image-node'), { key: 'ArrowRight' });
    expect(toJSON(doc).images?.[0]?.position).toEqual({ x: 308, y: 0 });
    act(() => {
      editor().setLocked(['i1'], true, 'images');
    });
    fireEvent.keyDown(screen.getByTestId('image-node'), { key: 'ArrowRight' });
    expect(toJSON(doc).images?.[0]?.position).toEqual({ x: 308, y: 0 });
    expect(useUiStore.getState().announcement.text).toMatch(/Locked/);
  });

  it('resizes from the keyboard with Alt + arrow (⇧ for a bigger step), keeping the ratio', async () => {
    const { doc } = await mount();
    const node = screen.getByTestId('image-node');
    fireEvent.keyDown(node, { key: 'ArrowRight', altKey: true });
    expect(toJSON(doc).images?.[0]?.size).toEqual({ width: 128, height: 85 });
    expect(useUiStore.getState().announcement.text).toBe('Resized image to 128 × 85');
    fireEvent.keyDown(node, { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(toJSON(doc).images?.[0]?.size).toEqual({ width: 96, height: 64 });
  });

  it('refuses keyboard resize and connect on a locked image, saying why', async () => {
    const { editor } = await mount();
    act(() => {
      editor().setLocked(['i1'], true, 'images');
    });
    const node = screen.getByTestId('image-node');
    fireEvent.keyDown(node, { key: 'ArrowRight', altKey: true });
    expect(useUiStore.getState().announcement.text).toMatch(/Locked/);
    fireEvent.keyDown(node, { key: 'c' });
    expect(useUiStore.getState().popover).toBeNull();
    expect(node).toHaveAccessibleName('Image: Logo, locked');
  });

  it('opens the keyboard connect list with C and is focusable with a focus ring', async () => {
    await mount();
    const node = screen.getByTestId('image-node');
    expect(node).toHaveAttribute('tabindex', '0');
    expect(node.className).toMatch(/focus-visible/);
    fireEvent.keyDown(node, { key: 'c' });
    expect(useUiStore.getState().popover).toEqual({ kind: 'connect', fromId: 'i1' });
  });

  it('announces a missing picture in its name, by text and not by colour', async () => {
    const lost = deckOf({
      images: [
        {
          id: 'i9',
          asset: 'f'.repeat(64),
          position: { x: 0, y: 0 },
          size: { width: 120, height: 80 },
          alt: 'Gone',
        },
      ],
      assets: {
        ['f'.repeat(64)]: { ...deck.assets?.[ASSET], name: 'gone.png', data: '' } as never,
      },
    });
    renderWithEditor(<Harness />, lost);
    expect(await screen.findByText('Picture missing', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('image-node')).toHaveAccessibleName('Image: Gone, picture missing');
  });
});
