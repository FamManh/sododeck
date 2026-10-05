/**
 * Connector label position (022): `labelAt` is a fraction of the drawn line's length, stored as a
 * scalar on the edge. Never a coordinate, so the label follows cards and bends. 0.5 (the middle)
 * is the default and is not stored.
 */
import type { Id } from '@sododeck/schema';

import { collectionMap } from '../layout';
import { readObject } from '../read';
import { assertValid, validateObject } from '../validate';
import { requireEntry, type EditContext } from './context';
import { assertUnlocked } from './node-lock';

/** Stores `labelAt` (0 to 1); `null` or 0.5 removes it. One undo step, joining a gesture. */
export function setEdgeLabelAt(ctx: EditContext, edgeId: Id, at: number | null): void {
  const map = requireEntry(collectionMap(ctx.doc, 'edges'), edgeId, 'Edge');
  assertUnlocked(map, 'Connector', edgeId, 'move its label');
  const current = readObject('edges', edgeId, map);
  const next = at === null || at === 0.5 ? undefined : at;
  if (current.labelAt === next) return;
  const candidate = { ...current };
  if (next === undefined) delete candidate.labelAt;
  else candidate.labelAt = next;
  assertValid(validateObject('edges', candidate));
  ctx.transact(() => {
    if (next === undefined) map.delete('labelAt');
    else map.set('labelAt', next);
  }, `edges:${edgeId}:labelAt`);
}
