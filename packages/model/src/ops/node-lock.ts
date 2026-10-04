/**
 * Node lock (043 research R11): `node.locked` pins a node against moves, resizes, edits and
 * deletes, which the app enforces. Only `true` is valid in the file, so unlocking removes the key
 * and a deck that never locks anything stays byte-identical.
 */
import type { Id, Node } from '@sododeck/schema';

import type { YObject } from '../convert';
import { collectionMap } from '../layout';
import { writeField } from '../write';
import type { EditContext } from './context';

/** Whether a node is locked (absent means unlocked). */
export function isLocked(node: Pick<Node, 'locked'>): boolean {
  return node.locked === true;
}

/**
 * Locks or unlocks every listed node in one transaction (one undo step). Unknown ids are skipped,
 * not refused: a selection may hold ids a remote edit just deleted. Nodes already as asked are
 * left alone, and nothing changing writes nothing.
 */
export function setLocked(ctx: EditContext, nodeIds: readonly Id[], locked: boolean): void {
  const list = collectionMap(ctx.doc, 'nodes');
  const maps: YObject[] = [];
  for (const id of new Set(nodeIds)) {
    const map = list.get(id);
    if (map !== undefined && (map.get('locked') === true) !== locked) maps.push(map);
  }
  if (maps.length === 0) return;
  ctx.transact(() => {
    for (const map of maps) {
      if (locked) writeField(map, 'nodes', 'locked', true);
      else map.delete('locked');
    }
  });
}
