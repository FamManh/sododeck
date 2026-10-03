/**
 * The one reader of deck objects (036 research R8): turns the stored maps of layout 2 (deck.ts)
 * into plain objects. Skips internal `$…` keys, reads long text as strings, orders child lists and
 * rebuilds rule rows' `when` / `then` from their keyed cells. Results are not in canonical key
 * order; callers canonicalize as before. Ops never call `fromY` on a deck object.
 */
import type { Id, Rule, RuleRow, SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { fromY, type YObject } from './convert';
import {
  childList,
  collectionMap,
  isInternalKey,
  metaMap,
  orderedEntries,
  rulesMap,
  swatchesArray,
  type Collection,
  type DeckDoc,
  type ObjectOf,
} from './layout';
import { blankKey, readText } from './text';
import { isRequiredText, isTextField, type TextKind } from './text-fields';
import type { ObjectKind } from './write';

/** Reads the fields of a stored map, the id included. */
function readFields(kind: TextKind, map: YObject, out: Record<string, unknown>): void {
  for (const [key, value] of map.entries()) {
    if (isInternalKey(key) || (kind === 'flows' && (key === 'steps' || key === 'branches'))) {
      continue;
    }
    if (isTextField(kind, key)) {
      const text = readText(map as Y.Map<unknown>, key, isRequiredText(kind, key));
      if (text !== undefined) out[key] = text;
      continue;
    }
    // Two clients clearing one channel each leave an empty style: no style at all (R9).
    if (key === 'style' && value instanceof Y.Map && value.size === 0) continue;
    out[key] = fromY(value);
  }
  // A long text field whose Y.Text is missing still reads by the text rule.
  if (kind === 'stickies' && out.text === undefined) out.text = '';
}

function readList(kind: ObjectKind, list: Y.Map<YObject> | undefined): Record<string, unknown>[] {
  return list === undefined ? [] : orderedEntries(list).map(([id, m]) => readObject(kind, id, m));
}

/** A stored object of `kind` as plain data. */
export function readObject(kind: ObjectKind, id: Id, map: YObject): Record<string, unknown> {
  const out: Record<string, unknown> = { id };
  readFields(kind, map, out);
  if (kind === 'flows') {
    out.steps = readList('step', childList(map, 'steps'));
    const branches = readList('branch', childList(map, 'branches'));
    if (branches.length > 0 || map.get(blankKey('branches')) === true) out.branches = branches;
  }
  return out;
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
  readFields('rule', map, out);
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

/** The deck's metadata fields as stored; optional ones absent when unset, `swatches` omitted when empty. */
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
  return out;
}
