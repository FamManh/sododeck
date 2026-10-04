import { analyzeFlow } from '@sododeck/model';
import type { Flow } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { flowDeck } from '../../test/flow-fixtures';
import { deckOf } from '../../test/render-canvas';
import { candidateEdges } from './candidate-edges';

const main = { kind: 'main' } as const;

describe('candidateEdges', () => {
  it('lists every edge in reading order for the first step', () => {
    expect(candidateEdges(flowDeck, null, main)).toEqual(['ab', 'bb', 'bc', 'cd', 'cy', 'cx']);
  });

  it('lists the next start node outgoing edges afterwards', () => {
    const place = flowDeck.flows[0] as Flow;
    expect(candidateEdges(flowDeck, analyzeFlow(place, flowDeck.edges), main)).toEqual([
      'cd',
      'cy',
      'cx',
    ]);
  });

  it('is empty at a dead end', () => {
    const toBus: Flow = { id: 't', title: 'T', steps: [{ id: '1', edge: 'cd' }] };
    expect(candidateEdges(flowDeck, analyzeFlow(toBus, flowDeck.edges), main)).toEqual([]);
  });
});

describe('candidateEdges group ends (050 US4)', () => {
  it('lists connectors that start or end on a group, read from its frame', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', title: 'B', position: { x: 0, y: 600 } },
      ],
      groups: [
        { id: 'g', title: 'G', position: { x: 400, y: 300 }, size: { width: 200, height: 100 } },
      ],
      edges: [
        { id: 'bg', from: 'b', to: 'g' },
        { id: 'gb', from: 'g', to: 'b' },
        { id: 'ag', from: 'a', to: 'g' },
      ],
    });
    // Reading order of the source: a (y 0), g (y 300), b (y 600).
    expect(candidateEdges(deck, null, main)).toEqual(['ag', 'gb', 'bg']);
    const into: Flow = { id: 'f', title: 'F', steps: [{ id: '1', edge: 'ag' }] };
    expect(candidateEdges(deck, analyzeFlow(into, deck.edges), main)).toEqual(['gb']);
  });
});
