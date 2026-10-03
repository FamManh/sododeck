/**
 * Long text fields (036 research R7): stored as `Y.Text` so two people typing in one description
 * keep both texts. Writes are a minimal splice; reads return plain strings. The `$blank:<field>`
 * marker remembers a value given explicitly as `""`, so it round-trips while a cleared field stays
 * absent (data-model "Long text").
 */
import * as Y from 'yjs';

/** Prefix of the marker key that keeps an explicitly empty value, e.g. `$blank:description`. */
export const BLANK_PREFIX = '$blank:';

export const blankKey = (field: string) => `${BLANK_PREFIX}${field}`;

/**
 * Prefix of the node keys holding typed field values (032), e.g. `$value:task.status`. One key
 * per value, so two tabs setting the first values of one card both keep theirs (a nested map
 * created on both sides would keep only one). Read back as the node's `values` object.
 */
export const VALUE_PREFIX = '$value:';

export const valueKey = (fieldId: string) => `${VALUE_PREFIX}${fieldId}`;

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * Makes `text` equal `next` by deleting and inserting only the differing middle (common prefix and
 * suffix are kept), so a concurrent edit elsewhere in the text survives. Never splits a surrogate
 * pair. No-op when equal. Call inside a transaction.
 */
export function writeText(text: Y.Text, next: string): void {
  const current = text.toJSON();
  if (current === next) return;
  const shortest = Math.min(current.length, next.length);
  let prefix = 0;
  while (prefix < shortest && current.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix++;
  if (prefix > 0 && isHigh(current.charCodeAt(prefix - 1))) prefix--;
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    current.charCodeAt(current.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  ) {
    suffix++;
  }
  if (suffix > 0 && isLow(current.charCodeAt(current.length - suffix))) suffix--;
  const removed = current.length - prefix - suffix;
  if (removed > 0) text.delete(prefix, removed);
  const inserted = next.slice(prefix, next.length - suffix);
  if (inserted !== '') text.insert(prefix, inserted);
}

/**
 * Reads a long text field as a plain value: the characters; or, when empty, `""` for a required
 * field or one carrying the blank marker, else absent.
 */
export function readText(
  map: Y.Map<unknown>,
  field: string,
  required: boolean,
): string | undefined {
  const value = map.get(field);
  const text = value instanceof Y.Text ? value.toJSON() : typeof value === 'string' ? value : '';
  if (text !== '') return text;
  if (required || map.get(blankKey(field)) === true) return '';
  return undefined;
}
