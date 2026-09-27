import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  NODE_GRID,
  STICKY_DEFAULT_OFFSET,
  nodeCanvasPosition,
  stickyCanvasPosition,
  stickyLabel,
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
