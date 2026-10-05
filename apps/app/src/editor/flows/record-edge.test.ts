import type { Flow } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck, session } from '../../test/flow-fixtures';
import { recordEdge } from './record-edge';

describe('recordEdge', () => {
  it('creates the flow on the first click of a new flow', () => {
    expect(
      recordEdge(flowDeck, session({ pendingTitle: 'Place', featureId: 'delivery' }), 'cd'),
    ).toEqual({ kind: 'create', title: 'Place', featureId: 'delivery', edge: 'cd' });
  });

  it('appends an edge that starts where the path ends, a self-loop, or a used edge', () => {
    const s = session({ flowId: 'place' });
    expect(recordEdge(flowDeck, s, 'cd')).toEqual({ kind: 'append', branchId: null, edge: 'cd' });
    const loop: Flow = { id: 'l', title: 'L', steps: [{ id: '1', edge: 'ab' }] };
    const deck = { ...flowDeck, flows: [loop] };
    expect(recordEdge(deck, session({ flowId: 'l' }), 'bb')?.kind).toBe('append');
  });

  it('refuses a non-contiguous edge and offers a branch from an earlier main step', () => {
    const s = session({ flowId: 'place' });
    // bb leaves b, the end of step 1.
    expect(recordEdge(flowDeck, s, 'bb')).toEqual({
      kind: 'invalid',
      stepNumber: '3',
      branchFromStep: 's1',
    });
    expect(recordEdge(flowDeck, s, 'ab')).toEqual({
      kind: 'invalid',
      stepNumber: '3',
      branchFromStep: null,
    });
  });

  it('with branches, offers a branch only from the branch step', () => {
    const s = session({ flowId: 'pay', target: { kind: 'branch', branchId: 'ok' } });
    // The "ok" path ends at d; cy leaves c, the end of the branch step p2.
    expect(recordEdge(branchedDeck, s, 'cy')).toEqual({
      kind: 'invalid',
      stepNumber: '4a',
      branchFromStep: 'p2',
    });
    // bb leaves b, the end of step 1: an earlier main step, so no branch offer.
    expect(recordEdge(branchedDeck, s, 'bb')).toMatchObject({ branchFromStep: null });
  });

  it('appends to the targeted branch', () => {
    const s = session({ flowId: 'pay', target: { kind: 'branch', branchId: 'fail' } });
    expect(recordEdge(branchedDeck, s, 'cx')?.kind).toBe('invalid');
    const withXy = {
      ...branchedDeck,
      edges: [...branchedDeck.edges, { id: 'xy', from: 'x', to: 'y' }],
    };
    expect(recordEdge(withXy, s, 'xy')).toEqual({ kind: 'append', branchId: 'fail', edge: 'xy' });
  });

  it('returns null for an unknown edge', () => {
    expect(recordEdge(flowDeck, session(), 'nope')).toBeNull();
  });
});

describe('recordEdge with notes (053)', () => {
  const withNote = {
    ...flowDeck,
    stickies: [{ id: 'note', text: 'Why', position: { x: 0, y: 0 } }],
    edges: [...flowDeck.edges, { id: 'to-note', from: 'a', to: 'note' }],
  };

  it('never records a connector that ends on a note, on the first click or later', () => {
    expect(
      recordEdge(withNote, session({ pendingTitle: 'X', featureId: null }), 'to-note'),
    ).toBeNull();
    expect(recordEdge(withNote, session({ flowId: 'place' }), 'to-note')).toBeNull();
  });
});
