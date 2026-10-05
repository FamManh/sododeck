import { assetId, toJSON } from '@sododeck/model';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryPictureStore, PictureStoreContext } from '../../images/picture-store';
import { PNG_1X1 } from '../../images/test-pictures';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { Canvas } from '../canvas';
import { SelectionToolbar } from '../quick-edit/selection-toolbar';
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
    {
      id: 'i2',
      asset: ASSET,
      position: { x: 600, y: 0 },
      size: { width: 120, height: 80 },
    },
  ],
  assets: {
    [ASSET]: { type: 'image/png', bytes: 70, width: 1, height: 1, name: 'logo.png', data: '' },
  },
});

function Harness() {
  useEditorShortcuts();
  useDeckSnapshot(useEditor().doc);
  return (
    <>
      <Canvas />
      <SelectionToolbar />
    </>
  );
}

const select = (images: string[]) => {
  act(() => {
    useUiStore.getState().select({ images });
  });
};
const names = () =>
  within(screen.getByRole('toolbar'))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

beforeEach(() => {
  URL.createObjectURL = () => 'blob:test/toolbar';
  URL.revokeObjectURL = () => undefined;
});

describe('image toolbar (055)', () => {
  it('names the toolbar after the image and lists alt text, caption, stacking, lock and delete', () => {
    renderWithEditor(<Harness />, deck);
    select(['i1']);
    expect(screen.getByRole('toolbar', { name: 'Selection: image Logo' })).toBeInTheDocument();
    expect(names()).toEqual([
      'Alt text',
      'Caption',
      'Crop',
      'Reset crop',
      'Flip horizontal',
      'Flip vertical',
      'Lock',
      'Bring forward',
      'Send backward',
      'Delete',
    ]);
  });

  it('writes alt text from its popover, one undo step', async () => {
    const user = userEvent.setup();
    const { doc, editor } = renderWithEditor(<Harness />, deck);
    select(['i2']);
    await user.click(screen.getByRole('button', { name: 'Alt text' }));
    const field = await screen.findByRole('textbox', { name: 'Alt text' });
    await user.type(field, 'Diagram');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(toJSON(doc).images?.[1]?.alt).toBe('Diagram');
    });
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).images?.[1]?.alt).toBeUndefined();
  });

  it('a set of images gets stacking, lock and delete but no per-image text', () => {
    renderWithEditor(<Harness />, deck);
    select(['i1', 'i2']);
    expect(screen.getByRole('toolbar', { name: 'Selection: 2 images' })).toBeInTheDocument();
    expect(names()).toEqual([
      'Flip horizontal',
      'Flip vertical',
      'Lock',
      'Bring forward',
      'Send backward',
      'Delete',
    ]);
  });

  it('locks from the toolbar and shows the lock glyph on the picture', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Harness />, deck);
    select(['i1']);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    expect(toJSON(doc).images?.[0]?.locked).toBe(true);
    expect(await screen.findByRole('button', { name: 'Unlock image' })).toBeInTheDocument();
  });
});

describe('image toolbar: flip (057)', () => {
  it('flips the picture in place from a toggle button, one undo step each', async () => {
    const user = userEvent.setup();
    const first = deck.images?.[0];
    if (first === undefined) throw new Error('no image');
    const captioned = deckOf({ ...deck, images: [{ ...first, caption: 'Logo v2' }] });
    const store = memoryPictureStore();
    await store.put(ASSET, { type: 'image/png', bytes: PNG_1X1 });
    const { doc, editor, container } = renderWithEditor(
      <PictureStoreContext value={store}>
        <Harness />
      </PictureStoreContext>,
      captioned,
    );
    select(['i1']);
    const before = toJSON(doc).images?.[0];
    const flip = screen.getByRole('button', { name: 'Flip horizontal' });
    expect(flip).toHaveAttribute('aria-pressed', 'false');
    await user.click(flip);
    const after = toJSON(doc).images?.[0];
    expect(after?.flipX).toBe(true);
    expect(after?.position).toEqual(before?.position);
    expect(after?.size).toEqual(before?.size);
    expect(after?.caption).toBe('Logo v2');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Flip horizontal' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    await waitFor(() => {
      const img = container.querySelector<HTMLImageElement>('[data-testid="image-view"] img');
      expect(img?.style.transform).toBe('scale(-1, 1)');
    });
    expect(screen.getByRole('button', { name: 'Flip vertical' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).images?.[0]).not.toHaveProperty('flipX');
  });

  it('flips a set of images to the same side', async () => {
    const user = userEvent.setup();
    const { doc } = renderWithEditor(<Harness />, deck);
    select(['i1', 'i2']);
    await user.click(screen.getByRole('button', { name: 'Flip vertical' }));
    expect(toJSON(doc).images?.map((image) => image.flipY)).toEqual([true, true]);
  });
});
