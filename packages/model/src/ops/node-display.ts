/**
 * Card or shape form of a node (031 R4, ADR 0022 `node.display`). Stored only when it differs from
 * the type's own family, so a deck that never switches a form stays byte-identical.
 */
import type { Id, Node } from '@sododeck/schema';

import { cardType } from '../card-types';
import type { YObject } from '../convert';
import { collectionMap } from '../layout';
import { readObject } from '../read';
import { assertValid, validateObject } from '../validate';
import { writeField } from '../write';
import { requireEntry, type EditContext } from './context';

export type NodeDisplay = NonNullable<Node['display']>;

/**
 * Sets the form of every listed node in one transaction (one undo step). `null`, or the type's
 * own family, removes the key. Validates every id and the value before any write; a node already
 * as asked is left alone, and nothing changing writes nothing.
 */
export function setNodeDisplay(
  ctx: EditContext,
  nodeIds: readonly Id[],
  display: NodeDisplay | null,
): void {
  const list = collectionMap(ctx.doc, 'nodes');
  const writes: { map: YObject; next: NodeDisplay | undefined }[] = [];
  for (const id of nodeIds) {
    const map = requireEntry(list, id, 'Node');
    const current = readObject('nodes', id, map);
    const type = typeof current.type === 'string' ? cardType(current.type) : undefined;
    const family = type?.family ?? 'card';
    const next = display === null || display === family ? undefined : display;
    if (next !== undefined) assertValid(validateObject('nodes', { ...current, display: next }));
    if (current.display !== next) writes.push({ map, next });
  }
  if (writes.length === 0) return;
  ctx.transact(() => {
    for (const { map, next } of writes) {
      if (next === undefined) map.delete('display');
      else writeField(map, 'nodes', 'display', next);
    }
  });
}
