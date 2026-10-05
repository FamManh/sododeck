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
});
