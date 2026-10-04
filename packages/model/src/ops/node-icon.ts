/**
 * The icon a node shows instead of its type's (038, ADR 0028). A plain `set:icon` text, stored as
 * given: the model never reads it, so a reference to an icon this version cannot show survives.
 */
import type { Id } from '@sododeck/schema';

import type { YObject } from '../convert';
import { collectionMap } from '../layout';
import { readObject } from '../read';
import { assertValid, validateObject } from '../validate';
import { writeField } from '../write';
import { requireEntry, type EditContext } from './context';

/**
 * Sets the icon of every listed node in one transaction (one undo step); `null` removes the key.
 * Validates every id and the value before any write; a node already at the value is left alone,
 * and nothing changing writes nothing. Any non-empty text is valid (the app writes `lucide:<name>`).
 */
export function setNodeIcon(ctx: EditContext, nodeIds: readonly Id[], icon: string | null): void {
  const list = collectionMap(ctx.doc, 'nodes');
  const writes: { map: YObject; next: string | undefined }[] = [];
  const next = icon ?? undefined;
  for (const id of nodeIds) {
    const map = requireEntry(list, id, 'Node');
    const current = readObject('nodes', id, map);
    if (next !== undefined) assertValid(validateObject('nodes', { ...current, icon: next }));
    if (current.icon !== next) writes.push({ map, next });
  }
  if (writes.length === 0) return;
  ctx.transact(() => {
    for (const { map, next: value } of writes) {
      if (value === undefined) map.delete('icon');
      else writeField(map, 'nodes', 'icon', value);
    }
  });
}
