// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { applyPins, computeLayout, type LayoutRequest, type LayoutResult } from './elk-layout';

const size = { width: 164, height: 50 };

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function boxes(request: LayoutRequest, result: LayoutResult): Map<string, Box> {
  return new Map(
    request.nodes.map((n) => {
      const p = result[n.id];
      if (p === undefined) throw new Error(`no position for ${n.id}`);
      return [n.id, { ...p, width: n.width, height: n.height }];
    }),
  );
}

function expectNoOverlap(request: LayoutRequest, result: LayoutResult): void {
  const list = [...boxes(request, result).entries()];
  for (const [i, [idA, a]] of list.entries()) {
    for (const [idB, b] of list.slice(i + 1)) {
      if (overlaps(a, b)) throw new Error(`${idA} overlaps ${idB}`);
    }
  }
}

describe('computeLayout', () => {
  it('lays out a chain left to right', async () => {
    const result = await computeLayout({
      nodes: [
        { id: 'a', ...size },
        { id: 'b', ...size },
        { id: 'c', ...size },
      ],
      groups: [],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
      pinned: {},
    });
    expect(Object.keys(result).sort()).toEqual(['a', 'b', 'c']);
    expect(result.a?.x).toBeLessThan(result.b?.x ?? 0);
    expect(result.b?.x).toBeLessThan(result.c?.x ?? 0);
  });

  it('keeps each group together, nested groups inside, in boxes that do not overlap', async () => {
    const request: LayoutRequest = {
      nodes: [
        { id: 'a1', ...size, parent: 'ga' },
        { id: 'a2', ...size, parent: 'ga' },
        { id: 'a3', ...size, parent: 'inner' },
        { id: 'b1', ...size, parent: 'gb' },
        { id: 'b2', ...size, parent: 'gb' },
        { id: 'free', ...size },
      ],
      groups: [{ id: 'ga' }, { id: 'inner', parent: 'ga' }, { id: 'gb' }, { id: 'empty' }],
      edges: [
        { id: 'e1', source: 'a1', target: 'b1' },
        { id: 'e2', source: 'a2', target: 'b2' },
        { id: 'e3', source: 'a3', target: 'free' },
        { id: 'e4', source: 'b2', target: 'free' },
      ],
      pinned: {},
    };
    const result = await computeLayout(request);
    expectNoOverlap(request, result);
    const all = boxes(request, result);
    const bound = (ids: string[]) => {
      const list = ids.map((id) => all.get(id) as Box);
      const x = Math.min(...list.map((b) => b.x));
      const y = Math.min(...list.map((b) => b.y));
      return {
        x,
        y,
        width: Math.max(...list.map((b) => b.x + b.width)) - x,
        height: Math.max(...list.map((b) => b.y + b.height)) - y,
      };
    };
    const groupA = bound(['a1', 'a2', 'a3']);
    const groupB = bound(['b1', 'b2']);
    expect(overlaps(groupA, groupB)).toBe(false);
    // Nothing outside a group sits inside its box.
    for (const id of ['b1', 'b2', 'free']) expect(overlaps(all.get(id) as Box, groupA)).toBe(false);
    for (const id of ['a1', 'a2', 'a3', 'free']) {
      expect(overlaps(all.get(id) as Box, groupB)).toBe(false);
    }
  });

  it('keeps pinned components exactly in place', async () => {
    const pinned = { b: { x: 1000, y: -300 }, d: { x: 37, y: 41 } };
    const request: LayoutRequest = {
      nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, ...size })),
      groups: [],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'd' },
        { id: 'e4', source: 'd', target: 'e' },
      ],
      pinned,
    };
    const result = await computeLayout(request);
    expect(result.b).toEqual(pinned.b);
    expect(result.d).toEqual(pinned.d);
    expectNoOverlap(request, result);
  });

  it('lays out 200 components, 400 connections and 5 pins in under 2 s', async () => {
    const nodes = Array.from({ length: 200 }, (_, i) => ({
      id: `n${String(i)}`,
      ...size,
      ...(i < 180 ? { parent: `g${String(i % 9)}` } : {}),
    }));
    const edges = Array.from({ length: 400 }, (_, i) => ({
      id: `e${String(i)}`,
      source: `n${String(i % 200)}`,
      target: `n${String((i * 7 + 13) % 200)}`,
    })).filter((e) => e.source !== e.target);
    const pinned = Object.fromEntries(
      [0, 40, 80, 120, 160].map((i) => [`n${String(i)}`, { x: i * 10, y: i * 5 }]),
    );
    const request: LayoutRequest = {
      nodes,
      groups: Array.from({ length: 9 }, (_, i) => ({ id: `g${String(i)}` })),
      edges,
      pinned,
    };
    const start = performance.now();
    const result = await computeLayout(request);
    expect(performance.now() - start).toBeLessThan(2000);
    for (const [id, point] of Object.entries(pinned)) expect(result[id]).toEqual(point);
    expectNoOverlap(request, result);
  });
});

describe('applyPins', () => {
  const request: LayoutRequest = {
    nodes: ['a', 'b', 'c', 'p'].map((id) => ({ id, ...size })),
    groups: [],
    edges: [],
    pinned: { p: { x: 0, y: 0 } },
  };
  const laidOut: LayoutResult = {
    a: { x: 0, y: 0 },
    b: { x: 0, y: 100 },
    c: { x: 300, y: 0 },
    p: { x: 300, y: 100 },
  };

  it('moves the layout by the pins’ offset, puts pins back exactly and removes overlaps', () => {
    const result = applyPins(laidOut, request);
    expect(result.p).toEqual({ x: 0, y: 0 });
    // Shifted by (-300, -100) like the pin: c lands on the pin and is pushed off it.
    expect(result.a).toEqual({ x: -300, y: -100 });
    expect(result.b).toEqual({ x: -300, y: 0 });
    expectNoOverlap(request, result);
  });

  it('is deterministic', () => {
    expect(applyPins(laidOut, request)).toEqual(applyPins(laidOut, request));
  });

  it('returns the layout unchanged without pins', () => {
    expect(applyPins(laidOut, { ...request, pinned: {} })).toEqual(laidOut);
  });
});
