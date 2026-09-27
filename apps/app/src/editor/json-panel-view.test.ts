import { serializeEntries, serializeEntry } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  copyToastText,
  countLines,
  lineCountLabel,
  selectionText,
  selectionView,
} from './json-panel-view';
import { openedFlow } from '../state/ui-store';
import { playbackDeck } from '../test/flow-fixtures';
import { deckOf } from '../test/render-canvas';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'Checkout' },
    { id: 'b', type: 'service', title: 'Orders' },
    { id: 'c', type: 'database', title: 'Orders DB' },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'b', to: 'c', label: 'writes' },
    { id: 'e3', from: 'gone', to: 'c' },
  ],
  stickies: [
    { id: 's1', text: 'Follow up', position: { x: 24, y: 36 } },
    { id: 's2', text: '   ', position: { x: 48, y: 60 } },
  ],
};

const none = { nodes: [], edges: [], stickies: [] };

describe('countLines', () => {
  it('counts lines, ignoring a trailing newline', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('{}')).toBe(1);
    expect(countLines('{\n}')).toBe(2);
    expect(countLines('{\n}\n')).toBe(2);
  });

  it('labels the count', () => {
    expect(lineCountLabel(1)).toBe('1 line');
    expect(lineCountLabel(42)).toBe('42 lines');
  });
});

describe('selectionView', () => {
  it('is empty with the "Selection" label when nothing is selected', () => {
    expect(selectionView(deck, none)).toEqual({
      label: 'Selection',
      fullLabel: 'Selection',
      entries: [],
    });
  });

  it('labels one node with its title', () => {
    const view = selectionView(deck, { nodes: ['b'], edges: [], stickies: [] });
    expect(view.label).toBe('Orders');
    expect(view.fullLabel).toBe('Orders');
    expect(view.entries).toEqual([{ collection: 'nodes', value: deck.nodes[1] }]);
  });

  it('labels an edge with its label, or with its end titles', () => {
    expect(selectionView(deck, { nodes: [], edges: ['e2'], stickies: [] }).label).toBe('writes');
    expect(selectionView(deck, { nodes: [], edges: ['e1'], stickies: [] }).label).toBe(
      'Checkout → Orders',
    );
    // A missing end falls back to its id.
    expect(selectionView(deck, { nodes: [], edges: ['e3'], stickies: [] }).label).toBe(
      'gone → Orders DB',
    );
  });

  it('labels one sticky with its note label', () => {
    const view = selectionView(deck, { nodes: [], edges: [], stickies: ['s1'] });
    expect(view.label).toBe('Follow up');
    expect(view.entries).toEqual([{ collection: 'stickies', value: deck.stickies[0] }]);
    expect(selectionView(deck, { nodes: [], edges: [], stickies: ['s2'] }).label).toBe(
      'Empty note',
    );
  });

  it('lists nodes, edges, then stickies, each in deck order, for a mixed selection', () => {
    const view = selectionView(deck, {
      nodes: ['c', 'a', 'b'],
      edges: ['e2'],
      stickies: ['s2', 's1'],
    });
    expect(view.label).toBe('6 selected');
    expect(view.entries.map((e) => e.value)).toEqual([
      deck.nodes[0],
      deck.nodes[1],
      deck.nodes[2],
      deck.edges[1],
      deck.stickies[0],
      deck.stickies[1],
    ]);
  });

  it('skips ids that are not in the deck', () => {
    const view = selectionView(deck, { nodes: ['a', 'nope'], edges: ['nope'], stickies: ['x'] });
    expect(view.label).toBe('Checkout');
    expect(view.entries).toHaveLength(1);
  });
});

describe('selectionText', () => {
  it('is empty, one object, or an array', () => {
    expect(selectionText([])).toBe('');
    const one = selectionView(deck, { nodes: ['a'], edges: [], stickies: [] }).entries;
    expect(selectionText(one)).toBe(serializeEntry('nodes', deck.nodes[0]));
    const many = selectionView(deck, { nodes: ['a'], edges: ['e1'], stickies: ['s1'] }).entries;
    expect(selectionText(many)).toBe(serializeEntries(many));
  });
});

describe('copyToastText', () => {
  it('names what was copied', () => {
    expect(copyToastText('deck', selectionView(deck, none))).toBe('Copied Deck JSON');
    expect(
      copyToastText('selection', selectionView(deck, { nodes: ['b'], edges: [], stickies: [] })),
    ).toBe('Copied Orders JSON');
    expect(
      copyToastText(
        'selection',
        selectionView(deck, {
          nodes: ['a', 'b'],
          edges: ['e1', 'e2'],
          stickies: ['s1'],
        }),
      ),
    ).toBe('Copied 5 items as JSON');
  });
});

describe('selectionView for flows (006)', () => {
  const flowDeck = deckOf({
    nodes: [{ id: 'a', type: 'service', title: 'A' }],
    edges: [{ id: 'aa', from: 'a', to: 'a' }],
    flows: [{ id: 'f', title: 'Place order', steps: [{ id: 's1', edge: 'aa' }] }],
  });
  const none = { nodes: [], edges: [], stickies: [] };

  it('shows the whole flow, labelled Flow, or Step while a step is selected', () => {
    const view = selectionView(flowDeck, none, openedFlow('f'));
    expect(view.label).toBe('Flow');
    expect(view.fullLabel).toBe('Flow: Place order');
    expect(view.entries).toEqual([{ collection: 'flows', value: flowDeck.flows[0] }]);
    expect(selectionText(view.entries)).toBe(
      serializeEntry('flows', flowDeck.flows[0] as SododeckFile['flows'][number]),
    );
    expect(selectionView(flowDeck, none, openedFlow('f', 's1')).label).toBe('Step');
  });

  it('falls back to the canvas selection when the flow is gone', () => {
    expect(selectionView(flowDeck, none, openedFlow('x')).label).toBe('Selection');
  });
});

describe('selectionView in flow mode (007 FR-022)', () => {
  const none = { nodes: [], edges: [], stickies: [] };
  const order = playbackDeck.flows[0] as SododeckFile['flows'][number];

  it('shows the current step entry, labelled with its number', () => {
    const view = selectionView(playbackDeck, none, openedFlow('order', 'o4'), true);
    expect(view.label).toBe('Step 4');
    expect(view.fullLabel).toBe('Step 4: Place order');
    expect(view.entries).toEqual([{ collection: 'steps', value: order.steps[3] }]);
    expect(selectionText(view.entries)).toBe(serializeEntry('steps', order.steps[3]));
  });

  it('numbers an alternative step', () => {
    const view = selectionView(playbackDeck, none, openedFlow('fork', 'f4b', 'failed'), true);
    expect(view.label).toBe('Step 4b');
  });

  it('keeps the 006 flow entry in a session or with a branch open', () => {
    expect(selectionView(playbackDeck, none, openedFlow('order', 'o4'), false).entries).toEqual([
      { collection: 'flows', value: order },
    ]);
    const branch = { ...openedFlow('fork'), branchId: 'ok' };
    expect(selectionView(playbackDeck, none, branch, true).entries[0]?.collection).toBe('flows');
  });

  it('shows the flow for a flow without steps', () => {
    expect(selectionView(playbackDeck, none, openedFlow('empty'), true).label).toBe('Flow');
  });
});
