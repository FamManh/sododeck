import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTION, type Selection } from '../state/ui-store';
import { COLLAPSED_NODE_PREFIX, GROUP_NODE_PREFIX } from './deck-to-flow';
import { focusTargetId } from './focus-target';

const pick = (patch: Partial<Selection>): Selection => ({ ...EMPTY_SELECTION, ...patch });
const none = new Set<string>();

describe('focusTargetId (051)', () => {
  it('is the one selected node', () => {
    expect(focusTargetId(pick({ nodes: ['a'] }), none)).toBe('a');
  });

  it('is the group frame of one expanded group, or the card of a collapsed one', () => {
    expect(focusTargetId(pick({ groups: ['g'] }), none)).toBe(`${GROUP_NODE_PREFIX}g`);
    expect(focusTargetId(pick({ groups: ['g'] }), new Set(['g']))).toBe(
      `${COLLAPSED_NODE_PREFIX}g`,
    );
  });

  it('is null for nothing, two nodes, or a node with a group', () => {
    expect(focusTargetId(EMPTY_SELECTION, none)).toBeNull();
    expect(focusTargetId(pick({ nodes: ['a', 'b'] }), none)).toBeNull();
    expect(focusTargetId(pick({ nodes: ['a'], groups: ['g'] }), none)).toBeNull();
    expect(focusTargetId(pick({ groups: ['g', 'h'] }), none)).toBeNull();
  });
});
