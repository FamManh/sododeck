/**
 * RFC 6901 JSON Pointers for issue and problem paths (062 R2): unambiguous for any map key
 * (`tagColors`, `rules`, `assets` keys may hold dots, slashes or spaces) and resolvable by any
 * JSON tool. The root is `""`.
 */

/** Builds a pointer from path segments, escaping `~` as `~0` and `/` as `~1`. */
export function toPointer(segments: readonly (string | number | symbol)[]): string {
  let pointer = '';
  for (const segment of segments) {
    const text = typeof segment === 'symbol' ? (segment.description ?? '') : String(segment);
    pointer += `/${text.replaceAll('~', '~0').replaceAll('/', '~1')}`;
  }
  return pointer;
}

/** The segments of a pointer, unescaped. Array indexes stay strings. */
export function fromPointer(pointer: string): string[] {
  if (pointer === '') return [];
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
}

const INDEX = /^(0|[1-9][0-9]*)$/;

function compareSegments(a: string, b: string): number {
  const aIndex = INDEX.test(a);
  const bIndex = INDEX.test(b);
  if (aIndex && bIndex) return Number(a) - Number(b);
  if (aIndex !== bIndex) return aIndex ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Orders pointers by position in the file: segment by segment, array indexes numerically and
 * before keys, a parent before its children. Stable across runs (062 FR-006).
 */
export function comparePointers(a: string, b: string): number {
  if (a === b) return 0;
  const aSegments = a === '' ? [] : a.slice(1).split('/');
  const bSegments = b === '' ? [] : b.slice(1).split('/');
  const length = Math.min(aSegments.length, bSegments.length);
  for (let i = 0; i < length; i++) {
    const order = compareSegments(aSegments[i] ?? '', bSegments[i] ?? '');
    if (order !== 0) return order;
  }
  return aSegments.length - bSegments.length;
}
