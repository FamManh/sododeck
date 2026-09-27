import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { toFlowEdges, toFlowNodes } from './deck-to-flow';

const deck = {
  ...emptySododeckFile(),
  nodes: [{ id: 'a', title: 'A', type: 'service' }, { id: 'b' }],
  edges: [
    { id: 'e1', from: 'a', to: 'b', label: 'calls' },
    { id: 'e2', from: 'a', to: 'missing' },
    { id: 'e3' },
  ],
};

describe('toFlowNodes', () => {
  it('uses known positions, falls back to a grid, and marks selection', () => {
    const nodes = toFlowNodes(deck, { a: { x: 5, y: 6 } }, 'b');
    expect(nodes[0]).toMatchObject({
      id: 'a',
      width: 164,
      height: 50,
      position: { x: 5, y: 6 },
      selected: false,
      data: { title: 'A', kind: 'service' },
    });
    expect(nodes[1]).toMatchObject({
      id: 'b',
      position: { x: 220, y: 0 },
      selected: true,
      data: { title: 'b', kind: 'default' },
    });
  });
});

describe('toFlowEdges', () => {
  it('keeps only edges with existing endpoints', () => {
    expect(toFlowEdges(deck)).toEqual([
      { id: 'e1', source: 'a', target: 'b', type: 'smoothstep', label: 'calls' },
    ]);
  });
});
