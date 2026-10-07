/**
 * Field writers for applying a file (066 research R4–R5): make one stored object, nested record or
 * array equal a plain value, writing only what differs, so an untouched key reports no change and
 * a concurrent edit of another key survives. Child lists are reconciled by `apply-lists.ts`.
 */
import * as Y from 'yjs';

import { fromY, isRecord, jsonEqual, toY, type YObject, type YValue } from './convert';
import { isTableList } from './layout';
import { blankKey } from './text';
import { isRequiredText, isTextField, type TextKind } from './text-fields';
import { writeValues } from './write';

/**
 * Makes a stored `Y.Map` record equal `plain`, key by key: equal keys untouched, missing keys
 * removed, a nested record merged into its nested map. Call inside a transaction.
 */
export function mergeRecord(map: Y.Map<YValue>, plain: Record<string, unknown>): void {
  for (const key of [...map.keys()]) {
    if (plain[key] === undefined) map.delete(key);
  }
  for (const [key, value] of Object.entries(plain)) {
    if (value === undefined) continue;
    const existing = map.get(key);
    if (existing instanceof Y.Map && isRecord(value)) {
      mergeRecord(existing, value);
    } else if (!jsonEqual(fromY(existing), value)) {
      map.set(key, toY(value));
    }
  }
}

/** Makes a stored `Y.Array` hold `values`, in place (the shared array is kept, 020 R3). */
export function replaceArray(array: Y.Array<YValue>, values: readonly unknown[]): void {
  if (jsonEqual(array.toArray().map(fromY), values)) return;
  array.delete(0, array.length);
  array.insert(0, values.map(toY));
}

/** Fields of `kind` that are child lists, written by the caller (never here). */
function isChildList(kind: TextKind | null, key: string): boolean {
  if (kind === 'nodes') return isTableList(key);
  if (kind === 'flows') return key === 'steps' || key === 'branches';
  if (kind === 'rule') return key === 'inputs' || key === 'outputs' || key === 'rows';
  return false;
}

/**
 * Writes the long text `value` as a fresh `Y.Text` (R4): a user's later undo of their own typing
 * then works on the detached old text, and the field keeps the file's whole value.
 */
function replaceText(map: YObject, kind: TextKind, key: string, value: unknown): void {
  map.set(key, new Y.Text(typeof value === 'string' ? value : ''));
  const blank = value === '' && !isRequiredText(kind, key);
  const marker = blankKey(key);
  if (blank && map.get(marker) !== true) map.set(marker, true);
  if (!blank && map.has(marker)) map.delete(marker);
}

/**
 * Makes the stored object `map` (read as `current`) hold the fields of `next`, writing only the
 * fields whose plain values differ. Skips the id and child lists. `kind` null is a plain record
 * with no long text (field definitions, options, enums). Call inside a transaction. Returns true
 * when a field was written.
 */
export function applyFields(
  map: YObject,
  kind: TextKind | null,
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  let wrote = false;
  for (const key of new Set([...Object.keys(current), ...Object.keys(next)])) {
    if (key === 'id' || isChildList(kind, key)) continue;
    const value = next[key];
    if (jsonEqual(current[key], value)) continue;
    wrote = true;
    if (kind !== null && isTextField(kind, key)) {
      replaceText(map, kind, key, value);
      continue;
    }
    if (kind === 'nodes' && key === 'values') {
      writeValues(map, value);
      continue;
    }
    const existing = map.get(key);
    if (value === undefined) map.delete(key);
    else if (existing instanceof Y.Map && isRecord(value)) mergeRecord(existing, value);
    else map.set(key, toY(value));
  }
  return wrote;
}
