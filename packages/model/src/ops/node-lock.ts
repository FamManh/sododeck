/**
 * Lock (043 nodes, 053 stickies and connectors): `locked: true` pins an object. Only `true` is
 * valid in the file, so unlocking removes the key and a deck that never locks anything stays
 * byte-identical.
 *
 * Enforcement differs by precedent. A locked node is enforced by the app (043), so the model still
 * writes it. A locked sticky or connector is refused here too (`assertUnlocked`, code `locked`):
 * a note's move, size and pin, a connector's reconnect, route, style, label position and delete.
 * Text, colour, tags and a label stay editable, an end deleted under a locked connector still
 * removes it (the cascade does not go through `assertUnlocked`), and unlock always works.
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YObject } from '../convert';
import { DeckEditError } from '../errors';
import { collectionMap } from '../layout';
import { writeField } from '../write';
import type { EditContext } from './context';

/** Collections whose objects can be locked. */
export type LockCollection = 'nodes' | 'stickies' | 'edges' | 'images';

/** Whether an object is locked (absent means unlocked). */
export function isLocked(object: { locked?: true | undefined }): boolean {
  return object.locked === true;
}

/**
 * Locks or unlocks every listed object of `collection` in one transaction (one undo step).
 * Unknown ids are skipped, not refused: a selection may hold ids a remote edit just deleted.
 * Objects already as asked are left alone, and nothing changing writes nothing.
 */
export function setLocked(
  ctx: EditContext,
  collection: LockCollection,
  ids: readonly Id[],
  locked: boolean,
): void {
  const list = collectionMap(ctx.doc, collection);
  const maps: YObject[] = [];
  for (const id of new Set(ids)) {
    const map = list.get(id);
    if (map !== undefined && (map.get('locked') === true) !== locked) maps.push(map);
  }
  if (maps.length === 0) return;
  ctx.transact(() => {
    for (const map of maps) {
      if (locked) writeField(map, collection, 'locked', true);
      else map.delete('locked');
    }
  });
}

/** Throws `locked` when the object is locked. `what` finishes "…: unlock it to <what>". */
export function assertUnlocked(
  object: YObject | { locked?: true | undefined },
  label: string,
  id: Id,
  what: string,
): void {
  const locked = object instanceof Y.Map ? object.get('locked') === true : isLocked(object);
  if (!locked) return;
  throw new DeckEditError('locked', [
    { path: 'locked', message: `${label} "${id}" is locked: unlock it to ${what}.` },
  ]);
}
