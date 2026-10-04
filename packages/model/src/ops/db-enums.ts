/**
 * Deck-level database operations (040, research R5, R6, R12): the dialect and the enums with
 * their values. Enums live in `meta.enums` (a layout-2 list created by the first enum, each enum
 * with a `values` list), so two tabs editing two values of one enum both keep their change. Each
 * op validates first and is one undo step. Removing an enum or a value is in `cascade.ts`.
 */
import type { DbEnum, DbEnumValue, Dialect, Id, Issue } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YObject, YValue } from '../convert';
import { DeckEditError } from '../errors';
import { dbPartIds } from '../ids';
import {
  childList,
  enumsList,
  insertAt,
  metaMap,
  planMove,
  type DeckDoc,
  type ListMap,
} from '../layout';
import { readEnum, readObject } from '../read';
import { assertValid, validateObject } from '../validate';
import { createEnum, createList, createObject, writeFields } from '../write';
import { requireEntry, type EditContext } from './context';
import { applyPatch } from './patch';
import type { Patch } from './types';

export type NewDbEnumValue = Omit<DbEnumValue, 'id'> & { id?: Id };
/** A new enum: values are optional (none by default) and may come without ids. */
export type NewDbEnum = Omit<DbEnum, 'id' | 'values'> & { id?: Id; values?: NewDbEnumValue[] };
export type EnumPatch = Patch<Pick<DbEnum, 'name' | 'schema' | 'note' | 'color'>>;
export type EnumValuePatch = Patch<DbEnumValue>;

/** Sets the dialect; `null` or `generic` removes the key (absent reads as Generic). */
export function setDialect(ctx: EditContext, dialect: Dialect | null): void {
  const meta = metaMap(ctx.doc);
  const next = dialect === null || dialect === 'generic' ? undefined : dialect;
  if (next !== undefined) assertValid(validateObject('meta', { dialect: next }));
  if (meta.get('dialect') === next) return;
  ctx.transact(() => {
    if (next === undefined) meta.delete('dialect');
    else meta.set('dialect', next);
  });
}

/** `meta.enums`, created on the first enum. Call inside a transaction. */
function attachedEnums(ctx: EditContext): ListMap {
  const existing = enumsList(ctx.doc);
  if (existing !== undefined) return existing;
  const list = new Y.Map<YObject>();
  metaMap(ctx.doc).set('enums', list as unknown as YValue);
  return list;
}

/** The stored enum `id`, or throws `not-found`. */
export function requireEnum(doc: DeckDoc, id: Id): YObject {
  const item = enumsList(doc)?.get(id);
  if (item === undefined) {
    throw new DeckEditError('not-found', [{ path: '', message: `Enum "${id}" does not exist.` }]);
  }
  return item;
}

/** An enum's values list (always created with the enum; rebuilt if a document lacks it). */
function valuesOf(item: YObject): ListMap {
  const existing = childList(item, 'values');
  if (existing !== undefined) return existing;
  const list = createList('enumValue', []);
  item.set('values', list as unknown as YValue);
  return list;
}

/** Refuses explicit ids already used by a database part, or repeated in the same insert. */
function assertFreeIds(doc: DeckDoc, ids: readonly { path: string; id: Id }[]): void {
  if (ids.length === 0) return;
  const taken = dbPartIds(doc);
  const issues: Issue[] = [];
  for (const { path, id } of ids) {
    if (taken.has(id)) issues.push({ path, message: `Id "${id}" is already used in this deck.` });
    taken.add(id);
  }
  if (issues.length > 0) throw new DeckEditError('duplicate-id', issues);
}

/** Adds an enum at `index` of the deck's enums (default: last) and returns its id. */
export function addEnum(ctx: EditContext, data: NewDbEnum, index?: number): Id {
  const { id: explicitId, values = [], ...fields } = data;
  const id = explicitId ?? ctx.allocate('enum');
  const explicit = explicitId === undefined ? [] : [{ path: 'id', id }];
  const reserved = new Set<Id>([id]);
  const withIds = values.map((value, i) => {
    if (value.id !== undefined) explicit.push({ path: `values.${String(i)}.id`, id: value.id });
    const valueId = value.id ?? ctx.allocate('enumval', reserved);
    reserved.add(valueId);
    return { ...value, id: valueId };
  });
  const candidate: DbEnum = { ...fields, id, values: withIds };
  assertValid(validateObject('enum', candidate));
  assertFreeIds(ctx.doc, explicit);
  ctx.transact(() => {
    insertAt(attachedEnums(ctx), id, createEnum(candidate, ''), index);
  });
  ctx.reserve(explicit.map((e) => e.id));
  return id;
}

/** Renames an enum or sets its schema, note or chip colour (041) (`null` clears them). */
export function updateEnum(ctx: EditContext, id: Id, patch: EnumPatch): void {
  const item = requireEnum(ctx.doc, id);
  const current = readEnum(id, item) as unknown as Record<string, unknown>;
  const { candidate, changed } = applyPatch(current, patch, ['values']);
  if (changed.length === 0) return;
  assertValid(validateObject('enum', candidate));
  ctx.transact(() => {
    writeFields(item, 'enum', candidate, changed);
  }, `enum:${id}`);
}

/** Moves an enum to `toIndex` of the deck's enums (clamped). */
export function moveEnum(ctx: EditContext, id: Id, toIndex: number): void {
  requireEnum(ctx.doc, id);
  const list = enumsList(ctx.doc);
  const move = list === undefined ? undefined : planMove(list, id, toIndex);
  if (move !== undefined) ctx.transact(move);
}

/** Adds a value at `index` of an enum's values (default: last) and returns its id. */
export function addEnumValue(
  ctx: EditContext,
  enumId: Id,
  data: NewDbEnumValue,
  index?: number,
): Id {
  const item = requireEnum(ctx.doc, enumId);
  const { id: explicitId, ...fields } = data;
  const id = explicitId ?? ctx.allocate('enumval');
  const candidate: DbEnumValue = { ...fields, id };
  assertValid(validateObject('enumValue', candidate));
  assertFreeIds(ctx.doc, explicitId === undefined ? [] : [{ path: 'id', id }]);
  ctx.transact(() => {
    insertAt(valuesOf(item), id, createObject('enumValue', { ...candidate }, ''), index);
  });
  if (explicitId !== undefined) ctx.reserve([id]);
  return id;
}

/** The stored value `valueId` of an enum, or throws `not-found`. */
export function requireEnumValue(item: YObject, enumId: Id, valueId: Id): YObject {
  const values = childList(item, 'values');
  if (values === undefined) {
    throw new DeckEditError('not-found', [
      { path: '', message: `Value "${valueId}" of enum "${enumId}" does not exist.` },
    ]);
  }
  return requireEntry(values, valueId, `Value of enum "${enumId}"`);
}

/** Renames a value or sets its note (`null` clears it). Its id never changes. */
export function updateEnumValue(
  ctx: EditContext,
  enumId: Id,
  valueId: Id,
  patch: EnumValuePatch,
): void {
  const value = requireEnumValue(requireEnum(ctx.doc, enumId), enumId, valueId);
  const { candidate, changed } = applyPatch(readObject('enumValue', valueId, value), patch, []);
  if (changed.length === 0) return;
  assertValid(validateObject('enumValue', candidate));
  ctx.transact(() => {
    writeFields(value, 'enumValue', candidate, changed);
  }, `enumval:${enumId}:${valueId}`);
}

/** Moves a value to `toIndex` of its enum (clamped). */
export function moveEnumValue(ctx: EditContext, enumId: Id, valueId: Id, toIndex: number): void {
  const item = requireEnum(ctx.doc, enumId);
  requireEnumValue(item, enumId, valueId);
  const values = childList(item, 'values');
  const move = values === undefined ? undefined : planMove(values, valueId, toIndex);
  if (move !== undefined) ctx.transact(move);
}
