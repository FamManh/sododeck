import { assetId, toJSON } from '@sododeck/model';
import type { Frame, SododeckFile } from '@sododeck/schema';
import { act, renderHook } from '@testing-library/react';
import type { Node, NodeChange } from '@xyflow/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it } from 'vitest';

import { PNG_1X1 } from '../../images/test-pictures';
import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { useCanvasHandlers } from '../use-canvas-handlers';
import { cancelActiveGesture } from './drag-session';

const ASSET = assetId(PNG_1X1);
const ui = () => useUiStore.getState();
const frame = (x: number, y: number, width: number, height: number): Frame => ({
  position: { x, y },
  size: { width, height },
});
const flowNode = (id: string) => ({ id }) as Node;
const pointer = (x: number, y: number, patch: Partial<ReactMouseEvent> = {}) =>
  ({
    clientX: x,
    clientY: y,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    ...patch,
  }) as ReactMouseEvent;
const move = (id: string, x: number, y: number): NodeChange[] => [
  { type: 'position', id, position: { x, y }, dragging: true },
];

const image = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  asset: ASSET,
  position: { x, y },
  size: { width: 120, height: 80 },
  ...extra,
});

const deck: SododeckFile = deckOf({
  nodes: [{ id: 'm1', type: 'service', title: 'Charge', group: 'pay', position: { x: 0, y: 0 } }],
  groups: [
    { id: 'pay', title: 'Payments', ...frame(-48, -48, 560, 540) },
    { id: 'shop', title: 'Shop', ...frame(2900, -100, 800, 800) },
  ],
  images: [
    image('in', 300, 200, { group: 'pay' }),
    image('free', 0, 3000),
    image('locked', 1500, 3000, { locked: true }),
  ],
  assets: {
    [ASSET]: {
      type: 'image/png',
      bytes: PNG_1X1.length,
      width: 1,
      height: 1,
      name: 'a.png',
      data: '',
    },
  },
});

function setup() {
  const env = editorWrapper(deck);
  const { result } = renderHook(() => useCanvasHandlers(), { wrapper: env.wrapper });
  return { ...env, h: () => result.current };
}
const at = (file: SododeckFile, id: string) => file.images?.find((i) => i.id === id);

describe('dragging images (055 US3)', () => {
  it('moves a dragged group together with its images, one undo step', () => {
    const { h, doc, editor } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      h().onNodesChange(move('group:pay', -48 + 100, -48 + 40));
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(at(toJSON(doc), 'in')?.position).toEqual({ x: 400, y: 240 });
    expect(at(toJSON(doc), 'in')?.group).toBe('pay');
    act(() => {
      editor().undo();
    });
    expect(at(toJSON(doc), 'in')?.position).toEqual({ x: 300, y: 200 });
  });

  it('drops an image into the frame under the pointer, and out again', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('image:free'));
      h().onNodeDrag(pointer(3150, 150));
      h().onNodesChange(move('image:free', 3100, 100));
    });
    expect(ui().dropTarget).toBe('shop');
    act(() => {
      h().onNodeDragStop(pointer(3150, 150));
    });
    expect(at(toJSON(doc), 'free')).toMatchObject({ group: 'shop', position: { x: 3100, y: 100 } });
    act(() => {
      h().onNodeDragStart({}, flowNode('image:free'));
      h().onNodeDrag(pointer(1550, 1550));
      h().onNodesChange(move('image:free', 1500, 1500));
      h().onNodeDragStop(pointer(1550, 1550));
    });
    expect(at(toJSON(doc), 'free')?.group).toBeUndefined();
  });

  it('keeps an image in its group when the whole group is dragged somewhere else', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('group:pay'));
      h().onNodesChange(move('group:pay', 2000, 2000));
      h().onNodeDragStop(pointer(3150, 150));
    });
    expect(at(toJSON(doc), 'in')?.group).toBe('pay');
  });

  it('cancels with Esc: the image is back and nothing is left to undo', () => {
    const { h, doc, editor } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('image:free'));
      h().onNodesChange(move('image:free', 500, 3500));
    });
    act(() => {
      cancelActiveGesture();
    });
    expect(at(toJSON(doc), 'free')?.position).toEqual({ x: 0, y: 3000 });
    expect(editor().canUndo()).toBe(false);
  });

  it('⌥ drag copies the image: the original stays, the copy moves and is selected', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('image:free'));
      h().onNodeDrag(pointer(0, 0, { altKey: true, metaKey: true }));
      h().onNodesChange(move('image:free', 200, 3100));
    });
    act(() => {
      h().onNodeDragStop(pointer(0, 0, { altKey: true }));
    });
    const images = toJSON(doc).images ?? [];
    expect(images).toHaveLength(4);
    expect(at(toJSON(doc), 'free')?.position).toEqual({ x: 0, y: 3000 });
    const copy = images.find((i) => !['in', 'free', 'locked'].includes(i.id));
    expect(copy?.position).toEqual({ x: 200, y: 3100 });
    expect(ui().selection.images).toEqual([copy?.id]);
  });

  it('a locked image does not start a drag', () => {
    const { h, doc } = setup();
    act(() => {
      h().onNodeDragStart({}, flowNode('image:locked'));
      h().onNodesChange(move('image:locked', 1600, 3100));
      h().onNodeDragStop(pointer(0, 0));
    });
    expect(at(toJSON(doc), 'locked')?.position).toEqual({ x: 1500, y: 3000 });
  });
});
