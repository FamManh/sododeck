/**
 * Card style ops (020, research R2, ADR 0018). `style.fill` / `style.stroke` live in a nested
 * `Y.Map` on the node or group's own map, written key by key like `position`'s `x` / `y`
 * (`ops/frames.ts`), so two docs setting different channels concurrently both survive.
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import { toY, type YObject, type YValue } from '../convert';
import { collectionArray, indexOfId } from '../layout';
import { assertValid, validateObject } from '../validate';
import type { EditContext } from './context';

export type StyleChannel = 'fill' | 'stroke';

export interface StyleTargets {
  readonly nodes: readonly Id[];
  readonly groups: readonly Id[];
}

function writeChannel(map: YObject, channel: StyleChannel, value: string | null): void {
  const existing = map.get('style');
  if (value === null) {
    if (existing instanceof Y.Map) {
      existing.delete(channel);
      if (existing.size === 0) map.delete('style');
    }
    return;
  }
  if (existing instanceof Y.Map) {
    existing.set(channel, value);
    return;
  }
  const style = new Y.Map<YValue>();
  style.set(channel, toY(value));
  map.set('style', style);
}

/**
 * Sets or clears (`value === null`) one style channel on every target node and group, in one
 * transaction. Unknown ids are skipped; empty targets do nothing. Throws `DeckEditError('invalid')`
 * before any write when `value` is not a valid `ColorRef`.
 */
export function setStyle(
  ctx: EditContext,
  targets: StyleTargets,
  channel: StyleChannel,
  value: string | null,
): void {
  if (value !== null) assertValid(validateObject('style', { [channel]: value }));
  if (targets.nodes.length === 0 && targets.groups.length === 0) return;

  const collections: readonly ['nodes' | 'groups', readonly Id[]][] = [
    ['nodes', targets.nodes],
    ['groups', targets.groups],
  ];
  ctx.transact(() => {
    for (const [collection, ids] of collections) {
      const array = collectionArray(ctx.doc, collection);
      for (const id of ids) {
        const index = indexOfId(array, id);
        if (index !== -1) writeChannel(array.get(index), channel, value);
      }
    }
  });
}
