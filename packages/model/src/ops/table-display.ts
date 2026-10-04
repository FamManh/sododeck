/**
 * The deck's table display (041, research R4): deck detail and the four hide flags in
 * `meta.tableDisplay`; and the relationship display (042): `hideEnds`, `labels` and `notation` in
 * `meta.relationshipDisplay`. Each key is written on its own, so two tabs changing different
 * switches both keep theirs. A flag is stored `true` or removed; a default is the absent key.
 */
import { jsonSchema, type RelationshipDisplay, type TableDisplay } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YValue } from '../convert';
import { DeckEditError } from '../errors';
import { metaMap, relationshipDisplayMap, tableDisplayMap } from '../layout';
import { assertValid, validateObject } from '../validate';
import type { EditContext } from './context';
import type { Patch } from './types';

type DisplayKey = 'tableDisplay' | 'relationshipDisplay';

const KEYS: Record<DisplayKey, readonly string[]> = {
  tableDisplay: Object.keys(jsonSchema.$defs.TableDisplay.properties),
  relationshipDisplay: Object.keys(jsonSchema.$defs.RelationshipDisplay.properties),
};

const STORED: Record<DisplayKey, (ctx: EditContext) => Y.Map<YValue>> = {
  tableDisplay: (ctx) => tableDisplayMap(ctx.doc),
  relationshipDisplay: (ctx) => relationshipDisplayMap(ctx.doc),
};

/** The map, attached on the first write of a document stored before it existed (041 / 042). */
function attached(ctx: EditContext, name: DisplayKey): Y.Map<YValue> {
  const meta = metaMap(ctx.doc);
  if (!(meta.get(name) instanceof Y.Map)) meta.set(name, new Y.Map<YValue>());
  return STORED[name](ctx);
}

/**
 * Patches one display map in one undo step: a value sets a key; `null` and `false` leave it
 * absent (`undefined` leaves it untouched). Validated before anything is written.
 */
function setDisplay(ctx: EditContext, name: DisplayKey, patch: object): void {
  const stored = STORED[name](ctx);
  const writes = new Map<string, YValue | undefined>();
  // Read as unknown: callers outside TypeScript may pass `undefined` (untouched).
  for (const [key, value] of Object.entries(patch) as [string, unknown][]) {
    if (value === undefined) continue;
    writes.set(key, value === null || value === false ? undefined : (value as YValue));
  }
  const unknown = [...writes.keys()].filter((key) => !KEYS[name].includes(key));
  if (unknown.length > 0) {
    throw new DeckEditError(
      'invalid',
      unknown.map((key) => ({ path: `${name}.${key}`, message: `Unknown key "${key}".` })),
    );
  }
  const candidate: Record<string, unknown> = {};
  for (const [key, value] of writes) if (value !== undefined) candidate[key] = value;
  assertValid(validateObject('meta', { [name]: candidate }));
  const changed = [...writes].filter(([key, value]) => stored.get(key) !== value);
  if (changed.length === 0) return;
  ctx.transact(() => {
    const map = attached(ctx, name);
    for (const [key, value] of changed) {
      if (value === undefined) map.delete(key);
      else map.set(key, value);
    }
  }, name);
}

/**
 * Patches the table display (041) in one undo step: a value sets a key; `null`, `false` on a hide
 * flag, and `undefined` leave it absent (`undefined` leaves it untouched). Validated first.
 */
export function setTableDisplay(ctx: EditContext, patch: Patch<TableDisplay>): void {
  setDisplay(ctx, 'tableDisplay', patch);
}

/**
 * Patches the relationship display (042) in one undo step: a value sets a key; `null`, and `false`
 * on `hideEnds`, remove it (Follow labels, crow's foot, ends shown). The object leaves the file
 * when it has no key. Validated first; nothing happens when nothing changes.
 */
export function setRelationshipDisplay(ctx: EditContext, patch: Patch<RelationshipDisplay>): void {
  setDisplay(ctx, 'relationshipDisplay', patch);
}
