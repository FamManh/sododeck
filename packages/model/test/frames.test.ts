import { emptySododeckFile, type Frame, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fitGroupFrames, frameOf, fromJSON, getObject, toJSON } from '../src';
import { expectValid, seqIds } from './helpers';

const CARD = { width: 164, height: 104 };
const PAD = 24;
const opts = { cardSize: CARD, padding: PAD };

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'inner', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', group: 'inner', position: { x: 200, y: 100 } },
    { id: 'c', type: 'service', title: 'C', group: 'outer', position: { x: 600, y: 0 } },
    { id: 'd', type: 'service', title: 'D' },
  ],
  groups: [
    { id: 'outer', title: 'Outer' },
    { id: 'inner', title: 'Inner', parent: 'outer' },
    { id: 'empty', title: 'Empty' },
    { id: 'loop1', title: 'Loop 1', parent: 'loop2' },
    { id: 'loop2', title: 'Loop 2', parent: 'loop1' },
  ],
};

const frame = (x: number, y: number, width: number, height: number): Frame => ({
  position: { x, y },
  size: { width, height },
});

describe('frameOf', () => {
  it('is the stored frame, or undefined without both fields', () => {
    expect(frameOf({})).toBeUndefined();
    expect(frameOf({ position: { x: 1, y: 2 } })).toBeUndefined();
    expect(frameOf({ position: { x: 1, y: 2 }, size: { width: 3, height: 4 } })).toEqual(
      frame(1, 2, 3, 4),
    );
  });
});

describe('fitGroupFrames (R2)', () => {
  it('fits nested groups inner-first: members plus child frames, plus padding', () => {
    const frames = fitGroupFrames(deck, opts);
    expect(frames.get('inner')).toEqual(frame(-24, -24, 200 + 164 + 48, 100 + 104 + 48));
    // Outer: the inner frame (-24…388, -24…228) and c (600…764, 0…104), plus padding.
    expect(frames.get('outer')).toEqual(frame(-48, -48, 788 + 48, 252 + 48));
  });

  it('skips empty groups and parent cycles', () => {
    const frames = fitGroupFrames(deck, opts);
    expect([...frames.keys()].sort()).toEqual(['inner', 'outer']);
  });

  it('takes the card size and padding from the arguments', () => {
    const frames = fitGroupFrames(deck, { cardSize: { width: 10, height: 10 }, padding: 0 });
    expect(frames.get('inner')).toEqual(frame(0, 0, 210, 110));
  });

  it('uses the grid slot for members without a position', () => {
    const file: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [
        { id: 'x', type: 'service', title: 'X' },
        { id: 'y', type: 'service', title: 'Y', group: 'g' },
      ],
      groups: [{ id: 'g', title: 'G' }],
    };
    expect(fitGroupFrames(file, { cardSize: CARD, padding: 0 }).get('g')).toEqual(
      frame(220, 0, 164, 104),
    );
  });

  it('returns only groups missing a frame, and fits parents around stored child frames', () => {
    const file: SododeckFile = {
      ...deck,
      groups: deck.groups.map((g) =>
        g.id === 'inner'
          ? { ...g, position: { x: -100, y: -100 }, size: { width: 50, height: 50 } }
          : g,
      ),
    };
    const frames = fitGroupFrames(file, opts);
    expect(frames.has('inner')).toBe(false);
    expect(frames.get('outer')).toEqual(frame(-124, -124, 764 + 24 + 124, 104 + 124 + 24));
  });

  it('fits a view from its own positions, only for groups with no frame in that view', () => {
    const file: SododeckFile = {
      ...deck,
      views: [
        { id: 'v1', type: 'system', title: 'One' },
        { id: 'v2', type: 'infra', title: 'Two', positions: { a: { x: 1000, y: 1000 } } },
      ],
    };
    const frames = fitGroupFrames(file, { ...opts, viewId: 'v2' });
    expect(frames.get('inner')).toEqual(frame(176, 76, 1164 - 200 + 48, 1104 - 100 + 48));

    const framed: SododeckFile = {
      ...file,
      views: [
        { id: 'v1', type: 'system', title: 'One' },
        {
          id: 'v2',
          type: 'infra',
          title: 'Two',
          positions: { a: { x: 1000, y: 1000 } },
          groupFrames: { inner: frame(0, 0, 500, 500) },
        },
      ],
    };
    const again = fitGroupFrames(framed, { ...opts, viewId: 'v2' });
    expect(again.has('inner')).toBe(false);
    expect(again.get('outer')).toEqual(frame(-24, -24, 764 + 48, 500 + 48));
  });

  it('fits 2,000 nodes in under 50 ms', () => {
    const file: SododeckFile = { ...emptySododeckFile() };
    for (let g = 0; g < 100; g++) {
      file.groups.push({
        id: `g${String(g)}`,
        title: 'G',
        ...(g % 10 ? { parent: `g${String(g - (g % 10))}` } : {}),
      });
    }
    for (let i = 0; i < 2000; i++) {
      file.nodes.push({
        id: `n${String(i)}`,
        type: 'service',
        title: 'N',
        group: `g${String(i % 100)}`,
        position: { x: (i % 50) * 200, y: Math.floor(i / 50) * 120 },
      });
    }
    fitGroupFrames(file, opts);
    const start = performance.now();
    const frames = fitGroupFrames(file, opts);
    expect(performance.now() - start).toBeLessThan(50);
    expect(frames.size).toBe(100);
  });
});

describe('fillGroupFrames and setGroupFrames (R2, R4)', () => {
  const withViews: SododeckFile = {
    ...deck,
    groups: deck.groups.filter((g) => !g.id.startsWith('loop')),
    views: [
      { id: 'v1', type: 'system', title: 'One' },
      { id: 'v2', type: 'infra', title: 'Two', positions: { a: { x: 5, y: 5 } } },
    ],
  };

  function setup(file: SododeckFile = withViews) {
    const doc = fromJSON(file);
    return { doc, editor: createEditor(doc, { newId: seqIds() }) };
  }

  it('fillGroupFrames writes only missing frames and adds no undo step', () => {
    const { doc, editor } = setup({
      ...withViews,
      groups: withViews.groups.map((g) =>
        g.id === 'outer' ? { ...g, position: { x: 1, y: 1 }, size: { width: 9, height: 9 } } : g,
      ),
    });
    editor.fillGroupFrames(
      new Map([
        ['outer', frame(0, 0, 100, 100)],
        ['inner', frame(0, 0, 50, 50)],
      ]),
      new Map([['v2', new Map([['inner', frame(7, 7, 70, 70)]])]]),
    );
    expect(frameOf(getObject(doc, 'groups', 'outer') ?? {})).toEqual(frame(1, 1, 9, 9));
    expect(frameOf(getObject(doc, 'groups', 'inner') ?? {})).toEqual(frame(0, 0, 50, 50));
    expect(getObject(doc, 'views', 'v2')?.groupFrames).toEqual({ inner: frame(7, 7, 70, 70) });
    expect(editor.canUndo()).toBe(false);
    expectValid(doc);
  });

  it('setGroupFrames on the base view writes the group fields as one undo step', () => {
    const { doc, editor } = setup();
    editor.setGroupFrames('v1', { inner: frame(1, 2, 300, 200), outer: frame(0, 0, 900, 400) });
    const groups = toJSON(doc).groups;
    expect(frameOf(groups[1] ?? {})).toEqual(frame(1, 2, 300, 200));
    expect(frameOf(groups[0] ?? {})).toEqual(frame(0, 0, 900, 400));
    expect(Object.keys(groups[1] ?? {})).toEqual(['id', 'title', 'parent', 'position', 'size']);
    expectValid(doc);
    expect(editor.undo()).toBe(true);
    expect(frameOf(toJSON(doc).groups[1] ?? {})).toBeUndefined();
    expect(editor.canUndo()).toBe(false);
  });

  it('setGroupFrames on another view writes view.groupFrames and leaves the base frame alone', () => {
    const { doc, editor } = setup();
    editor.setGroupFrames('v1', { inner: frame(1, 2, 300, 200) });
    editor.setGroupFrames('v2', { inner: frame(50, 60, 310, 210) });
    expect(frameOf(getObject(doc, 'groups', 'inner') ?? {})).toEqual(frame(1, 2, 300, 200));
    expect(getObject(doc, 'views', 'v2')?.groupFrames?.inner).toEqual(frame(50, 60, 310, 210));
    expectValid(doc);
    editor.undo();
    // The base frames copied into the view on first write stay (untracked), the edit goes.
    expect(getObject(doc, 'views', 'v2')?.groupFrames).toEqual({ inner: frame(1, 2, 300, 200) });
  });

  it('materializes: the first view write copies the base frames into the view', () => {
    const { doc, editor } = setup();
    editor.setGroupFrames('v1', { inner: frame(1, 2, 300, 200), outer: frame(0, 0, 900, 400) });
    editor.setGroupFrames('v2', { inner: frame(50, 60, 310, 210) });
    expect(getObject(doc, 'views', 'v2')?.groupFrames).toEqual({
      outer: frame(0, 0, 900, 400),
      inner: frame(50, 60, 310, 210),
    });
    // Later base edits no longer reach that view.
    editor.setGroupFrames('v1', { outer: frame(9, 9, 900, 400) });
    expect(getObject(doc, 'views', 'v2')?.groupFrames?.outer).toEqual(frame(0, 0, 900, 400));
  });

  it('materializes the preset views of a deck without stored views, outside history', () => {
    const { doc, editor } = setup({ ...withViews, views: [] });
    editor.setGroupFrames('feature', { inner: frame(0, 0, 400, 300) });
    expect(toJSON(doc).views.map((v) => v.id)).toEqual(['system', 'feature', 'infra']);
    expect(getObject(doc, 'views', 'feature')?.groupFrames?.inner).toEqual(frame(0, 0, 400, 300));
    editor.undo();
    expect(toJSON(doc).views).toHaveLength(3);
    expect(editor.canUndo()).toBe(false);
  });

  it('skips unknown groups and refuses non-positive or non-finite sizes', () => {
    const { doc, editor } = setup();
    editor.setGroupFrames('v1', { gone: frame(0, 0, 10, 10) });
    expect(editor.canUndo()).toBe(false);
    expect(() => {
      editor.setGroupFrames('v1', { inner: frame(0, 0, 0, 10) });
    }).toThrow();
    expect(() => {
      editor.setGroupFrames('v1', { inner: frame(Number.NaN, 0, 10, 10) });
    }).toThrow();
    expect(frameOf(getObject(doc, 'groups', 'inner') ?? {})).toBeUndefined();
  });

  it('merges with moveInView inside one gesture: one undo step', () => {
    const { doc, editor } = setup();
    editor.beginGesture();
    editor.moveInView('v1', { a: { x: 10, y: 10 } });
    editor.setGroupFrames('v1', { inner: frame(1, 2, 300, 200) });
    editor.moveInView('v1', { a: { x: 20, y: 20 } });
    editor.endGesture();
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')?.position).toEqual({ x: 0, y: 0 });
    expect(frameOf(getObject(doc, 'groups', 'inner') ?? {})).toBeUndefined();
    expect(editor.canUndo()).toBe(false);
  });
});
