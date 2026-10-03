/**
 * The one writer of deck objects (036 research R8). Builds the stored maps of layout 2 (deck.ts)
 * from plain objects and writes single fields, so order keys, blank markers, long text and child
 * lists are handled in one place. Ops never call `toY` on a deck object.
 */
import type { Id, Rule } from '@sododeck/schema';
import * as Y from 'yjs';

import { isRecord, toY, type YObject, type YValue } from './convert';
import { ORDER_KEY, type ListMap } from './layout';
import { keysBetween } from './order-key';
import { blankKey, writeText } from './text';
import { isRequiredText, isTextField, TEXT_FIELDS, type TextKind } from './text-fields';

/** Kinds of stored objects with their own map (rules are built by `createRule`). */
export type ObjectKind = Exclude<TextKind, 'meta' | 'rule' | 'row'>;

function newList(): ListMap {
  return new Y.Map<YObject>();
}

/** Fills a new child list with `items` (plain objects with an `id`) in array order. */
function fillList(
  list: ListMap,
  kind: ObjectKind,
  items: readonly Record<string, unknown>[],
): void {
  const keys = keysBetween(null, null, items.length);
  items.forEach((item, i) => {
    list.set(item.id as Id, createObject(kind, item, keys[i] ?? ''));
  });
}

/** Writes the long text fields of `kind` into a new map: always present, marker for `""`. */
function createTexts(map: YObject, kind: TextKind, plain: Record<string, unknown>): void {
  for (const field of TEXT_FIELDS[kind]) {
    const value = plain[field];
    map.set(field, new Y.Text(typeof value === 'string' ? value : ''));
    if (value === '' && !isRequiredText(kind, field)) map.set(blankKey(field), true);
  }
}

/**
 * A new stored map for a plain object of `kind` (validated by the caller), not yet attached. The
 * id is the list key, so it is not stored inside. Flows get their `steps` and `branches` lists.
 */
export function createObject(
  kind: ObjectKind,
  plain: Record<string, unknown>,
  order: string,
): YObject {
  const map = new Y.Map<YValue>();
  map.set(ORDER_KEY, order);
  for (const [key, value] of Object.entries(plain)) {
    if (key === 'id' || value === undefined || isTextField(kind, key)) continue;
    if (kind === 'flows' && (key === 'steps' || key === 'branches')) continue;
    map.set(key, toY(value));
  }
  createTexts(map, kind, plain);
  if (kind === 'flows') {
    const steps = newList();
    const branches = newList();
    const records = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);
    fillList(steps, 'step', records(plain.steps));
    fillList(branches, 'branch', records(plain.branches));
    map.set('steps', steps as unknown as YValue);
    map.set('branches', branches as unknown as YValue);
    // A file's explicit `branches: []` is kept (an empty list otherwise reads as absent).
    if (Array.isArray(plain.branches) && plain.branches.length === 0) {
      map.set(blankKey('branches'), true);
    }
  }
  return map;
}

/** A new stored rule row: `cells` keyed by column id, built from `when` / `then` by position. */
export function createRow(
  row: { when: readonly string[]; then: readonly string[] },
  inputs: readonly Id[],
  outputs: readonly Id[],
  order: string,
): YObject {
  const map = new Y.Map<YValue>();
  map.set(ORDER_KEY, order);
  const cells = new Y.Map<YValue>();
  inputs.forEach((column, i) => {
    cells.set(column, row.when[i] ?? '');
  });
  outputs.forEach((column, i) => {
    cells.set(column, row.then[i] ?? '');
  });
  map.set('cells', cells);
  return map;
}

/** A new stored rule (decision table): columns and rows as ordered lists, cells keyed (R5). */
export function createRule(plain: Rule, order: string): YObject {
  const map = new Y.Map<YValue>();
  map.set(ORDER_KEY, order);
  for (const [key, value] of Object.entries(plain)) {
    if (value === undefined || isTextField('rule', key)) continue;
    if (key === 'inputs' || key === 'outputs' || key === 'rows') continue;
    map.set(key, toY(value));
  }
  createTexts(map, 'rule', plain as unknown as Record<string, unknown>);
  const inputs = newList();
  const outputs = newList();
  fillList(inputs, 'column', plain.inputs as unknown as Record<string, unknown>[]);
  fillList(outputs, 'column', plain.outputs as unknown as Record<string, unknown>[]);
  const rows = newList();
  const inputIds = plain.inputs.map((c) => c.id);
  const outputIds = plain.outputs.map((c) => c.id);
  const keys = keysBetween(null, null, plain.rows.length);
  plain.rows.forEach((row, i) => {
    rows.set(row.id, createRow(row, inputIds, outputIds, keys[i] ?? ''));
  });
  map.set('inputs', inputs as unknown as YValue);
  map.set('outputs', outputs as unknown as YValue);
  map.set('rows', rows as unknown as YValue);
  return map;
}

/**
 * Writes one field of a stored object (`undefined` removes it). Long text is spliced, keeping the
 * `Y.Text` (data-model "Long text"); `position` / `size` keep their nested map so concurrent axis
 * edits merge (FR-004); anything else is set as a whole. Call inside a transaction.
 */
export function writeField(map: YObject, kind: TextKind, key: string, value: unknown): void {
  if (isTextField(kind, key)) {
    let text = map.get(key);
    if (!(text instanceof Y.Text)) {
      text = new Y.Text();
      map.set(key, text);
    }
    writeText(text, typeof value === 'string' ? value : '');
    const blank = value === '' && !isRequiredText(kind, key);
    const marker = blankKey(key);
    if (blank && map.get(marker) !== true) map.set(marker, true);
    if (!blank && map.has(marker)) map.delete(marker);
    return;
  }
  const existing = map.get(key);
  if (value === undefined) {
    if (map.has(key)) map.delete(key);
  } else if (
    (key === 'position' || key === 'size') &&
    existing instanceof Y.Map &&
    isRecord(value)
  ) {
    for (const axis of Object.keys(value)) {
      if (existing.get(axis) !== value[axis]) existing.set(axis, toY(value[axis]));
    }
  } else {
    map.set(key, toY(value));
  }
}

/** Writes the changed keys of a validated candidate, field by field. */
export function writeFields(
  map: YObject,
  kind: TextKind,
  candidate: Record<string, unknown>,
  changed: readonly string[],
): void {
  for (const key of changed) writeField(map, kind, key, candidate[key]);
}
