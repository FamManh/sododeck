import { assetId } from '@sododeck/model';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { memoryPictureStore, PictureStoreContext } from '../../images/picture-store';
import { PNG_1X1 } from '../../images/test-pictures';
import { readDeck } from '../../model/use-deck-snapshot';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import type { ImageFlowNode } from '../deck-to-flow';
import { toImageNodes } from '../deck-to-flow';
import { ImageNode } from './image-node';

const ASSET = assetId(PNG_1X1);
const GONE = 'f'.repeat(64);
const meta = (name: string) => ({
  type: 'image/png' as const,
  bytes: PNG_1X1.length,
  width: 10,
  height: 10,
  name,
});

const deck = deckOf({
  images: [
    {
      id: 'i1',
      asset: ASSET,
      position: { x: 0, y: 0 },
      size: { width: 120, height: 80 },
      alt: 'Logo',
    },
    { id: 'i2', asset: ASSET, position: { x: 200, y: 0 }, size: { width: 120, height: 80 } },
    {
      id: 'i3',
      asset: GONE,
      position: { x: 400, y: 0 },
      size: { width: 120, height: 80 },
      caption: 'Lost picture',
      locked: true,
    },
  ],
  assets: {
    [ASSET]: { ...meta('logo.png'), data: '' },
    [GONE]: { ...meta('gone.png'), data: '' },
  },
});

function props(file: ReturnType<typeof readDeck>, imageId: string): NodeProps<ImageFlowNode> {
  const node = toImageNodes(file, {
    nodes: [],
    edges: [],
    groups: [],
    stickies: [],
    images: [],
  }).find((entry) => entry.data.imageId === imageId);
  if (node === undefined) throw new Error(`Missing image ${imageId}`);
  return node as unknown as NodeProps<ImageFlowNode>;
}

beforeEach(() => {
  URL.createObjectURL = () => 'blob:test/image';
  URL.revokeObjectURL = () => undefined;
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function renderImage(imageId: string) {
  const store = memoryPictureStore();
  await store.put(ASSET, { type: 'image/png', bytes: PNG_1X1 });
  const rendered = renderWithEditor(
    <PictureStoreContext value={store}>
      <ImageNode {...props(deck, imageId)} />
    </PictureStoreContext>,
    deck,
  );
  return rendered;
}

describe('ImageNode (055)', () => {
  it('shows the picture with its alt text as the accessible name', async () => {
    await renderImage('i1');
    expect(screen.getByRole('group', { name: 'Image: Logo' })).toBeInTheDocument();
    const img = await screen.findByRole('img', { name: 'Logo' });
    expect(img).toHaveAttribute('src', 'blob:test/image');
  });

  it('falls back to the file name when there is no alt text', async () => {
    await renderImage('i2');
    expect(screen.getByRole('group', { name: 'Image: logo.png' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'logo.png' })).toBeInTheDocument();
  });

  it('shows the placeholder with file name and caption when the picture is missing, and is locked', async () => {
    const { container } = await renderImage('i3');
    await waitFor(
      () => {
        expect(
          screen.getByRole('group', { name: 'Image: gone.png, picture missing, locked' }),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText('Picture missing')).toBeInTheDocument();
    expect(screen.getByText('gone.png')).toBeInTheDocument();
    expect(screen.getByText('Lost picture')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Unlock image' })).toBeInTheDocument();
  });

  it('shows "Picture missing" at once when the deck has no facts for the picture', () => {
    // Not loadable (rule I1), but a live document can lose the facts, e.g. through a late undo.
    const file = deckOf({
      images: [{ id: 'x', asset: GONE, position: { x: 0, y: 0 }, size: { width: 50, height: 50 } }],
    });
    renderWithEditor(
      <PictureStoreContext value={memoryPictureStore()}>
        <ImageNode {...props(file, 'x')} />
      </PictureStoreContext>,
    );
    expect(screen.getByText('Picture missing')).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Image: untitled, picture missing' }),
    ).toBeInTheDocument();
  });

  it('unlocks from the lock glyph', async () => {
    const user = userEvent.setup();
    const { doc } = await renderImage('i3');
    await user.click(screen.getByRole('button', { name: 'Unlock image' }));
    act(() => undefined);
    expect(readDeck(doc).images?.find((image) => image.id === 'i3')?.locked).toBeUndefined();
  });
});
