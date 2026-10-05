// @vitest-environment node
import { readFileSync } from 'node:fs';

import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';

import { computeLayout } from './elk-layout';
import { STICKY_DEFAULT_SIZE } from '@sododeck/model';

import { cardSize } from '../editor/canvas-geometry';
import {
  applyPlacement,
  hasUnplacedCards,
  NOTE_GAP,
  placementRequests,
  placeUnplaced,
  viewPlacementRequests,
} from './place-unplaced';

const elk = new ELK();
const layout = (request: Parameters<typeof computeLayout>[0]) => computeLayout(request, elk);

const deck = (parts: Partial<SododeckFile>): SododeckFile => ({ ...emptySododeckFile(), ...parts });
const card = (id: string, extra: Partial<Node> = {}): Node => ({
  id,
  type: 'service',
  title: id,
  ...extra,
});

type Box = { x: number; y: number; width: number; height: number };
const boxOf = (node: Node): Box => ({
  x: node.position?.x ?? 0,
  y: node.position?.y ?? 0,
  ...cardSize(node),
});
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function overlaps(nodes: readonly Node[]): string[] {
  const out: string[] = [];
  nodes.forEach((a, i) => {
    nodes.slice(i + 1).forEach((b) => {
      if (overlap(boxOf(a), boxOf(b))) out.push(`${a.id}×${b.id}`);
    });
  });
  return out;
}

describe('placing unplaced cards (027 FR-024)', () => {
  it('knows whether any card lacks a position', () => {
    expect(hasUnplacedCards(deck({ nodes: [card('a', { position: { x: 0, y: 0 } })] }))).toBe(
      false,
    );
    expect(
      hasUnplacedCards(deck({ nodes: [card('a'), card('b', { position: { x: 0, y: 0 } })] })),
    ).toBe(true);
  });

  it('builds one request per level with unplaced cards, pinning placed cards', () => {
    const file = deck({
      nodes: [
        card('top', { position: { x: 5, y: 6 } }),
        card('free'),
        card('in-a', { parent: 'top', group: 'g' }),
        card('in-b', { parent: 'top' }),
        card('placed-level', { parent: 'free', position: { x: 0, y: 0 } }),
      ],
      groups: [{ id: 'g', title: 'G' }],
      edges: [
        { id: 'e1', from: 'top', to: 'free' },
        { id: 'e2', from: 'in-a', to: 'in-b' },
        { id: 'e3', from: 'top', to: 'in-a' },
        { id: 'e4', from: 'in-b', to: 'g' },
      ],
      stickies: [{ id: 'n', text: 'x', position: { x: 0, y: 0 } }],
    });
    const requests = placementRequests(file);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      nodes: [{ id: 'top' }, { id: 'free' }],
      groups: [],
      edges: [{ id: 'e1', source: 'top', target: 'free' }],
      pinned: { top: { x: 5, y: 6 } },
    });
    expect(requests[1]).toMatchObject({
      nodes: [{ id: 'in-a', parent: 'g' }, { id: 'in-b' }],
      groups: [{ id: 'g' }],
      edges: [
        { id: 'e2', source: 'in-a', target: 'in-b' },
        { id: 'e4', source: 'in-b', target: 'group:g' },
      ],
      pinned: {},
    });
  });

  it('leaves connectors to notes and images out of the request', () => {
    const file = deck({
      nodes: [card('a'), card('b')],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'n' },
      ],
      stickies: [{ id: 'n', text: 'x', position: { x: 0, y: 0 } }],
    });
    expect(placementRequests(file)[0]?.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('writes positions for unplaced cards only and frames groups that have none', () => {
    const file = deck({
      nodes: [
        card('a', { group: 'g' }),
        card('b', { position: { x: 900, y: 900 } }),
        card('c', { group: 'h' }),
      ],
      groups: [
        { id: 'g', title: 'G' },
        { id: 'h', title: 'H', position: { x: -50, y: -50 }, size: { width: 999, height: 999 } },
      ],
    });
    const placed = applyPlacement(file, {
      a: { x: 0, y: 0 },
      b: { x: 1, y: 1 },
      c: { x: 300, y: 0 },
    });
    expect(placed.nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: 900, y: 900 },
      { x: 300, y: 0 },
    ]);
    expect(placed.groups[0]?.position).toBeDefined();
    expect(placed.groups[1]).toEqual(file.groups[1]);
  });

  it('lays out the AI deck skill examples without overlaps (SC-005)', async () => {
    for (const name of ['checkout', 'platform', 'refund-policy', 'order-features']) {
      const text = readFileSync(
        new URL(`../../../../packages/skill/examples/${name}.sododeck`, import.meta.url),
        'utf8',
      );
      const placed = await placeUnplaced(JSON.parse(text) as SododeckFile, layout);
      expect(hasUnplacedCards(placed), name).toBe(false);
      const levels = new Map<string, Node[]>();
      for (const node of placed.nodes) {
        levels.set(node.parent ?? '', [...(levels.get(node.parent ?? '') ?? []), node]);
      }
      for (const cards of levels.values()) expect(overlaps(cards), name).toEqual([]);
    }
  });

  it('keeps pinned cards exactly and moves new ones off them', async () => {
    const file = deck({
      nodes: [card('a', { position: { x: 0, y: 0 } }), card('b'), card('c')],
      edges: [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'b', to: 'c' },
      ],
    });
    const placed = await placeUnplaced(file, layout);
    expect(placed.nodes[0]?.position).toEqual({ x: 0, y: 0 });
    expect(overlaps(placed.nodes)).toEqual([]);
  });

  it('measures cards as the canvas draws them, so two-line titles get room (auto-wo regression)', () => {
    const tall = card('q', { title: 'Candidate Generation Queue Worker Pool', tech: 'Postgres' });
    const file = deck({ nodes: [tall, card('b')] });
    const request = placementRequests(file)[0];
    const measured = request?.nodes.find((n) => n.id === 'q');
    expect(measured).toMatchObject(cardSize(tall));
    expect(measured?.height).toBeGreaterThan(72);
    expect(measured?.width).toBeGreaterThan(160);
  });

  it('gives a note anchored to an unplaced card a slot under that card', async () => {
    const file = deck({
      nodes: [card('a'), card('b')],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
      stickies: [
        { id: 'n1', text: 'First caveat', anchor: 'a' },
        { id: 'n2', text: 'Second caveat', anchor: 'a', size: { width: 160, height: 120 } },
        { id: 'kept', text: 'Has its own offset', anchor: 'b', position: { x: 5, y: 5 } },
      ],
    });
    const box = placementRequests(file)[0]?.nodes.find((n) => n.id === 'a');
    const cardHeight = cardSize(card('a')).height;
    expect(box?.height).toBe(cardHeight + NOTE_GAP + STICKY_DEFAULT_SIZE.height + NOTE_GAP + 120);
    const placed = await placeUnplaced(file, layout);
    expect(placed.stickies.map((s) => s.position)).toEqual([
      { x: 0, y: cardHeight + NOTE_GAP },
      { x: 0, y: cardHeight + NOTE_GAP + STICKY_DEFAULT_SIZE.height + NOTE_GAP },
      { x: 5, y: 5 },
    ]);
    // Note boxes stay clear of every other card.
    const a = placed.nodes[0];
    const b = placed.nodes[1];
    if (a?.position === undefined || b?.position === undefined) throw new Error('placed');
    for (const sticky of placed.stickies.slice(0, 2)) {
      const note = {
        x: a.position.x + (sticky.position?.x ?? 0),
        y: a.position.y + (sticky.position?.y ?? 0),
        ...(sticky.size ?? STICKY_DEFAULT_SIZE),
      };
      expect(overlap(note, boxOf(b))).toBe(false);
    }
  });

  it('lays out each feature view that lists its cards, with its own group frames', async () => {
    const file = deck({
      nodes: [
        card('web'),
        card('api', { group: 'core' }),
        card('price', { group: 'core' }),
        card('db', { type: 'database' }),
        card('mail'),
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'e1', from: 'web', to: 'api' },
        { id: 'e2', from: 'api', to: 'price' },
        { id: 'e3', from: 'price', to: 'db' },
        { id: 'e4', from: 'api', to: 'mail' },
      ],
      features: [{ id: 'pricing', title: 'Pricing' }],
      views: [
        { id: 'overview', type: 'system', title: 'Overview' },
        {
          id: 'pricing',
          type: 'feature',
          title: 'Pricing',
          feature: 'pricing',
          includes: ['api', 'price', 'db'],
        },
        {
          id: 'kept',
          type: 'custom',
          title: 'Kept',
          includes: ['web'],
          positions: { web: { x: 1, y: 2 } },
        },
      ],
    });
    expect(viewPlacementRequests(file).map((v) => v.viewId)).toEqual(['pricing']);
    const placed = await placeUnplaced(file, layout);
    const view = placed.views[1];
    expect(Object.keys(view?.positions ?? {}).sort()).toEqual(['api', 'db', 'price']);
    expect(Object.keys(view?.groupFrames ?? {})).toEqual(['core']);
    expect(placed.views[0]?.positions).toBeUndefined();
    expect(placed.views[2]?.positions).toEqual({ web: { x: 1, y: 2 } });
    const inView = placed.nodes
      .filter((n) => view?.positions?.[n.id] !== undefined)
      .map((n) => ({ ...n, position: view?.positions?.[n.id] }));
    expect(overlaps(inView)).toEqual([]);
  });
});
