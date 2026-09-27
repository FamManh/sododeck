import type { ReactFlowState } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { connectionRole } from './use-connection-role';

function state(pointer: { x: number; y: number }, fromId = 'a', inProgress = true) {
  const node = (x: number) => ({
    internals: { positionAbsolute: { x, y: 0 } },
    measured: { width: 164, height: 50 },
  });
  return {
    transform: [10, 20, 2],
    nodeLookup: new Map([
      ['a', node(0)],
      ['b', node(300)],
    ]),
    connection: inProgress ? { inProgress, pointer, fromNode: { id: fromId } } : { inProgress },
  } as unknown as ReactFlowState;
}

describe('connectionRole', () => {
  it('is null when no connection is drawn', () => {
    expect(connectionRole(state({ x: 0, y: 0 }, 'a', false), 'a')).toBeNull();
  });

  it('marks the node under the pointer as the target (flow coordinates via the transform)', () => {
    // Screen (10 + 2·310, 20 + 2·25) = flow (310, 25), inside b.
    const s = state({ x: 630, y: 70 });
    expect(connectionRole(s, 'b')).toBe('target:a');
    expect(connectionRole(s, 'a')).toBe('source');
  });

  it('marks the source itself as the target when hovered well inside (self case)', () => {
    // Flow (40, 25): inside a.
    expect(connectionRole(state({ x: 90, y: 70 }), 'a')).toBe('target:a');
    // Flow (163, 25): on a's right handle, where the drag starts.
    expect(connectionRole(state({ x: 336, y: 70 }), 'a')).toBe('source');
  });

  it('leaves other nodes alone', () => {
    expect(connectionRole(state({ x: 5000, y: 5000 }), 'b')).toBeNull();
  });
});
