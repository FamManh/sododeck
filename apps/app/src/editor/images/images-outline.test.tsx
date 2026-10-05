import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactFlow from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { ImagesOutline } from './images-outline';

const setCenter = vi.fn();

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof ReactFlow>('@xyflow/react');
  return { ...actual, useReactFlow: () => ({ setCenter, getZoom: () => 1 }) };
});

const asset = 'a'.repeat(64);
const deck = deckOf({
  images: [
    { id: 'i1', asset, position: { x: 100, y: 200 }, size: { width: 80, height: 60 }, alt: 'Logo' },
    { id: 'i2', asset, position: { x: 400, y: 0 }, size: { width: 40, height: 40 } },
  ],
  assets: {
    [asset]: { type: 'image/png', bytes: 1, width: 1, height: 1, name: 'shot.png', data: '' },
  },
});

function Harness() {
  return <ImagesOutline deck={useDeckSnapshot(useEditor().doc)} />;
}

describe('ImagesOutline (055)', () => {
  it('lists images by alt text or file name, collapses, and selects and centres on click', async () => {
    const user = userEvent.setup();
    renderWithEditor(<Harness />, deck);
    expect(screen.getByRole('heading', { name: 'Images · 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'shot.png' }));
    expect(useUiStore.getState().selection.images).toEqual(['i2']);
    expect(setCenter).toHaveBeenCalledWith(420, 20, { zoom: 1 });
    await user.click(screen.getByRole('button', { name: 'Images' }));
    expect(screen.queryByRole('list', { name: 'Images' })).not.toBeInTheDocument();
  });

  it('shows nothing for a deck without images', () => {
    renderWithEditor(<Harness />, deckOf({}));
    expect(screen.queryByRole('heading', { name: /Images/ })).not.toBeInTheDocument();
  });
});
