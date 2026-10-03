import { DeckEditError } from '../errors';
import { jsonEqual } from '../convert';

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
