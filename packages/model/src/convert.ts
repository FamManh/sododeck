/** Plain JSON ↔ nested Yjs types. The layout itself is documented in `deck.ts`. */
import * as Y from 'yjs';

export type YValue = null | boolean | number | string | Y.Map<YValue> | Y.Array<YValue>;
export type YObject = Y.Map<YValue>;
export type YList = Y.Array<YValue>;

/** Converts validated JSON data into nested Y types: objects → Y.Map, arrays → Y.Array. */
export function toY(value: unknown): YValue {
  if (Array.isArray(value)) {
    const array = new Y.Array<YValue>();
    array.push(value.map(toY));
    return array;
  }
  if (value !== null && typeof value === 'object') {
    const map = new Y.Map<YValue>();
    for (const [key, child] of Object.entries(value)) {
      // Optional fields are absent when unset, never stored as undefined.
      if (child !== undefined) map.set(key, toY(child));
    }
    return map;
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  throw new TypeError(`Not a JSON value: ${typeof value}`);
}

/** Returns plain JSON data; callers cast it to the schema type the document was built from. */
export function fromY(value: unknown): unknown {
  if (value instanceof Y.Array) return value.toArray().map(fromY);
  if (value instanceof Y.Map) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of value.entries()) out[key] = fromY(child);
    return out;
  }
  return value;
}

/** Structural equality of plain JSON values (key order ignored). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => Object.hasOwn(b, k) && jsonEqual(a[k], b[k]))
    );
  }
  return false;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
