/**
 * The one reader of deck objects (036 research R8): turns the stored maps of layout 2 (deck.ts)
 * into plain objects. Skips internal `$…` keys, reads long text as strings, orders child lists and
 * rebuilds rule rows' `when` / `then` from their keyed cells. Results are not in canonical key
 * order; callers canonicalize as before. Ops never call `fromY` on a deck object.
 */
import type { DbEnum, FieldDef, Id, Rule, RuleRow, SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { sortPacks, sortTypes } from './card-types';
import { compareTags } from './tags';
import { fromY, type YObject } from './convert';
import {
  childList,
  collectionMap,
  assetsMap,
  enumsList,
  fieldDefaultsMap,
  fieldsList,
  isInternalKey,
  isTableList,
  metaMap,
  orderedEntries,
  packsMap,
  rulesMap,
  swatchesArray,
  TABLE_LISTS,
  relationshipDisplayMap,
  canvasBackgroundMap,
  tableDisplayMap,
  tagColorsMap,
  type Collection,
  type DeckDoc,
  type ObjectOf,
} from './layout';
import { blankKey, readText, VALUE_PREFIX } from './text';
import { isRequiredText, isTextField, type TextKind } from './text-fields';
import type { ObjectKind } from './write';

/** Reads the fields of a stored map, the id included. */
function readStoredFields(kind: TextKind, map: YObject, out: Record<string, unknown>): void {
  let values: Record<string, unknown> | undefined;
  for (const [key, value] of map.entries()) {
    if (kind === 'nodes' && key.startsWith(VALUE_PREFIX)) {
      values ??= {};
      values[key.slice(VALUE_PREFIX.length)] = fromY(value);
      continue;
    }
    if (isInternalKey(key) || (kind === 'flows' && (key === 'steps' || key === 'branches'))) {
      continue;
    }
    // A table's child lists (040) are read in order by `readObject`.
    if (kind === 'nodes' && isTableList(key) && value instanceof Y.Map) continue;
    if (isTextField(kind, key)) {
      const text = readText(map as Y.Map<unknown>, key, isRequiredText(kind, key));
      if (text !== undefined) out[key] = text;
      continue;
    }
    // Two clients clearing one channel each leave an empty style: no style at all (R9).
    if (key === 'style' && value instanceof Y.Map && value.size === 0) continue;

    out[key] = fromY(value);
  }
  // Typed values (032) live in one `$value:<field>` key each; key order is set by key-order.ts.
  if (values !== undefined) out.values = values;
  // A long text field whose Y.Text is missing still reads by the text rule.
  if (kind === 'stickies' && out.text === undefined) out.text = '';
}

/**
 * The pictures the deck stores, as file `assets` entries without bytes (`data` is `''`: the bytes
 * are not in the document, `attachAssets` fills them on write). Sorted by picture id so every
 * replica reads the same deck, and limited to the pictures an image uses (an entry no image uses
 * is dropped on save, rule I2). Undefined when there is none.
 */
export function readAssets(
  doc: DeckDoc,
  images: readonly { asset: string }[],
): SododeckFile['assets'] {
  const stored = assetsMap(doc);
  if (stored === undefined || images.length === 0) return undefined;
  const used = new Set(images.map((image) => image.asset));
  const out: NonNullable<SododeckFile['assets']> = {};
  for (const id of [...stored.keys()].sort()) {
    const map = stored.get(id);
    if (map === undefined || !used.has(id)) continue;
    const plain = fromY(map) as Record<string, unknown>;
    out[id] = { ...plain, data: '' } as unknown as NonNullable<SododeckFile['assets']>[string];
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/** One stored field definition as plain data (its options in order). */
export function readField(id: Id, map: YObject): FieldDef {
  const out: Record<string, unknown> = { id };
  for (const [key, value] of map.entries()) {
    if (isInternalKey(key) || key === 'options') continue;
    out[key] = fromY(value);
  }
  const options = childList(map, 'options');
  if (options !== undefined) {
    out.options = orderedEntries(options).map(([optionId, option]) => {
      const plain: Record<string, unknown> = { id: optionId };
      for (const [key, value] of option.entries()) {
        if (!isInternalKey(key)) plain[key] = fromY(value);
      }
      return plain;
    });
  }
  return out as unknown as FieldDef;
}

/** The deck's field definitions in order, or undefined when the deck stores none (032). */
export function readFields(doc: DeckDoc): FieldDef[] | undefined {
  const list = fieldsList(doc);
  return list === undefined ? undefined : orderedEntries(list).map(([id, m]) => readField(id, m));
}

/** Types whose defaults are materialised, in registry order, or undefined (032). */
export function readFieldDefaults(doc: DeckDoc): string[] | undefined {
  const map = fieldDefaultsMap(doc);
  return map === undefined ? undefined : sortTypes(map.keys());
}

function readList(kind: ObjectKind, list: Y.Map<YObject> | undefined): Record<string, unknown>[] {
  return list === undefined ? [] : orderedEntries(list).map(([id, m]) => readObject(kind, id, m));
}

/** A stored object of `kind` as plain data. */
export function readObject(kind: ObjectKind, id: Id, map: YObject): Record<string, unknown> {
  const out: Record<string, unknown> = { id };
  readStoredFields(kind, map, out);
  if (kind === 'nodes') {
    // Emitted whenever stored, even empty, so a sketch table's `columns: []` round-trips.
    for (const [field, itemKind] of Object.entries(TABLE_LISTS)) {
      const list = childList(map, field);
      if (list !== undefined) out[field] = readList(itemKind, list);
    }
  }
  if (kind === 'flows') {
    out.steps = readList('step', childList(map, 'steps'));
    const branches = readList('branch', childList(map, 'branches'));
    if (branches.length > 0 || map.get(blankKey('branches')) === true) out.branches = branches;
  }
  return out;
}

/** One stored database enum as plain data (its values in order, 040). */
export function readEnum(id: Id, map: YObject): DbEnum {
  const out: Record<string, unknown> = { id };
  for (const [key, value] of map.entries()) {
    if (isInternalKey(key) || key === 'values') continue;
    out[key] = fromY(value);
  }
  out.values = readList('enumValue', childList(map, 'values'));
  return out as unknown as DbEnum;
}

/** The deck's enums in order, or undefined when the deck stores none (040). */
export function readEnums(doc: DeckDoc): DbEnum[] | undefined {
  const list = enumsList(doc);
  return list === undefined ? undefined : orderedEntries(list).map(([id, m]) => readEnum(id, m));
}

/** Column ids of one side of a stored rule, in order. */
export function columnIds(rule: YObject, side: 'inputs' | 'outputs'): Id[] {
  const list = childList(rule, side);
  return list === undefined ? [] : orderedEntries(list).map(([id]) => id);
}

/** A stored rule row as plain data: one cell per column, `''` where none is stored. */
export function readRow(
  id: Id,
  row: YObject,
  inputs: readonly Id[],
  outputs: readonly Id[],
): RuleRow {
  const cells = row.get('cells');
  const cell = (column: Id) => {
    const value = cells instanceof Y.Map ? cells.get(column) : undefined;
    return typeof value === 'string' ? value : '';
  };
  return { id, when: inputs.map(cell), then: outputs.map(cell) };
}

/** A stored rule as plain data (its id is the key in `rules`, not a field). */
export function readRule(map: YObject): Rule {
  const out: Record<string, unknown> = {};
  readStoredFields('rule', map, out);
  const inputs = columnIds(map, 'inputs');
  const outputs = columnIds(map, 'outputs');
  out.inputs = readList('column', childList(map, 'inputs'));
  out.outputs = readList('column', childList(map, 'outputs'));
  const rows = childList(map, 'rows');
  out.rows =
    rows === undefined
      ? []
      : orderedEntries(rows).map(([id, row]) => readRow(id, row, inputs, outputs));
  return out as unknown as Rule;
}

/** Every rule, in rule order (the same key order on every client). */
export function readRules(doc: DeckDoc): SododeckFile['rules'] {
  const out: SododeckFile['rules'] = {};
  for (const [id, rule] of orderedEntries(rulesMap(doc))) out[id] = readRule(rule);
  return out;
}

export function readCollection<C extends Collection>(doc: DeckDoc, c: C): ObjectOf<C>[] {
  return readList(c, collectionMap(doc, c)) as unknown as ObjectOf<C>[];
}

/** The deck's metadata fields as stored; optional ones absent when unset, `swatches` and `tagColors` omitted when empty. */
export function readMeta(doc: DeckDoc): Partial<SododeckFile> {
  const meta = metaMap(doc);
  const out: Record<string, unknown> = {
    $schema: meta.get('$schema'),
    version: meta.get('version'),
  };
  const name = meta.get('name');
  if (name !== undefined) out.name = name;
  const description = readText(meta as Y.Map<unknown>, 'description', false);
  if (description !== undefined) out.description = description;
  const tags = meta.get('tags');
  if (tags !== undefined) out.tags = fromY(tags);
  // `swatches` is always stored (possibly empty), but only ever emitted non-empty (020).
  const swatches = swatchesArray(doc).toArray();
  if (swatches.length > 0) out.swatches = swatches;
  // Same for `tagColors` (033): stored always, emitted only with entries. Sorted by tag key, not
  // in map order: after two tabs add entries concurrently each replica holds them in its own
  // arrival order, and every replica must read (and write out) the same deck (036 guarantee 1).
  const tagColors = tagColorsMap(doc);
  if (tagColors.size > 0) {
    out.tagColors = Object.fromEntries(
      [...tagColors.entries()].sort(([a], [b]) => compareTags(a, b)),
    );
  }
  // `packs` (030): emitted only when a pack choice is stored; known packs in registry order,
  // then unknown ids sorted, so every replica writes the same bytes.
  const packs = packsMap(doc);
  if (packs !== undefined && packs.size > 0) out.packs = sortPacks(packs.keys());
  // `fields` / `fieldDefaults` (032): emitted whenever stored (even empty), so a file round-trips
  // as written; created only by a file that has them or the first field definition change.
  const fields = readFields(doc);
  if (fields !== undefined) out.fields = fields;
  const fieldDefaults = readFieldDefaults(doc);
  if (fieldDefaults !== undefined) out.fieldDefaults = fieldDefaults;
  // `dialect` / `enums` (040): emitted whenever stored (`enums` even empty), like `fields`.
  const dialect = meta.get('dialect');
  if (dialect !== undefined) out.dialect = dialect;
  // `blockSqlExport` (052): stored only while on, so older decks stay unchanged.
  if (meta.get('blockSqlExport') === true) out.blockSqlExport = true;
  const enums = readEnums(doc);
  if (enums !== undefined) out.enums = enums;
  // `groupingMode` (048): emitted only when stored (By group is the absent key).
  const groupingMode = meta.get('groupingMode');
  if (groupingMode === 'schema') out.groupingMode = groupingMode;
  // `tableDisplay` (041): stored always, emitted only with entries, like `tagColors`.
  const tableDisplay = tableDisplayMap(doc);
  if (tableDisplay.size > 0) out.tableDisplay = fromY(tableDisplay);
  // `relationshipDisplay` (042): the same.
  const relationshipDisplay = relationshipDisplayMap(doc);
  if (relationshipDisplay.size > 0) out.relationshipDisplay = fromY(relationshipDisplay);
  // `canvasBackground` (ADR 0044): the same.
  const canvasBackground = canvasBackgroundMap(doc);
  if (canvasBackground.size > 0) out.canvasBackground = fromY(canvasBackground);
  return out;
}

/** How the deck groups its tables (048): By group unless `groupingMode: 'schema'` is stored. */
export type GroupingMode = 'group' | 'schema';

/** The grouping mode of a plain deck or a deck document; absent (or unreadable) is By group. */
export function groupingModeOf(deck: Pick<SododeckFile, 'groupingMode'> | DeckDoc): GroupingMode {
  const value = deck instanceof Y.Doc ? metaMap(deck).get('groupingMode') : deck.groupingMode;
  return value === 'schema' ? 'schema' : 'group';
}
