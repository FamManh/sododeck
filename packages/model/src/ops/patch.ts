import { DeckEditError } from '../errors';
import { isRecord, jsonEqual, toY, type YObject } from '../convert';
import * as Y from 'yjs';

/**
 * Applies `patch` to a copy of `current`: `null` deletes a key, `undefined` is ignored.
 * Returns the candidate object and the keys whose value actually changes.
 */
export function applyPatch(
  current: Record<string, unknown>,
  patch: object,
  forbidden: readonly string[],
): { candidate: Record<string, unknown>; changed: string[] } {
  const next = new Map(Object.entries(current));
  const changed: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === 'id' || forbidden.includes(key)) {
      throw new DeckEditError('invalid', [
        { path: key, message: `"${key}" cannot be changed with this operation.` },
      ]);
    }
    if (value === null) next.delete(key);
    else next.set(key, value);
    if (!jsonEqual(next.get(key), current[key])) changed.push(key);
  }
  return { candidate: Object.fromEntries(next), changed };
}

/** Writes the changed keys of a validated candidate into its Y.Map, field by field. */
export function writePatch(
  map: YObject,
  candidate: Record<string, unknown>,
  changed: readonly string[],
): void {
  for (const key of changed) {
    const value = candidate[key];
    const existing = map.get(key);
    if (value === undefined) {
      map.delete(key);
    } else if (key === 'position' && existing instanceof Y.Map && isRecord(value)) {
      // Keep the nested map so concurrent x and y edits merge (FR-004).
      for (const axis of ['x', 'y'] as const) {
        if (existing.get(axis) !== value[axis]) existing.set(axis, toY(value[axis]));
      }
    } else {
      map.set(key, toY(value));
    }
  }
}
