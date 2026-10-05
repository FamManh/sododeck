import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  NODE_GRID,
  STICKY_DEFAULT_OFFSET,
  STICKY_COLLAPSED_HEIGHT,
  STICKY_DEFAULT_SIZE,
  STICKY_MIN_SIZE,
  clampStickySize,
  stickyBox,
  nodeCanvasPosition,
  stickyCanvasPosition,
  stickyLabel,
  IMAGE_MAX_SIDE,
  cropFrame,
  isWholeCrop,
  minCropFraction,
  pictureLayout,
  roundCrop,
  trimCrop,
  visibleRegion,
} from '../src/geometry';

function baseFile(): SododeckFile {
  const file = emptySododeckFile();
  file.nodes.push(
    { id: 'n0', type: 'service', title: 'Positioned', position: { x: 300, y: 40 } },
    { id: 'n1', type: 'service', title: 'Grid slot 1' },
    { id: 'n2', type: 'service', title: 'Grid slot 2' },
  );
  file.edges.push({ id: 'e0', from: 'n0', to: 'n1', protocol: 'http' });
  file.flows.push({
    id: 'f0',
    title: 'Flow',
    steps: [{ id: 's0', edge: 'e0', title: 'Step 1' }],
  });
  return file;
}

describe('nodeCanvasPosition', () => {
  it('returns the stored position of a positioned node', () => {
    expect(nodeCanvasPosition(baseFile(), 'n0')).toEqual({ x: 300, y: 40 });
  });

  it('returns the grid slot by index for an unpositioned node', () => {
    const file = baseFile();
    expect(nodeCanvasPosition(file, 'n1')).toEqual({ x: 1 * NODE_GRID.dx, y: 0 });
    expect(nodeCanvasPosition(file, 'n2')).toEqual({ x: 2 * NODE_GRID.dx, y: 0 });
  });

  it('returns null for an unknown id', () => {
    expect(nodeCanvasPosition(baseFile(), 'missing')).toBeNull();
  });
});

describe('stickyCanvasPosition', () => {
  it('is free at its own position', () => {
    const file = baseFile();
    const sticky = { id: 'sticky-0', text: 'hi', position: { x: 10, y: 20 } };
    expect(stickyCanvasPosition(file, sticky)).toEqual({
      status: 'free',
      point: { x: 10, y: 20 },
    });
  });

  it('is pinned with an offset', () => {
    const file = baseFile();
    const sticky = { id: 'sticky-0', text: 'hi', anchor: 'n0', position: { x: 5, y: -5 } };
    expect(stickyCanvasPosition(file, sticky)).toEqual({
      status: 'pinned',
      point: { x: 305, y: 35 },
      pinnedTo: 'n0',
    });
  });

  it('is pinned at the default offset without a stored position', () => {
    const file = baseFile();
    const sticky = { id: 'sticky-0', text: 'hi', anchor: 'n0' };
    expect(stickyCanvasPosition(file, sticky)).toEqual({
      status: 'pinned',
      point: { x: 300 + STICKY_DEFAULT_OFFSET.x, y: 40 + STICKY_DEFAULT_OFFSET.y },
      pinnedTo: 'n0',
    });
  });

  it('is pinned to a grid-placed node', () => {
    const file = baseFile();
    const sticky = { id: 'sticky-0', text: 'hi', anchor: 'n1' };
    expect(stickyCanvasPosition(file, sticky)).toEqual({
      status: 'pinned',
      point: {
        x: NODE_GRID.dx + STICKY_DEFAULT_OFFSET.x,
        y: STICKY_DEFAULT_OFFSET.y,
      },
      pinnedTo: 'n1',
    });
  });

  it('is foreign when anchored to a non-node object (edge, then step)', () => {
    const file = baseFile();
    const edgeSticky = { id: 'sticky-0', text: 'hi', anchor: 'e0', position: { x: 1, y: 2 } };
    expect(stickyCanvasPosition(file, edgeSticky)).toEqual({
      status: 'foreign',
      point: { x: 1, y: 2 },
      anchor: 'e0',
    });
    const stepSticky = { id: 'sticky-1', text: 'hi', anchor: 's0', position: { x: 3, y: 4 } };
    expect(stickyCanvasPosition(file, stepSticky)).toEqual({
      status: 'foreign',
      point: { x: 3, y: 4 },
      anchor: 's0',
    });
  });

  it('is missing when the anchor names nothing', () => {
    const file = baseFile();
    const sticky = { id: 'sticky-0', text: 'hi', anchor: 'nothing', position: { x: 7, y: 8 } };
    expect(stickyCanvasPosition(file, sticky)).toEqual({
      status: 'missing',
      point: { x: 7, y: 8 },
      anchor: 'nothing',
    });
  });
});

describe('stickyLabel', () => {
  it('is the first non-empty line with markdown markers removed', () => {
    expect(stickyLabel('**Bold** first line\nSecond line')).toBe('Bold first line');
    expect(stickyLabel('\n\n_italic_ text')).toBe('italic text');
  });

  it('keeps case', () => {
    expect(stickyLabel('SHOUTING')).toBe('SHOUTING');
  });

  it('is null for blank text', () => {
    expect(stickyLabel('')).toBeNull();
    expect(stickyLabel('   \n  \n')).toBeNull();
  });
});

describe('sticky box (053)', () => {
  it('has a 200 × 200 default and a 96 × 96 minimum', () => {
    expect(STICKY_DEFAULT_SIZE).toEqual({ width: 200, height: 200 });
    expect(STICKY_MIN_SIZE).toEqual({ width: 96, height: 96 });
  });

  it('uses the default size for a note with no stored size', () => {
    expect(stickyBox({}, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 200,
      height: 200,
    });
  });

  it('uses the stored size', () => {
    const sticky = { size: { width: 240, height: 120 } };
    expect(stickyBox(sticky, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, width: 240, height: 120 });
  });

  it('is one line high while collapsed, keeping the width', () => {
    const sticky = { collapsed: true, size: { width: 240, height: 120 } };
    expect(STICKY_COLLAPSED_HEIGHT).toBe(40);
    expect(stickyBox(sticky, { x: 5, y: 6 })).toEqual({
      x: 5,
      y: 6,
      width: 240,
      height: 40,
    });
    expect(stickyBox({ collapsed: true }, { x: 0, y: 0 }).width).toBe(200);
  });

  it('clamps a size to the minimum and leaves larger sizes alone', () => {
    expect(clampStickySize({ width: 10, height: 50 })).toEqual({ width: 96, height: 96 });
    expect(clampStickySize({ width: 300, height: 96 })).toEqual({ width: 300, height: 96 });
    expect(clampStickySize({ width: 96.5, height: 400 })).toEqual({ width: 96.5, height: 400 });
  });
});

describe('picture geometry: crop and flip (057)', () => {
  const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

  it('draws an unedited picture that fills a matching box', () => {
    const layout = pictureLayout(box(10, 20, 200, 100), { width: 400, height: 200 });
    expect(layout).toEqual({
      view: box(10, 20, 200, 100),
      picture: box(10, 20, 200, 100),
      flipX: false,
      flipY: false,
    });
  });

  it('fits the picture in a letterboxed box, centred (contain)', () => {
    const layout = pictureLayout(box(0, 0, 300, 100), { width: 200, height: 100 });
    expect(layout.view).toEqual(box(50, 0, 200, 100));
    expect(layout.picture).toEqual(box(50, 0, 200, 100));
  });

  it('draws the whole picture so the cropped region fills the view', () => {
    const crop = { x: 0.5, y: 0, width: 0.5, height: 1 };
    const layout = pictureLayout(box(0, 0, 100, 100), { width: 200, height: 100 }, crop);
    expect(layout.view).toEqual(box(0, 0, 100, 100));
    expect(layout.picture).toEqual(box(-100, 0, 200, 100));
  });

  it('mirrors the picture so the same region stays visible when flipped', () => {
    const crop = { x: 0.5, y: 0, width: 0.5, height: 1 };
    const natural = { width: 200, height: 100 };
    const flippedX = pictureLayout(box(0, 0, 100, 100), natural, crop, { flipX: true });
    expect(flippedX.view).toEqual(box(0, 0, 100, 100));
    expect(flippedX.picture).toEqual(box(0, 0, 200, 100));
    expect(flippedX.flipX).toBe(true);
    expect(flippedX.flipY).toBe(false);

    const top = { x: 0, y: 0, width: 1, height: 0.25 };
    const flippedY = pictureLayout(box(0, 0, 200, 25), natural, top, { flipY: true });
    expect(flippedY.picture).toEqual(box(0, -75, 200, 100));
    expect(flippedY.flipY).toBe(true);
  });

  it('gives the visible region in natural pixels, mirrored with the picture', () => {
    const natural = { width: 1280, height: 800 };
    const crop = { x: 0.25, y: 0.1, width: 0.5, height: 0.5 };
    expect(visibleRegion(natural, crop, { flipX: true })).toEqual(box(320, 80, 640, 400));
    expect(visibleRegion(natural, crop, { flipY: true })).toEqual(box(320, 320, 640, 400));
    expect(visibleRegion(natural)).toEqual(box(0, 0, 1280, 800));
  });

  describe('cropFrame', () => {
    const natural = { width: 400, height: 200 };
    const right = { x: 0.5, y: 0, width: 0.5, height: 1 };

    it('keeps the scale and the still-visible part in place on a first crop', () => {
      expect(cropFrame(box(0, 0, 400, 200), natural, undefined, right)).toEqual(
        box(200, 0, 200, 200),
      );
    });

    it('places the region where it is drawn when flipped', () => {
      expect(cropFrame(box(0, 0, 400, 200), natural, undefined, right, { flipX: true })).toEqual(
        box(0, 0, 200, 200),
      );
    });

    it('grows back to the whole picture on reset', () => {
      expect(cropFrame(box(200, 0, 200, 200), natural, right, undefined)).toEqual(
        box(0, 0, 400, 200),
      );
      expect(cropFrame(box(0, 0, 200, 200), natural, right, undefined, { flipX: true })).toEqual(
        box(0, 0, 400, 200),
      );
    });

    it('scales a reset past the size limit down, keeping the old visible centre', () => {
      const big = { width: 10000, height: 1000 };
      const middle = { x: 0.45, y: 0, width: 0.1, height: 1 };
      // The middle tenth drawn at scale 1: 1000 × 1000 at (0, 0); its centre is (500, 500).
      const frame = cropFrame(box(0, 0, 1000, 1000), big, middle, undefined);
      expect(frame.width).toBeCloseTo(IMAGE_MAX_SIDE);
      expect(frame.height).toBeCloseTo(409.6);
      expect(frame.x + frame.width / 2).toBeCloseTo(500);
      expect(frame.y + frame.height / 2).toBeCloseTo(500);
    });

    it('collapses a letterboxed box to the fitted region', () => {
      expect(cropFrame(box(0, 0, 600, 200), natural, undefined, undefined)).toEqual(
        box(100, 0, 400, 200),
      );
    });
  });

  it('finds the smallest crop that stays 32 canvas px a side', () => {
    const min = minCropFraction(box(0, 0, 200, 100), { width: 400, height: 200 });
    expect(min).toEqual({ width: 32 / 200, height: 32 / 100 });
    const cropped = minCropFraction(
      box(0, 0, 100, 100),
      { width: 400, height: 200 },
      { x: 0, y: 0, width: 0.5, height: 1 },
    );
    // Scale 0.5: 32 canvas px is 64 natural px.
    expect(cropped).toEqual({ width: 64 / 400, height: 64 / 200 });
    expect(minCropFraction(box(0, 0, 32, 32), { width: 10, height: 10 })).toEqual({
      width: 1,
      height: 1,
    });
  });

  it('rounds a crop to 6 decimals and knows the whole picture', () => {
    expect(roundCrop({ x: 1 / 3, y: 0.1234564, width: 0.5, height: 2 / 3 })).toEqual({
      x: 0.333333,
      y: 0.123456,
      width: 0.5,
      height: 0.666667,
    });
    expect(isWholeCrop({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    expect(isWholeCrop({ x: 0.0000001, y: 0, width: 0.9999999, height: 1 })).toBe(true);
    expect(isWholeCrop({ x: 0.1, y: 0, width: 0.9, height: 1 })).toBe(false);
    expect(isWholeCrop(undefined)).toBe(true);
  });

  it('trims a crop that runs past the picture edge', () => {
    expect(trimCrop({ x: 0.6, y: 0, width: 0.6, height: 1 })).toEqual({
      x: 0.6,
      y: 0,
      width: 0.4,
      height: 1,
    });
    expect(trimCrop({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 })).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.5,
      height: 0.5,
    });
  });
});
