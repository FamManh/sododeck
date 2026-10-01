import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import {
  COLLAPSED_CARD_SIZE,
  COMPONENT_CARD_SIZE,
  GROUP_PADDING,
  NODE_SIZE,
} from './canvas-geometry';
import { buildLayoutRequest, expandResult, laidOutFrames, movedCount } from './tidy-layout';
import { visibleGraph } from './visible-graph';
import { viewStateOf } from './views/view-state';

const deck: SododeckFile = deckOf({
  nodes: [
    { id: 'a', type: 'client', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', group: 'core', position: { x: 300, y: 0 } },
    { id: 'c', type: 'database', title: 'C', group: 'inner', position: { x: 300, y: 100 } },
    { id: 'd', type: 'external', title: 'D', group: 'side', position: { x: 600, y: 0 } },
    { id: 'e', type: 'external', title: 'E', group: 'side', position: { x: 600, y: 100 } },
    { id: 'x', type: 'queue', title: 'X', tags: ['hide'] },
  ],
  groups: [
    { id: 'core', title: 'Core' },
    { id: 'inner', title: 'Inner', parent: 'core' },
    { id: 'side', title: 'Side' },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
    { id: 'cd', from: 'c', to: 'd' },
    { id: 'ce', from: 'c', to: 'e' },
    { id: 'ax', from: 'a', to: 'x' },
  ],
  views: [
    {
      id: 'v',
      type: 'custom',
      title: 'V',
      excludeTags: ['hide'],
      pinned: ['a'],
      positions: { a: { x: 11, y: 22 } },
    },
  ],
});
const top = { node: null, group: null };
const state = viewStateOf(deck, 'v');

describe('buildLayoutRequest (011 research R9)', () => {
  it('sends the visible components with their groups, pins at their shown position', () => {
    const graph = visibleGraph(state.deck, top, new Set());
    const request = buildLayoutRequest(state.deck, graph, state.render.pinned, 'system');
    expect(request.nodes.map((n) => [n.id, n.parent])).toEqual([
      ['a', undefined],
      ['b', 'core'],
      ['c', 'inner'],
      ['d', 'side'],
      ['e', 'side'],
    ]);
    expect(request.nodes[0]).toMatchObject(NODE_SIZE);
    expect(request.groups).toEqual([
      { id: 'core' },
      { id: 'inner', parent: 'core' },
      { id: 'side' },
    ]);
    expect(request.edges.map((e) => e.id)).toEqual(['ab', 'bc', 'cd', 'ce']);
    expect(request.pinned).toEqual({ a: { x: 11, y: 22 } });
  });

  it('sizes components for the zoom level', () => {
    const graph = visibleGraph(state.deck, top, new Set());
    const request = buildLayoutRequest(state.deck, graph, state.render.pinned, 'component');
    expect(request.nodes[0]).toMatchObject(COMPONENT_CARD_SIZE);
  });

  it('uses a node’s stored size over the level size (017 R2)', () => {
    const sized: SododeckFile = deckOf({
      nodes: [{ id: 'a', type: 'client', title: 'A', size: { width: 260, height: 90 } }],
    });
    const graph = visibleGraph(sized, top, new Set());
    const request = buildLayoutRequest(sized, graph, new Set(), 'system');
    expect(request.nodes[0]).toMatchObject({ width: 260, height: 90 });
  });

  it('sends a collapsed group as one card, with its merged connections', () => {
    const graph = visibleGraph(state.deck, top, new Set(['side']));
    const request = buildLayoutRequest(state.deck, graph, state.render.pinned, 'system');
    expect(request.nodes.map((n) => n.id)).toEqual(['collapsed:side', 'a', 'b', 'c']);
    expect(request.nodes[0]).toMatchObject(COLLAPSED_CARD_SIZE);
    expect(request.groups.map((g) => g.id)).toEqual(['core', 'inner']);
    expect(request.edges).toContainEqual({
      id: 'merged:c|collapsed:side',
      source: 'c',
      target: 'collapsed:side',
    });
  });

  it('sends only the drilled scope', () => {
    const graph = visibleGraph(state.deck, { node: null, group: 'core' }, new Set());
    const request = buildLayoutRequest(state.deck, graph, state.render.pinned, 'system');
    expect(request.nodes.map((n) => [n.id, n.parent])).toEqual([
      ['b', undefined],
      ['c', 'inner'],
    ]);
    expect(request.groups).toEqual([{ id: 'inner' }]);
    expect(request.edges.map((e) => e.id)).toEqual(['bc']);
  });
});

describe('expandResult', () => {
  it('moves the members of a collapsed card by the card’s offset, keeping their arrangement', () => {
    const graph = visibleGraph(state.deck, top, new Set(['side']));
    const card = graph.cards[0];
    if (card === undefined) throw new Error('no card');
    const positions = expandResult(
      {
        'collapsed:side': { x: card.rect.x + 1000, y: card.rect.y + 50 },
        a: { x: 11, y: 22 },
        b: { x: 5, y: 6 },
        c: { x: 7, y: 8 },
      },
      state.deck,
      graph,
      state.render.pinned,
    );
    expect(positions.d).toEqual({ x: 1600, y: 50 });
    expect(positions.e).toEqual({ x: 1600, y: 150 });
    expect(positions.b).toEqual({ x: 5, y: 6 });
    // Pinned components are never written.
    expect(positions).not.toHaveProperty('a');
    expect(movedCount(positions, state.deck)).toBe(4);
  });
});

describe('laidOutFrames (016 FR-045)', () => {
  it('refits the groups of moved components, inner-first, around their new positions', () => {
    const frames = laidOutFrames(state.deck, { c: { x: 1000, y: 1000 }, b: { x: 900, y: 1000 } });
    expect(Object.keys(frames).sort()).toEqual(['core', 'inner']);
    expect(frames.inner).toEqual({
      position: { x: 1000 - GROUP_PADDING, y: 1000 - GROUP_PADDING },
      size: {
        width: COMPONENT_CARD_SIZE.width + 2 * GROUP_PADDING,
        height: COMPONENT_CARD_SIZE.height + 2 * GROUP_PADDING,
      },
    });
    expect(frames.core?.position).toEqual({ x: 900 - GROUP_PADDING, y: 1000 - 2 * GROUP_PADDING });
  });

  it('fits a moved component\u2019s own stored size, not the fixed component size (017 R2)', () => {
    const sized: SododeckFile = {
      ...state.deck,
      nodes: state.deck.nodes.map((n) =>
        n.id === 'c' ? { ...n, size: { width: 300, height: 200 } } : n,
      ),
    };
    const frames = laidOutFrames(sized, { c: { x: 1000, y: 1000 } });
    expect(frames.inner).toEqual({
      position: { x: 1000 - GROUP_PADDING, y: 1000 - GROUP_PADDING },
      size: { width: 300 + 2 * GROUP_PADDING, height: 200 + 2 * GROUP_PADDING },
    });
  });

  it('replaces stored frames of laid-out groups and leaves the others alone', () => {
    const framed: SododeckFile = {
      ...state.deck,
      groups: state.deck.groups.map((g) => ({
        ...g,
        position: { x: -999, y: -999 },
        size: { width: 5000, height: 5000 },
      })),
    };
    const frames = laidOutFrames(framed, { d: { x: 0, y: 0 } });
    expect(Object.keys(frames)).toEqual(['side']);
    expect(frames.side?.position).toEqual({ x: -GROUP_PADDING, y: -GROUP_PADDING });
  });
});
