import type { Id } from '@sododeck/schema';

import type { Selection } from '../state/ui-store';
import { COLLAPSED_NODE_PREFIX, GROUP_NODE_PREFIX } from './deck-to-flow';

/**
 * What Focus mode pins (051 R1): the one selected node, or the one selected group (its frame, or
 * its card when collapsed). Anything else pins nothing, and hover drives the focus instead.
 */
export function focusTargetId(selection: Selection, collapsed: ReadonlySet<Id>): string | null {
  const { nodes, groups } = selection;
  if (nodes.length === 1 && groups.length === 0) return nodes[0] ?? null;
  if (groups.length === 1 && nodes.length === 0) {
    const groupId = groups[0];
    if (groupId === undefined) return null;
    return collapsed.has(groupId)
      ? `${COLLAPSED_NODE_PREFIX}${groupId}`
      : `${GROUP_NODE_PREFIX}${groupId}`;
  }
  return null;
}
