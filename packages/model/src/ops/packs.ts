/**
 * Which card-type packs are on for the deck (030, ADR 0025). Stored in `meta.packs`, a
 * `Y.Map<true>` keyed by pack id, so two tabs turning different packs on both keep their change.
 */
import * as Y from 'yjs';

import type { YValue } from '../convert';
import { LEGACY_PACKS } from '../card-types';
import { DeckEditError } from '../errors';
import { metaMap, packsMap } from '../layout';
import { assertValid, validateObject } from '../validate';
import type { EditContext } from './context';

/**
 * Turns a pack on or off as one undo step. A deck that stores no packs first gets `LEGACY_PACKS`
 * written, so "Architecture only" becomes explicit before the first change. Does nothing, and
 * writes no transaction, when the pack is already as asked. `invalid` (nothing written) for an id
 * that is not a pack id, or when it would turn off the last pack that is on.
 */
export function setPackOn(ctx: EditContext, packId: string, on: boolean): void {
  assertValid(validateObject('meta', { packs: [packId] }));
  const stored = packsMap(ctx.doc);
  const current = new Set<string>(stored === undefined ? LEGACY_PACKS : stored.keys());
  if (current.has(packId) === on) return;
  if (!on && current.size <= 1) {
    throw new DeckEditError('invalid', [{ path: 'packs', message: 'At least one pack stays on.' }]);
  }
  ctx.transact(() => {
    const meta = metaMap(ctx.doc);
    let map = packsMap(ctx.doc);
    if (map === undefined) {
      map = new Y.Map<YValue>();
      meta.set('packs', map);
      for (const id of LEGACY_PACKS) map.set(id, true);
    }
    if (on) map.set(packId, true);
    else map.delete(packId);
  });
}
