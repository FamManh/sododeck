/**
 * Applying a changed deck file to an open deck (066): the document becomes equal to the file, in
 * place, writing only what differs and matching by id at every level (collections, rules, child
 * lists, nested records, meta), in one transaction with the caller's untracked origin. An invalid
 * file is refused with the import problem entries and the document is not touched.
 *
 * The target is the file as the document would read it after a load: the prepared file is built
 * into a throwaway document and read back with `toJSON`, so every load normalisation (empty style,
 * empty `values`, pack order, dropped `source`, picture facts…) is the reader's own, never a copy
 * of it. The open document is compared with that target through the same reader, and written
 * through `write.ts` / `apply-records.ts`, which know the layout.
 */
import type { DbEnum, FieldDef, Id, Rule, SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { reconcileOrder } from './apply-lists';
import { applyFields, mergeRecord, replaceArray } from './apply-records';
import { SummaryBuilder, type ApplyResult } from './apply-types';
import { metaOf } from './assets';
import { isRecord, jsonEqual, toY, type YObject, type YValue } from './convert';
import { buildDoc, isPreparedDeck, prepareDeck, toJSON, type PreparedDeck } from './deck';
import { DeckValidationError } from './errors';
import { newerVersion, parseDeckText, refusalEntries } from './import-check';
import {
  assetsMap,
  childList,
  collectionMap,
  COLLECTIONS,
  metaMap,
  rulesMap,
  TABLE_LISTS,
  type Collection,
  type DeckDoc,
  type ListMap,
} from './layout';
import { editorOrigins } from './ops/context';
import { blankKey } from './text';
import type { TextKind } from './text-fields';
import {
  createEnum,
  createField,
  createObject,
  createOption,
  createRow,
  createRule,
  type ObjectKind,
} from './write';

type Plain = Record<string, unknown>;

/** Root keys that are not deck metadata. */
const NOT_META = new Set<string>([...COLLECTIONS, 'rules', 'assets']);

/** Meta maps that are always stored (even empty) so two tabs share them (020, 033, 041, 042). */
const SHARED_MAPS = ['tagColors', 'tableDisplay', 'relationshipDisplay', 'canvasBackground'];

/** Meta keys stored as `Y.Map<id, true>` and read back as a list of ids (030, 032). */
const ID_SETS = ['packs', 'fieldDefaults'];

const records = (value: unknown): Plain[] => (Array.isArray(value) ? value.filter(isRecord) : []);

function byId(items: readonly Plain[]): Map<Id, Plain> {
  return new Map(items.map((item) => [item.id as Id, item]));
}

/** The child list `field` of `owner`, created empty when missing. */
function ensureList(owner: YObject, field: string): ListMap {
  const existing = childList(owner, field);
  if (existing !== undefined) return existing;
  owner.set(field, new Y.Map<YObject>() as unknown as YValue);
  return childList(owner, field) as ListMap;
}

/**
 * Makes the child list `list` hold `next` (plain items with an id); kept items whose plain value
 * differs are passed to `update`.
 */
function applyList(
  list: ListMap,
  current: readonly Plain[],
  next: readonly Plain[],
  create: (item: Plain, order: string) => YObject,
  update: (map: YObject, current: Plain, next: Plain) => void,
): void {
  const currentById = byId(current);
  const nextById = byId(next);
  reconcileOrder(
    list,
    next.map((item) => item.id as Id),
    (id, order) => create(nextById.get(id) ?? { id }, order),
    (id, map) => {
      const was = currentById.get(id) ?? { id };
      const now = nextById.get(id) ?? { id };
      if (!jsonEqual(was, now)) update(map, was, now);
    },
  );
}

/** A child list of plain objects of `kind` (steps, branches, columns, table parts, enum values). */
function applyObjectList(list: ListMap, kind: ObjectKind, current: unknown, next: unknown): void {
  applyList(
    list,
    records(current),
    records(next),
    (item, order) => createObject(kind, item, order),
    (map, was, now) => {
      applyObject(kind, map, was, now);
    },
  );
}

/** Makes one stored object equal `next`: fields, then its child lists. */
function applyObject(kind: ObjectKind, map: YObject, current: Plain, next: Plain): void {
  applyFields(map, kind, current, next);
  if (kind === 'nodes') {
    for (const [field, itemKind] of Object.entries(TABLE_LISTS)) {
      if (jsonEqual(current[field], next[field])) continue;
      if (next[field] === undefined) map.delete(field);
      else applyObjectList(ensureList(map, field), itemKind, current[field], next[field]);
    }
  }
  if (kind === 'flows') {
    if (!jsonEqual(current.steps, next.steps)) {
      applyObjectList(ensureList(map, 'steps'), 'step', current.steps, next.steps);
    }
    if (!jsonEqual(current.branches, next.branches)) {
      applyObjectList(ensureList(map, 'branches'), 'branch', current.branches, next.branches);
      // A file's explicit `branches: []` is kept by its marker, as `createObject` does.
      const empty = Array.isArray(next.branches) && next.branches.length === 0;
      const marker = blankKey('branches');
      if (empty && map.get(marker) !== true) map.set(marker, true);
      if (!empty && map.has(marker)) map.delete(marker);
    }
  }
}

function applyCollection(
  doc: DeckDoc,
  c: Collection,
  current: readonly Plain[],
  next: readonly Plain[],
  summary: SummaryBuilder,
): void {
  const currentById = byId(current);
  const nextById = byId(next);
  const changed = new Set<Id>();
  const result = reconcileOrder(
    collectionMap(doc, c),
    next.map((item) => item.id as Id),
    (id, order) => createObject(c, nextById.get(id) ?? { id }, order),
    (id, map) => {
      const was = currentById.get(id) ?? { id };
      const now = nextById.get(id) ?? { id };
      if (jsonEqual(was, now)) return;
      changed.add(id);
      applyObject(c, map, was, now);
    },
  );
  for (const id of result.moved) changed.add(id);
  for (const _ of result.added) summary.added(c);
  for (const _ of result.removed) summary.removed(c);
  for (const _ of changed) summary.changed(c);
}

/** A rule row's cells keyed by column id, from `when` / `then` by the columns' order. */
function rowCells(row: Plain, inputs: readonly Id[], outputs: readonly Id[]): Plain {
  const when = Array.isArray(row.when) ? row.when : [];
  const then = Array.isArray(row.then) ? row.then : [];
  const cells: Plain = {};
  inputs.forEach((column, i) => {
    cells[column] = when[i] ?? '';
  });
  outputs.forEach((column, i) => {
    cells[column] = then[i] ?? '';
  });
  return cells;
}

/** Makes one stored rule equal `next`: fields, columns, then rows with their cells. */
function applyRule(map: YObject, current: Plain, next: Plain): void {
  applyFields(map, 'rule', current, next);
  applyObjectList(ensureList(map, 'inputs'), 'column', current.inputs, next.inputs);
  applyObjectList(ensureList(map, 'outputs'), 'column', current.outputs, next.outputs);
  const ids = (side: unknown) => records(side).map((column) => column.id as Id);
  const inputs = ids(next.inputs);
  const outputs = ids(next.outputs);
  // Cells are keyed by column id, so every kept row is merged even when its plain row is equal:
  // a column replaced by another at the same position keeps the values but changes the keys.
  const rows = ensureList(map, 'rows');
  const nextRows = byId(records(next.rows));
  reconcileOrder(
    rows,
    records(next.rows).map((row) => row.id as Id),
    (id, order) => {
      const row = nextRows.get(id);
      const cells = (side: unknown) => (Array.isArray(side) ? (side as string[]) : []);
      return createRow({ when: cells(row?.when), then: cells(row?.then) }, inputs, outputs, order);
    },
    (id, rowMap) => {
      const cells = rowCells(nextRows.get(id) ?? {}, inputs, outputs);
      const stored = rowMap.get('cells');
      if (stored instanceof Y.Map) mergeRecord(stored, cells);
      else rowMap.set('cells', toY(cells));
    },
  );
}

function applyRules(
  doc: DeckDoc,
  current: SododeckFile['rules'],
  next: SododeckFile['rules'],
  summary: SummaryBuilder,
): void {
  const changed = new Set<Id>();
  const result = reconcileOrder(
    rulesMap(doc),
    Object.keys(next),
    (id, order) => createRule(next[id] as Rule, order),
    (id, map) => {
      const was = current[id] as unknown as Plain;
      const now = next[id] as unknown as Plain;
      if (jsonEqual(was, now)) return;
      changed.add(id);
      applyRule(map, was, now);
    },
  );
  for (const id of result.moved) changed.add(id);
  for (const _ of result.added) summary.added('rules');
  for (const _ of result.removed) summary.removed('rules');
  for (const _ of changed) summary.changed('rules');
}

/** Makes `meta.fields` hold the file's field definitions, each with its options (032). */
function applyFieldDefs(list: ListMap, current: unknown, next: unknown): void {
  applyList(
    list,
    records(current),
    records(next),
    (item, order) => createField(item as unknown as FieldDef, order),
    (map, was, now) => {
      const { options: wasOptions, ...wasRest } = was;
      const { options: nowOptions, ...nowRest } = now;
      applyFields(map, null, wasRest, nowRest);
      if (jsonEqual(wasOptions, nowOptions)) return;
      if (nowOptions === undefined) {
        map.delete('options');
        return;
      }
      applyList(
        ensureList(map, 'options'),
        records(wasOptions),
        records(nowOptions),
        (option, order) => createOption(option as never, order),
        (optionMap, wasOption, nowOption) => applyFields(optionMap, null, wasOption, nowOption),
      );
    },
  );
}

/** Makes `meta.enums` hold the file's enums, each with its values (040). */
function applyEnums(list: ListMap, current: unknown, next: unknown): void {
  applyList(
    list,
    records(current),
    records(next),
    (item, order) => createEnum(item as unknown as DbEnum, order),
    (map, was, now) => {
      const { values: wasValues, ...wasRest } = was;
      const { values: nowValues, ...nowRest } = now;
      applyFields(map, null, wasRest, nowRest);
      if (!jsonEqual(wasValues, nowValues)) {
        applyObjectList(ensureList(map, 'values'), 'enumValue', wasValues, nowValues);
      }
    },
  );
}

/** The list stored at meta key `key`, created empty when missing. */
function metaList(doc: DeckDoc, key: string): ListMap {
  return ensureList(metaMap(doc), key);
}

/** Makes the deck metadata equal the file's (scalars, text, swatches, maps, lists). */
function applyMeta(doc: DeckDoc, current: Plain, next: Plain, summary: SummaryBuilder): void {
  const pick = (file: Plain) =>
    Object.fromEntries(Object.entries(file).filter(([key]) => !NOT_META.has(key)));
  const was = pick(current);
  const now = pick(next);
  if (!jsonEqual(was, now) || !jsonEqual(current.assets, next.assets)) summary.changed('meta');
  if (jsonEqual(was, now)) return;

  const meta = metaMap(doc);
  const special = new Set(['swatches', 'fields', 'enums', ...SHARED_MAPS, ...ID_SETS]);
  const plainOf = (file: Plain) =>
    Object.fromEntries(Object.entries(file).filter(([key]) => !special.has(key)));
  applyFields(meta, 'meta' satisfies TextKind, plainOf(was), plainOf(now));

  if (!jsonEqual(was.swatches, now.swatches)) {
    const swatches = meta.get('swatches');
    const values = Array.isArray(now.swatches) ? now.swatches : [];
    if (swatches instanceof Y.Array) replaceArray(swatches, values);
    else meta.set('swatches', toY(values));
  }
  for (const key of SHARED_MAPS) {
    if (jsonEqual(was[key], now[key])) continue;
    const value = isRecord(now[key]) ? now[key] : {};
    const stored = meta.get(key);
    if (stored instanceof Y.Map) mergeRecord(stored, value);
    else meta.set(key, toY(value));
  }
  for (const key of ID_SETS) {
    if (jsonEqual(was[key], now[key])) continue;
    const ids = now[key];
    if (!Array.isArray(ids)) {
      meta.delete(key);
      continue;
    }
    const value = Object.fromEntries(ids.map((id) => [String(id), true]));
    const stored = meta.get(key);
    if (stored instanceof Y.Map) mergeRecord(stored, value);
    else meta.set(key, toY(value));
  }
  if (!jsonEqual(was.fields, now.fields)) {
    if (now.fields === undefined) meta.delete('fields');
    else applyFieldDefs(metaList(doc, 'fields'), was.fields, now.fields);
  }
  if (!jsonEqual(was.enums, now.enums)) {
    if (now.enums === undefined) meta.delete('enums');
    else applyEnums(metaList(doc, 'enums'), was.enums, now.enums);
  }
}

/**
 * Writes the facts of every picture the file lists into `meta.assets` (R8): a damaged picture as
 * its placeholder, a picture without bytes with its own facts. Entries are never removed, so an
 * undone image delete still finds its picture; `toJSON` emits only the pictures images use.
 */
function applyAssets(doc: DeckDoc, prepared: PreparedDeck): void {
  const assets = prepared.file.assets;
  if (assets === undefined || Object.keys(assets).length === 0) return;
  let stored = assetsMap(doc);
  if (stored === undefined) {
    metaMap(doc).set('assets', new Y.Map<YObject>() as unknown as YValue);
    stored = assetsMap(doc);
    if (stored === undefined) return;
  }
  for (const [id, asset] of Object.entries(assets)) {
    const facts = prepared.metas.get(id) ?? metaOf(asset);
    const existing = stored.get(id);
    if (existing instanceof Y.Map) mergeRecord(existing, facts);
    else stored.set(id, toY(facts) as YObject);
  }
}

function refuse(error: unknown, input: unknown): ApplyResult {
  if (!(error instanceof DeckValidationError)) throw error;
  return { status: 'refused', entries: refusalEntries(error, input) };
}

function checkOrigin(origin: object): void {
  if (editorOrigins.has(origin)) {
    throw new TypeError(
      'applyFile: an editor origin would make the applied change undoable; pass an origin of your own.',
    );
  }
}

/**
 * Applies a deck file (parsed JSON, or a `PreparedDeck`) to the open document (066 contract):
 * afterwards the document reads exactly as `loadDeck(input).doc` would. Writes only what differs,
 * in one transaction with `origin`, which must not be an editor origin (never undone, never an
 * undo step). Never throws for user input: an invalid file is refused and nothing is written.
 * Locks are ignored. Picture bytes come back in `bytes` for the caller's blob store.
 * @throws TypeError when `origin` is an editor origin.
 */
export function applyFile(doc: DeckDoc, input: unknown, origin: object): ApplyResult {
  checkOrigin(origin);
  let prepared: PreparedDeck;
  if (isPreparedDeck(input)) {
    prepared = input;
  } else {
    const version = newerVersion(input);
    if (version !== undefined) return { status: 'refused', entries: [version] };
    try {
      prepared = prepareDeck(input);
    } catch (error) {
      return refuse(error, input);
    }
  }

  const applied = {
    status: 'applied' as const,
    bytes: prepared.bytes,
    problems: prepared.problems,
    trimmedCrops: prepared.trimmedCrops,
  };
  const target = toJSON(buildDoc(prepared));
  const current = toJSON(doc);
  // The echo of a file the deck just wrote (R2): no transaction, so no event and no save.
  if (JSON.stringify(current) === JSON.stringify(target)) {
    return { ...applied, changed: false, summary: {} };
  }

  const summary = new SummaryBuilder();
  doc.transact(() => {
    applyMeta(doc, current as unknown as Plain, target as unknown as Plain, summary);
    for (const c of COLLECTIONS) {
      applyCollection(doc, c, records(current[c]), records(target[c]), summary);
    }
    applyRules(doc, current.rules, target.rules, summary);
    applyAssets(doc, prepared);
  }, origin);
  return { ...applied, changed: true, summary: summary.build() };
}

/**
 * `applyFile` from file text: a BOM is stripped, non-JSON is refused with one `invalid-json`
 * entry and a newer version with one `unsupported-version` entry, exactly as `inspectDeckText`.
 * @throws TypeError when `origin` is an editor origin.
 */
export function applyDeckText(doc: DeckDoc, text: string, origin: object): ApplyResult {
  checkOrigin(origin);
  const parsed = parseDeckText(text);
  if (!parsed.ok) return { status: 'refused', entries: parsed.entries };
  return applyFile(doc, parsed.input, origin);
}
