import { assetId, toJSON } from '@sododeck/model';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeProps } from '@xyflow/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryPictureStore, PictureStoreContext } from '../../images/picture-store';
import { PNG_1X1 } from '../../images/test-pictures';
import { useUiStore } from '../../state/ui-store';
import { deckOf, renderWithEditor } from '../../test/render-canvas';
import { toImageNodes, type ImageFlowNode } from '../deck-to-flow';
import { CROP_MODE_HINT, openCropMode } from './crop-commands';
import { ImageNode } from './image-node';

const ASSET = assetId(PNG_1X1);
/** A 400 × 200 picture drawn at scale 1: canvas pixels equal picture pixels. */
const deck = deckOf({
  images: [
    {
      id: 'i',
      asset: ASSET,
      position: { x: 0, y: 0 },
      size: { width: 400, height: 200 },
      caption: 'Screenshot',
    },
  ],
  assets: {
    [ASSET]: {
      type: 'image/png',
      bytes: PNG_1X1.length,
      width: 400,
      height: 200,
      name: 's.png',
      data: '',
    },
  },
});
const ui = () => useUiStore.getState();

function nodeProps(file: typeof deck): NodeProps<ImageFlowNode> {
  const node = toImageNodes(file, {
    nodes: [],
    edges: [],
    groups: [],
    stickies: [],
    images: ['i'],
  })[0];
  if (node === undefined) throw new Error('no image');
  return node as unknown as NodeProps<ImageFlowNode>;
}

async function renderCrop(file = deck) {
  const store = memoryPictureStore();
  await store.put(ASSET, { type: 'image/png', bytes: PNG_1X1 });
  const rendered = renderWithEditor(
    <PictureStoreContext value={store}>
      <ImageNode {...nodeProps(file)} />
    </PictureStoreContext>,
    file,
  );
  act(() => {
    openCropMode(file, 'i');
  });
  const frame = await screen.findByRole('group', { name: /^Crop area/ });
  return { ...rendered, frame };
}

const handle = (name: string) => screen.getByRole('button', { name });
const crop = () => ui().cropSession?.crop;

function drag(target: HTMLElement, dx: number, dy: number, shiftKey = false) {
  fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy, shiftKey });
  fireEvent.pointerUp(target, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
}

beforeEach(() => {
  URL.createObjectURL = () => 'blob:test/crop';
  URL.revokeObjectURL = () => undefined;
});

describe('crop mode (057 US1)', () => {
  it('shows the whole picture, a named frame, eight handles and the bar; hides the caption', async () => {
    const { container, frame } = await renderCrop();
    expect(frame).toHaveAccessibleName('Crop area, 400 × 200');
    for (const name of [
      'Crop top left corner',
      'Crop top edge',
      'Crop top right corner',
      'Crop right edge',
      'Crop bottom right corner',
      'Crop bottom edge',
      'Crop bottom left corner',
      'Crop left edge',
    ]) {
      expect(handle(name)).toBeInTheDocument();
    }
    const bar = screen.getByRole('toolbar', { name: 'Crop' });
    expect(
      within(bar)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Reset', 'Cancel', 'Done']);
    expect(within(bar).getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(screen.queryByTestId('image-caption')).toBeNull();
    expect(container.querySelectorAll('.bg-scrim')).toHaveLength(4);
    expect(container.querySelector('.react-flow__handle')).toHaveClass('invisible');
    expect(ui().announcement.text).toBe(CROP_MODE_HINT);
  });

  it('moves a handle with the pointer, clamped to the picture', async () => {
    await renderCrop();
    drag(handle('Crop top left corner'), 100, 50);
    expect(crop()).toEqual({ x: 0.25, y: 0.25, width: 0.75, height: 0.75 });
    drag(handle('Crop right edge'), 500, 0);
    expect(crop()?.width).toBeCloseTo(0.75);
    expect(ui().cropSession?.handle).toBeNull();
  });

  it('moves the frame by dragging inside it', async () => {
    const { frame } = await renderCrop();
    drag(handle('Crop bottom right corner'), -200, -100);
    drag(frame, 100, 50);
    expect(crop()).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  });

  it('keeps the proportions with Shift on a corner', async () => {
    await renderCrop();
    drag(handle('Crop bottom right corner'), -200, 0, true);
    const now = crop();
    expect((now?.width ?? 0) / (now?.height ?? 1)).toBeCloseTo(1);
    expect(now?.width).toBeCloseTo(0.5);
  });

  it('applies with Enter in one undo step, keeping the scale and place', async () => {
    const { doc, editor } = await renderCrop();
    drag(handle('Crop top left corner'), 200, 100);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' });
    expect(ui().cropSession).toBeNull();
    const image = toJSON(doc).images?.[0];
    expect(image?.crop).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
    expect(image?.position).toEqual({ x: 200, y: 100 });
    expect(image?.size).toEqual({ width: 200, height: 100 });
    expect(ui().announcement.text).toBe('Crop applied');
    act(() => {
      editor().undo();
    });
    expect(toJSON(doc).images?.[0]).not.toHaveProperty('crop');
    expect(editor().canUndo()).toBe(false);
  });

  it('cancels with Escape: nothing written, no undo step', async () => {
    const { doc, editor } = await renderCrop();
    drag(handle('Crop top left corner'), 200, 100);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(ui().cropSession).toBeNull();
    expect(toJSON(doc).images?.[0]).not.toHaveProperty('crop');
    expect(editor().canUndo()).toBe(false);
    expect(ui().announcement.text).toBe('Crop cancelled');
  });

  it('applies on a press outside the picture and the bar', async () => {
    const { doc } = await renderCrop();
    drag(handle('Crop left edge'), 200, 0);
    fireEvent.pointerDown(document.body, { button: 0, pointerId: 2 });
    expect(ui().cropSession).toBeNull();
    expect(toJSON(doc).images?.[0]?.crop).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 });
  });

  it('works from the bar: Reset moves the frame only, Cancel and Done close', async () => {
    const user = userEvent.setup();
    const { doc } = await renderCrop();
    drag(handle('Crop left edge'), 200, 0);
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(crop()).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(toJSON(doc).images?.[0]).not.toHaveProperty('crop');
    drag(handle('Crop left edge'), 100, 0);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(toJSON(doc).images?.[0]?.crop).toEqual({ x: 0.25, y: 0, width: 0.75, height: 1 });
  });

  it('starts from the current crop on a cropped picture, and shows the whole picture around it', async () => {
    const cropped = deckOf({
      ...deck,
      images: [
        {
          id: 'i',
          asset: ASSET,
          position: { x: 200, y: 0 },
          size: { width: 200, height: 200 },
          crop: { x: 0.5, y: 0, width: 0.5, height: 1 },
        },
      ],
    });
    const { container, frame } = await renderCrop(cropped);
    expect(frame).toHaveAccessibleName('Crop area, 200 × 200');
    const overlay = container.querySelector<HTMLElement>('[data-crop-overlay]');
    expect(overlay?.style.left).toBe('-200px');
    expect(overlay?.style.width).toBe('400px');
    expect(frame.style.left).toBe('200px');
  });
});

describe('crop mode with the keyboard (057 US3, FR-019)', () => {
  it('focuses the frame, then tabs through the handles clockwise and the bar', async () => {
    const user = userEvent.setup();
    const { frame } = await renderCrop();
    await waitFor(() => {
      expect(frame).toHaveFocus();
    });
    const order: string[] = [];
    for (let i = 0; i < 10; i++) {
      await user.tab();
      order.push(
        document.activeElement?.getAttribute('aria-label') ??
          document.activeElement?.textContent ??
          '',
      );
    }
    expect(order).toEqual([
      'Crop top left corner',
      'Crop top edge',
      'Crop top right corner',
      'Crop right edge',
      'Crop bottom right corner',
      'Crop bottom edge',
      'Crop bottom left corner',
      'Crop left edge',
      // Reset is disabled on the whole picture.
      'Cancel',
      'Done',
    ]);
  });

  it('moves the focused handle 1 px per arrow, 10 with Shift, and says the size', async () => {
    await renderCrop();
    const corner = handle('Crop top left corner');
    corner.focus();
    fireEvent.keyDown(corner, { key: 'ArrowRight' });
    expect(crop()?.x).toBeCloseTo(1 / 400);
    fireEvent.keyDown(corner, { key: 'ArrowDown', shiftKey: true });
    expect(crop()?.y).toBeCloseTo(10 / 200);
    expect(ui().announcement.text).toBe('399 × 190');
  });

  it('moves the frame with the arrows, clamped to the picture', async () => {
    const { frame } = await renderCrop();
    drag(handle('Crop bottom right corner'), -200, -100);
    frame.focus();
    fireEvent.keyDown(frame, { key: 'ArrowRight', shiftKey: true });
    expect(crop()?.x).toBeCloseTo(10 / 400);
    fireEvent.keyDown(frame, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(frame, { key: 'ArrowLeft', shiftKey: true });
    expect(crop()?.x).toBe(0);
  });

  it('applies with Enter from a handle and cancels with Escape from the bar', async () => {
    const { doc } = await renderCrop();
    const edge = handle('Crop left edge');
    edge.focus();
    fireEvent.keyDown(edge, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(edge, { key: 'Enter' });
    expect(toJSON(doc).images?.[0]?.crop?.x).toBeCloseTo(0.025);

    act(() => {
      openCropMode(toJSON(doc), 'i');
    });
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Escape' });
    expect(ui().cropSession).toBeNull();
  });
});
