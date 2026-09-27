import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTION } from '../state/ui-store';
import { facingSides, toFlowEdges, toFlowNodes } from './deck-to-flow';
import type { EdgeFlowMark } from './flows/flow-overlay';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    {
      id: 'a',
      type: 'service',
      title: 'A',
      tech: 'Go',
      rules: ['R'],
      group: 'g',
      position: { x: 5, y: 6 },
    },
    { id: 'b', type: 'database', title: 'B' },
  ],
  groups: [{ id: 'g', title: 'Core' }],
  edges: [
    { id: 'e1', from: 'a', to: 'b', label: 'calls', protocol: 'http' },
    { id: 'e3', from: 'b', to: 'a', label: '' },
    // References are not checked by the schema, so a dangling edge can still reach the canvas.
    { id: 'e2', from: 'a', to: 'missing' },
  ],
  rules: { R: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
};

describe('toFlowNodes', () => {
  it('maps components with position, selection, focus and data', () => {
    const nodes = toFlowNodes(deck, { nodes: ['b'], edges: [] }, 'a');
    const [a, b] = nodes.filter((n) => n.type === 'deck');
    expect(a).toMatchObject({
      id: 'a',
      width: 164,
      height: 50,
      position: { x: 5, y: 6 },
      selected: false,
      data: { title: 'A', kind: 'service', subtitle: 'Go', hasRules: true, focused: true },
    });
    expect(b).toMatchObject({
      id: 'b',
      position: { x: 220, y: 0 },
      selected: true,
      data: { title: 'B', kind: 'database', subtitle: undefined, hasRules: false, focused: false },
    });
  });

  it('adds non-interactive group boundaries below the components', () => {
    const [group] = toFlowNodes(deck, EMPTY_SELECTION, null);
    expect(group).toMatchObject({
      id: 'group:g',
      type: 'group-boundary',
      position: { x: 5 - 24, y: 6 - 24 },
      width: 164 + 48,
      height: 50 + 48,
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: -1,
      data: { title: 'Core', count: 1 },
    });
  });

  it('returns the same object for a node whose source did not change', () => {
    const first = toFlowNodes(deck, EMPTY_SELECTION, null);
    const moved: SododeckFile = {
      ...deck,
      nodes: [
        { ...deck.nodes[0], position: { x: 50, y: 60 } } as SododeckFile['nodes'][number],
        deck.nodes[1] as SododeckFile['nodes'][number],
      ],
    };
    const second = toFlowNodes(moved, EMPTY_SELECTION, null);
    expect(second.find((n) => n.id === 'b')).toBe(first.find((n) => n.id === 'b'));
    expect(second.find((n) => n.id === 'a')).not.toBe(first.find((n) => n.id === 'a'));
    expect(toFlowNodes(deck, EMPTY_SELECTION, null).find((n) => n.id === 'a')).toBe(
      first.find((n) => n.id === 'a'),
    );
  });
});

describe('toFlowEdges', () => {
  it('keeps only edges with existing endpoints, with data for the edge view', () => {
    const edges = toFlowEdges(deck, { nodes: [], edges: ['e1'] }, false);
    expect(edges.map((e) => e.id)).toEqual(['e1', 'e3']);
    expect(edges[0]).toMatchObject({
      type: 'deck',
      source: 'a',
      target: 'b',
      selected: true,
      interactionWidth: 12,
      ariaLabel: 'A to B: calls',
      data: {
        label: 'calls',
        protocol: 'http',
        direction: 'forward',
        showLabel: false,
        fromTitle: 'A',
        toTitle: 'B',
      },
    });
  });

  it('shows label pills only with Labels on and a non-empty label', () => {
    const edges = toFlowEdges(deck, EMPTY_SELECTION, true);
    expect(edges.map((e) => e.data?.showLabel)).toEqual([true, false]);
  });

  it('connects the facing sides of the two nodes', () => {
    expect(facingSides({ x: 0, y: 0 }, { x: 200, y: 20 })).toEqual(['right', 'left']);
    expect(facingSides({ x: 0, y: 0 }, { x: -200, y: 20 })).toEqual(['left', 'right']);
    expect(facingSides({ x: 0, y: 0 }, { x: 10, y: 200 })).toEqual(['bottom', 'top']);
    expect(facingSides({ x: 0, y: 0 }, { x: 10, y: -200 })).toEqual(['top', 'bottom']);
  });

  it('reuses edge objects when nothing about them changed', () => {
    const first = toFlowEdges(deck, EMPTY_SELECTION, false);
    const second = toFlowEdges(deck, EMPTY_SELECTION, false);
    expect(second[0]).toBe(first[0]);
    // The list itself too, so React Flow does not re-sync its edges during a drag.
    expect(second).toBe(first);
    expect(toFlowEdges(deck, EMPTY_SELECTION, true)[0]).not.toBe(first[0]);
  });
});

describe('flow overlay (006)', () => {
  const mark = (label: string): EdgeFlowMark => ({
    badges: [{ label, errorPath: false, current: false, chainBreak: false }],
    style: 'path',
    errorIcon: false,
  });
  const overlay = (edges: [string, EdgeFlowMark][], nodes: [string, string][] = []) => ({
    edges: new Map(edges),
    nodes: new Map(nodes.map(([id, startsHere]) => [id, { startsHere }])),
  });

  it('puts the mark on the edge and the start tag on the node', () => {
    const [e1] = toFlowEdges(deck, EMPTY_SELECTION, false, null, overlay([['e1', mark('1')]]));
    expect(e1?.data?.flow).toEqual(mark('1'));
    const nodes = toFlowNodes(
      deck,
      EMPTY_SELECTION,
      null,
      overlay([], [['b', 'Step 2 starts here']]),
    );
    expect(nodes.find((n) => n.id === 'b')?.data).toMatchObject({
      flowStart: 'Step 2 starts here',
    });
  });

  it('keeps edge identity for untouched edges and for equal marks', () => {
    const first = toFlowEdges(deck, EMPTY_SELECTION, false, null, overlay([['e1', mark('1')]]));
    const same = toFlowEdges(deck, EMPTY_SELECTION, false, null, overlay([['e1', mark('1')]]));
    expect(same).toBe(first);
    const other = toFlowEdges(deck, EMPTY_SELECTION, false, null, overlay([['e1', mark('2')]]));
    expect(other[0]).not.toBe(first[0]);
    expect(other[1]).toBe(first[1]);
  });
});
