import { STICKY_DEFAULT_OFFSET, stickyCanvasPosition } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTION } from '../state/ui-store';
import {
  facingSides,
  toFlowEdges,
  toFlowNodes,
  toLeaderEdges,
  toStickyNodes,
} from './deck-to-flow';
import type { EdgeFlowMark, FlowOverlay, NodeFlowMark } from './flows/flow-overlay';

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
  stickies: [
    { id: 'st-free', text: 'Free note', position: { x: 30, y: 40 } },
    { id: 'st-pinned', text: 'Pinned note', anchor: 'b' },
    { id: 'st-foreign', text: 'Foreign note', anchor: 'e1', position: { x: 10, y: 12 } },
    { id: 'st-missing', text: 'Missing note', anchor: 'gone', position: { x: 50, y: 60 } },
  ],
};

describe('toFlowNodes', () => {
  it('maps components with position, selection, focus and data', () => {
    const nodes = toFlowNodes(deck, { nodes: ['b'], edges: [], stickies: [] }, 'a');
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

  describe('toStickyNodes', () => {
    it('maps notes with position, selection and data', () => {
      const stickyNodes = toStickyNodes(deck, { nodes: [], edges: [], stickies: ['st-free'] });
      const freeSticky = deck.stickies[0];
      if (freeSticky === undefined) throw new Error('Missing free sticky fixture');
      expect(stickyNodes.map((node) => node.id)).toEqual([
        'sticky:st-free',
        'sticky:st-pinned',
        'sticky:st-foreign',
        'sticky:st-missing',
      ]);
      expect(stickyNodes[0]).toMatchObject({
        id: 'sticky:st-free',
        type: 'sticky',
        position: stickyCanvasPosition(deck, freeSticky).point,
        selected: true,
        data: {
          stickyId: 'st-free',
          label: 'Free note',
          text: 'Free note',
          status: 'free',
          pinnedToTitle: null,
          collapsed: false,
        },
      });
      expect(stickyNodes[1]).toMatchObject({
        id: 'sticky:st-pinned',
        position: { x: 220 + STICKY_DEFAULT_OFFSET.x, y: STICKY_DEFAULT_OFFSET.y },
        data: {
          status: 'pinned',
          pinnedTo: 'b',
          pinnedToTitle: 'B',
        },
      });
    });

    it('reuses sticky objects when the sticky and its anchor did not change', () => {
      const first = toStickyNodes(deck, EMPTY_SELECTION);
      const moved: SododeckFile = {
        ...deck,
        nodes: [
          deck.nodes[0] as SododeckFile['nodes'][number],
          { ...deck.nodes[1], position: { x: 500, y: 25 } } as SododeckFile['nodes'][number],
        ],
        stickies: deck.stickies,
      };
      const second = toStickyNodes(moved, EMPTY_SELECTION);
      expect(second.find((n) => n.id === 'sticky:st-free')).toBe(
        first.find((n) => n.id === 'sticky:st-free'),
      );
      expect(second.find((n) => n.id === 'sticky:st-pinned')).not.toBe(
        first.find((n) => n.id === 'sticky:st-pinned'),
      );
    });

    it('dims or shows notes in flow mode, hides them when requested, and makes them non-draggable', () => {
      const playbackOverlay: FlowOverlay = {
        edges: new Map(),
        nodes: new Map<string, NodeFlowMark>([['b', { currentStep: true }]]),
      };
      const shown = toStickyNodes(deck, EMPTY_SELECTION, playbackOverlay, {
        flowMode: true,
        notesDisplay: 'dimmed',
        emptyFlow: false,
        brokenCurrentStep: false,
      });
      expect(shown.find((node) => node.id === 'sticky:st-free')).toMatchObject({
        className: 'sd-note-dimmed',
        draggable: false,
      });
      expect(shown.find((node) => node.id === 'sticky:st-pinned')).toMatchObject({
        className: 'in-flow sd-note-shown',
        draggable: false,
      });
      const repeated = toStickyNodes(deck, EMPTY_SELECTION, playbackOverlay, {
        flowMode: true,
        notesDisplay: 'dimmed',
        emptyFlow: false,
        brokenCurrentStep: false,
      });
      expect(repeated.find((node) => node.id === 'sticky:st-free')).toBe(
        shown.find((node) => node.id === 'sticky:st-free'),
      );
      const hidden = toStickyNodes(deck, EMPTY_SELECTION, playbackOverlay, {
        flowMode: true,
        notesDisplay: 'hidden',
        emptyFlow: false,
        brokenCurrentStep: false,
      });
      expect(hidden.every((node) => node.hidden === true)).toBe(true);
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
    const edges = toFlowEdges(deck, { nodes: [], edges: ['e1'], stickies: [] }, false);
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

describe('toLeaderEdges', () => {
  it('maps pinned notes only as non-interactive leader edges', () => {
    const leaders = toLeaderEdges(deck);
    expect(leaders).toEqual([
      expect.objectContaining({
        id: 'sticky-leader:st-pinned',
        type: 'sticky-leader',
        source: 'b',
        target: 'sticky:st-pinned',
        selectable: false,
        focusable: false,
      }),
    ]);
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

describe('flow mode marks (007)', () => {
  const chain: SododeckFile = {
    ...emptySododeckFile(),
    nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, type: 'service', title: id.toUpperCase() })),
    edges: [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
      { id: 'cd', from: 'c', to: 'd' },
    ],
  };
  const edge = (inPath: boolean, current: boolean): EdgeFlowMark => ({
    badges: [{ label: '1', errorPath: false, current, chainBreak: false }],
    style: 'path',
    errorIcon: false,
    inPath,
    current: current ? { speed: 1 } : null,
  });
  /** Steps ab, bc played (cd off path), `current` the current edge. */
  const overlay = (current: 'ab' | 'bc'): FlowOverlay => {
    const node = (id: string): NodeFlowMark => ({
      inPath: true,
      currentStep: current === 'ab' ? id !== 'c' : id !== 'a',
    });
    return {
      edges: new Map([
        ['ab', edge(true, current === 'ab')],
        ['bc', edge(true, current === 'bc')],
        ['cd', edge(false, false)],
      ]),
      nodes: new Map(['a', 'b', 'c'].map((id) => [id, node(id)])),
    };
  };

  it('sets in-flow on members only and carries the current step to nodes', () => {
    const nodes = toFlowNodes(chain, EMPTY_SELECTION, null, overlay('ab'));
    expect(nodes.map((n) => n.className)).toEqual(['in-flow', 'in-flow', 'in-flow', undefined]);
    expect(nodes.map((n) => n.data.currentStep === true)).toEqual([true, true, false, false]);
    const edges = toFlowEdges(chain, EMPTY_SELECTION, false, null, overlay('ab'));
    expect(edges.map((e) => e.className)).toEqual(['in-flow', 'in-flow', undefined]);
  });

  it('rebuilds only the old and new current edges and their nodes', () => {
    const nodes = toFlowNodes(chain, EMPTY_SELECTION, null, overlay('ab'));
    const edges = toFlowEdges(chain, EMPTY_SELECTION, false, null, overlay('ab'));
    const nextNodes = toFlowNodes(chain, EMPTY_SELECTION, null, overlay('bc'));
    const nextEdges = toFlowEdges(chain, EMPTY_SELECTION, false, null, overlay('bc'));
    expect(nextEdges.map((e, i) => e === edges[i])).toEqual([false, false, true]);
    // a leaves the step, c joins it, b stays in it, d is untouched.
    expect(nextNodes.map((n, i) => n === nodes[i])).toEqual([false, true, false, true]);
  });
});
