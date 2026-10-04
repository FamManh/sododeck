/**
 * The deck's table display (041, research R4): deck detail and the four hide flags in
 * `meta.tableDisplay`. Each key is written on its own, so two tabs changing different switches
 * both keep theirs. A hide flag is stored `true` or removed; Auto detail is the absent key.
 */
import { jsonSchema, type TableDisplay } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YValue } from '../convert';
import { DeckEditError } from '../errors';
import { metaMap, tableDisplayMap } from '../layout';
import { assertValid, validateObject } from '../validate';
import type { EditContext } from './context';
import type { Patch } from './types';

const KEYS: readonly string[] = Object.keys(jsonSchema.$defs.TableDisplay.properties);

/** `meta.tableDisplay`, attached on the first write of a document stored before 041. */
function attachedTableDisplay(ctx: EditContext): Y.Map<YValue> {
  const meta = metaMap(ctx.doc);
  if (!(meta.get('tableDisplay') instanceof Y.Map)) meta.set('tableDisplay', new Y.Map<YValue>());
  return tableDisplayMap(ctx.doc);
}

/**
 * Patches the table display in one undo step: a value sets a key; `null`, `false` on a hide flag,
 * and `undefined` leave it absent (`undefined` leaves it untouched). Validated first.
 */
export function setTableDisplay(ctx: EditContext, patch: Patch<TableDisplay>): void {
  const stored = tableDisplayMap(ctx.doc);
  const writes = new Map<string, YValue | undefined>();
  // Read as unknown: callers outside TypeScript may pass `undefined` (untouched).
  for (const [key, value] of Object.entries(patch) as [string, unknown][]) {
    if (value === undefined) continue;
    writes.set(key, value === null || value === false ? undefined : (value as YValue));
  }
  const unknown = [...writes.keys()].filter((key) => !KEYS.includes(key));
  if (unknown.length > 0) {
    throw new DeckEditError(
      'invalid',
      unknown.map((key) => ({ path: `tableDisplay.${key}`, message: `Unknown key "${key}".` })),
    );
  }
  const candidate: Record<string, unknown> = {};
  for (const [key, value] of writes) if (value !== undefined) candidate[key] = value;
  assertValid(validateObject('meta', { tableDisplay: candidate }));
  const changed = [...writes].filter(([key, value]) => stored.get(key) !== value);
  if (changed.length === 0) return;
  ctx.transact(() => {
    const map = attachedTableDisplay(ctx);
    for (const [key, value] of changed) {
      if (value === undefined) map.delete(key);
      else map.set(key, value);
    }
  }, 'tableDisplay');
}
