/**
 * Root types of the deck document and the list helpers every op uses. The layout is documented in
 * deck.ts (layout 2, ADR 0021): every list is a `Y.Map<id, Y.Map>` whose items carry an order key.
 */
import type { Id, SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YObject, YValue } from './convert';
import { compareKeys, keyBetween, keysBetween } from './order-key';

export type DeckDoc = Y.Doc;

/** Array collections, in canonical file order. */
export const ARRAY_COLLECTIONS = [
  'nodes',
  'groups',
  'edges',
  'views',
  'features',
  'flows',
] as const satisfies readonly (keyof SododeckFile)[];

/** Every id-keyed array collection of the file, stickies included. */
export const COLLECTIONS = [...ARRAY_COLLECTIONS, 'stickies'] as const;

export type Collection = (typeof COLLECTIONS)[number];
export type ObjectOf<C extends Collection> = SododeckFile[C][number];

/** Where an object lives: deck metadata, a collection, or the rules map. */
export type Scope = 'meta' | Collection | 'rules';

/** Identifies an object; `child` names a step or branch of a flow, or a column or row of a rule. */
export interface ObjectRef {
  scope: Scope;
  /** Object id (`''` for meta). */
  id: Id;
  child?: { kind: 'step' | 'branch' | 'column' | 'row'; id: Id };
}

/** A list stored by id: item id → item map. Read in order with `orderedEntries`. */
export type ListMap = Y.Map<YObject>;

/** Key of an item's fractional-index order key (research R3). */
export const ORDER_KEY = '$order';

/** Keys starting with `$` are internal (order key, blank markers): never output or reported. */
export function isInternalKey(key: string): boolean {
  return key.startsWith('$');
}

/** Root types, i.e. everything an editor's undo history covers. */
export function rootTypes(doc: DeckDoc): Y.AbstractType<unknown>[] {
  return [
    doc.getMap('meta'),
    ...COLLECTIONS.map((c) => doc.getMap(c)),
    doc.getMap('rules'),
  ] as Y.AbstractType<unknown>[];
}

export function metaMap(doc: DeckDoc): YObject {
  return doc.getMap<YValue>('meta');
}

/**
 * The deck's custom colour swatches (020, R3): always a `Y.Array`, created empty if a doc
 * predates it. Returns the shared type when present, so pushes from concurrent tabs merge.
 */
export function swatchesArray(doc: DeckDoc): Y.Array<YValue> {
  const existing = metaMap(doc).get('swatches');
  return existing instanceof Y.Array ? existing : new Y.Array<YValue>();
}

export function collectionMap(doc: DeckDoc, c: Collection): ListMap {
  return doc.getMap<YObject>(c);
}

export function rulesMap(doc: DeckDoc): ListMap {
  return doc.getMap<YObject>('rules');
}

/** A child list of an object (`steps`, `branches`, `inputs`, `outputs`, `rows`), if present. */
export function childList(owner: YObject, field: string): ListMap | undefined {
  const list = owner.get(field);
  return list instanceof Y.Map ? (list as unknown as ListMap) : undefined;
}

/** An item's order key; a missing or non-string one sorts first (`''`). */
export function orderOf(item: YObject): string {
  const key = item.get(ORDER_KEY);
  return typeof key === 'string' ? key : '';
}

/** Items sorted by (order key, id), the same on every client (ties broken by id, R3). */
export function orderedEntries(list: ListMap): [Id, YObject][] {
  const entries: [Id, YObject, string][] = [];
  for (const [id, item] of list.entries()) entries.push([id, item, orderOf(item)]);
  entries.sort((a, b) => compareKeys(a[2], b[2]) || compareKeys(a[0], b[0]));
  return entries.map(([id, item]) => [id, item]);
}

export function orderedIds(list: ListMap): Id[] {
  return orderedEntries(list).map(([id]) => id);
}

/**
 * The largest order key of each list, valid for one transaction: a batch of appends (paste, bulk
 * add) scans the list once instead of once per item. Nothing else can change the list inside a
 * transaction, as long as order keys are written through `setOrder` / `noteOrder`. A delete can
 * leave the cached key above the real largest key, which is harmless: it still sorts last.
 */
const lastKeys = new WeakMap<ListMap, { transaction: Y.Transaction; key: string | null }>();

function transactionOf(list: ListMap): Y.Transaction | null {
  return list.doc?._transaction ?? null;
}

/** Records that `key` was written into `list` (keeps its cached largest key right). */
export function noteOrder(list: ListMap, key: string): void {
  const cached = lastKeys.get(list);
  if (cached === undefined || cached.transaction !== transactionOf(list)) return;
  if (cached.key === null || key > cached.key) cached.key = key;
}

/** Sets an item's order key. Use this (not `set('$order')`) so cached largest keys stay right. */
export function setOrder(list: ListMap, item: YObject, key: string): void {
  item.set(ORDER_KEY, key);
  noteOrder(list, key);
}

/** The largest order key of a list, or null when it is empty or has no valid key. */
export function lastKey(list: ListMap): string | null {
  const transaction = transactionOf(list);
  const cached = lastKeys.get(list);
  if (transaction !== null && cached?.transaction === transaction) return cached.key;
  let last: string | null = null;
  for (const item of list.values()) {
    const key = orderOf(item);
    if (key !== '' && (last === null || key > last)) last = key;
  }
  if (transaction !== null) lastKeys.set(list, { transaction, key: last });
  return last;
}

/**
 * Order keys for a new item at `index` of `entries` (sorted, without the item), and the new keys
 * of a tied run it lands inside: when the neighbours share a key, the items after the insertion
 * point that share it are re-keyed too, so "between them" is honoured (R3). Throws when a
 * neighbour's key is malformed.
 */
function slotKeys(
  entries: readonly [Id, YObject][],
  index: number,
): { key: string; rekeyed: [YObject, string][] } {
  const before = entries[index - 1];
  const prev = before === undefined ? null : orderOf(before[1]);
  let end = index;
  while (prev !== null && end < entries.length) {
    const item = entries[end];
    if (item === undefined || orderOf(item[1]) !== prev) break;
    end++;
  }
  const after = entries[end];
  const next = after === undefined ? null : orderOf(after[1]);
  const keys = keysBetween(prev === '' ? null : prev, next, end - index + 1);
  const [key, ...rest] = keys;
  if (key === undefined) throw new Error('Order key: no key generated.');
  const rekeyed = entries
    .slice(index, end)
    .map(([, item], i): [YObject, string] => [item, rest[i] ?? key]);
  return { key, rekeyed };
}

/** Gives every item of `ordered` a fresh key in that order (fallback for a damaged list). */
function rekeyAll(list: ListMap, ordered: readonly YObject[]): void {
  const keys = keysBetween(null, null, ordered.length);
  lastKeys.delete(list);
  ordered.forEach((item, i) => {
    const key = keys[i];
    if (key !== undefined && orderOf(item) !== key) item.set(ORDER_KEY, key);
  });
}

const clampInsert = (index: number | undefined, length: number) =>
  index === undefined ? length : Math.max(0, Math.min(length, Math.trunc(index)));

/**
 * Adds `item` (a new, unattached map) under `id` at `index` of the ordered list (default: last,
 * clamped). Writes one order key, plus the keys of a tied run it lands inside. Call inside a
 * transaction.
 */
export function insertAt(list: ListMap, id: Id, item: YObject, index?: number): void {
  if (index === undefined) {
    // Appending needs only the largest key, not a sort.
    const last = lastKey(list);
    try {
      setOrder(list, item, keyBetween(last, null));
      list.set(id, item);
      return;
    } catch {
      // A malformed key: fall through to the general path, which re-keys the list.
    }
  }
  const entries = orderedEntries(list).filter(([existing]) => existing !== id);
  const at = clampInsert(index, entries.length);
  try {
    const { key, rekeyed } = slotKeys(entries, at);
    setOrder(list, item, key);
    list.set(id, item);
    for (const [other, otherKey] of rekeyed) setOrder(list, other, otherKey);
  } catch {
    list.set(id, item);
    const ordered = entries.map(([, other]) => other);
    ordered.splice(at, 0, item);
    rekeyAll(list, ordered);
  }
}

/** Appends new items in the given order with one scan for the last key. Inside a transaction. */
export function appendAll(list: ListMap, items: readonly (readonly [Id, YObject])[]): void {
  if (items.length === 0) return;
  let keys: string[];
  try {
    keys = keysBetween(lastKey(list), null, items.length);
  } catch {
    for (const [id, item] of items) insertAt(list, id, item);
    return;
  }
  items.forEach(([id, item], i) => {
    setOrder(list, item, keys[i] ?? '');
    list.set(id, item);
  });
}

/**
 * Plans moving item `id` to `toIndex` of the ordered list (clamped): one order key change, plus a
 * tied run's keys when it lands inside one. Returns the write to run in a transaction, or
 * undefined when the position does not change.
 */
export function planMove(list: ListMap, id: Id, toIndex: number): (() => void) | undefined {
  const entries = orderedEntries(list);
  const from = entries.findIndex(([existing]) => existing === id);
  const moved = entries[from];
  if (moved === undefined) return undefined;
  const to = Math.max(0, Math.min(entries.length - 1, Math.trunc(toIndex)));
  if (to === from) return undefined;
  const rest = entries.filter(([existing]) => existing !== id);
  return () => {
    try {
      const { key, rekeyed } = slotKeys(rest, to);
      setOrder(list, moved[1], key);
      for (const [other, otherKey] of rekeyed) setOrder(list, other, otherKey);
    } catch {
      const ordered = rest.map(([, other]) => other);
      ordered.splice(to, 0, moved[1]);
      rekeyAll(list, ordered);
    }
  };
}

/**
 * True when `doc` holds a deck in the layout used before 036 (layout 1), which this build cannot
 * read (R10): a collection root holding list items, a rule whose `inputs` is a `Y.Array`, or a
 * plain-string `meta.description`. Callers that build a document from stored bytes check this
 * before reading it.
 */
export function isLegacyLayout(doc: DeckDoc): boolean {
  if (typeof metaMap(doc).get('description') === 'string') return true;
  for (const c of COLLECTIONS) {
    // An old root was a Y.Array: its items live in the root's list, not its key map.
    const root = doc.share.get(c);
    if (root !== undefined && root._start !== null) return true;
  }
  for (const rule of rulesMap(doc).values()) {
    if (rule instanceof Y.Map && rule.get('inputs') instanceof Y.Array) return true;
  }
  return false;
}
