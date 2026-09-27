import { analyzeFlow } from '@sododeck/model';
import type { Flow } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { flowDeck } from '../../test/flow-fixtures';
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
