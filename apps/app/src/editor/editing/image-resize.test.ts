import { assetId, createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { PNG_1X1 } from '../../images/test-pictures';
import { useUiStore } from '../../state/ui-store';
import {
  applyImageResize,
  endImageResize,
  resizeImageByKey,
  startImageResize,
} from './image-resize';

const ASSET = assetId(PNG_1X1);

const file = (locked = false): SododeckFile => ({
  ...emptySododeckFile(),
  images: [
    {
      id: 'i1',
      asset: ASSET,
      position: { x: 100, y: 100 },
      size: { width: 200, height: 100 },
      ...(locked ? { locked: true } : {}),
    },
  ],
  assets: {
    [ASSET]: {
      type: 'image/png',
      bytes: PNG_1X1.length,
      width: 200,
      height: 100,
      name: 'a.png',
      data: '',
    },
  },
});

const initialUi = useUiStore.getState();
const keep = { shift: false, alt: false, mod: true };
const free = { shift: true, alt: false, mod: true };

function setup(locked = false) {
  const doc = fromJSON(file(locked));
  return { doc, editor: createEditor(doc) };
}
const sizeOf = (doc: ReturnType<typeof fromJSON>) => toJSON(doc).images?.[0]?.size;

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

describe('image resize (055 US3)', () => {
  it('keeps the aspect ratio from a corner, one undo step for the whole drag', () => {
    const { doc, editor } = setup();
    const session = startImageResize(editor, 'i1', 'bottom-right');
    if (session === null) throw new Error('no session');
    applyImageResize(editor, session, { x: 100, y: 100, width: 300, height: 120 }, keep, 1);
    applyImageResize(editor, session, { x: 100, y: 100, width: 400, height: 100 }, keep, 1);
    endImageResize(editor, session);
    expect(sizeOf(doc)).toEqual({ width: 400, height: 200 });
    expect(editor.undo()).toBe(true);
    expect(sizeOf(doc)).toEqual({ width: 200, height: 100 });
    expect(editor.undo()).toBe(false);
  });

  it('resizes freely while the modifier is held', () => {
    const { doc, editor } = setup();
    const session = startImageResize(editor, 'i1', 'bottom-right');
    if (session === null) throw new Error('no session');
    applyImageResize(editor, session, { x: 100, y: 100, width: 300, height: 50 }, free, 1);
    endImageResize(editor, session);
    expect(sizeOf(doc)).toEqual({ width: 300, height: 50 });
  });

  it('never goes below 32 px and moves the box when a top-left handle is dragged', () => {
    const { doc, editor } = setup();
    const session = startImageResize(editor, 'i1', 'top-left');
    if (session === null) throw new Error('no session');
    applyImageResize(editor, session, { x: 290, y: 190, width: 10, height: 10 }, free, 1);
    endImageResize(editor, session);
    expect(sizeOf(doc)).toEqual({ width: 32, height: 32 });
    expect(toJSON(doc).images?.[0]?.position).toEqual({ x: 268, y: 168 });
  });

  it('puts the image back when the gesture is cancelled', () => {
    const { doc, editor } = setup();
    const session = startImageResize(editor, 'i1', 'bottom-right');
    if (session === null) throw new Error('no session');
    applyImageResize(editor, session, { x: 100, y: 100, width: 400, height: 200 }, keep, 1);
    editor.cancelGesture();
    expect(sizeOf(doc)).toEqual({ width: 200, height: 100 });
  });

  it('does not start on a locked or missing image', () => {
    expect(startImageResize(setup(true).editor, 'i1', 'right')).toBeNull();
    expect(startImageResize(setup().editor, 'nope', 'right')).toBeNull();
  });

  it('resizes by Alt + arrow with the ratio kept, and refuses a locked image', () => {
    const { doc, editor } = setup();
    expect(resizeImageByKey(editor, 'i1', 'ArrowRight', false)).toBe(true);
    expect(sizeOf(doc)).toEqual({ width: 208, height: 104 });
    expect(resizeImageByKey(editor, 'i1', 'ArrowUp', true)).toBe(true);
    expect(sizeOf(doc)).toEqual({ width: 176, height: 88 });
    expect(resizeImageByKey(setup(true).editor, 'i1', 'ArrowRight', false)).toBe(false);
  });

  it('stops shrinking at the minimum', () => {
    const { doc, editor } = setup();
    for (let i = 0; i < 20; i += 1) resizeImageByKey(editor, 'i1', 'ArrowLeft', true);
    expect(sizeOf(doc)).toEqual({ width: 64, height: 32 });
    expect(resizeImageByKey(editor, 'i1', 'ArrowLeft', true)).toBe(false);
  });
});
