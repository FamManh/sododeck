/**
 * Fractional-index order keys (036 research R3). Every list item stores a string key; a list reads
 * sorted by (key, id) with plain code-unit comparison. A move or an insert writes one new key
 * between two neighbours, so it never touches the other items.
 *
 * Our own implementation of the well-known variable-length-integer scheme (the public-domain
 * algorithm behind `fractional-indexing`): a key is an integer head, whose first character encodes
 * its length, followed by an optional fraction with no trailing zero. Base 62, `0-9A-Za-z`, so the
 * alphabet is in code-unit order.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = 'a0';
/** The smallest integer part: no key may consist of it alone (nothing could go before it). */
const SMALLEST_INTEGER = `A${'0'.repeat(26)}`;
const LAST_DIGIT = DIGITS.charAt(DIGITS.length - 1);

/** Code-unit comparison, never `localeCompare` (which differs per locale and client). */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function fail(message: string): never {
  throw new Error(`Order key: ${message}`);
}

function digitOf(char: string | undefined): number {
  const digit = char === undefined ? -1 : DIGITS.indexOf(char);
  if (digit === -1) fail(`invalid digit "${String(char)}"`);
  return digit;
}

/** Length of the integer part announced by its head: `a`–`z` → 2–27, `Z`–`A` → 2–27. */
function integerLength(head: string | undefined): number {
  if (head !== undefined && head >= 'a' && head <= 'z') return head.charCodeAt(0) - 95;
  if (head !== undefined && head >= 'A' && head <= 'Z') return 92 - head.charCodeAt(0);
  return fail(`invalid head "${String(head)}"`);
}

function integerPart(key: string): string {
  const length = integerLength(key[0]);
  if (length > key.length) fail(`"${key}" is too short`);
  return key.slice(0, length);
}

function assertKey(key: string): void {
  if (key === SMALLEST_INTEGER) fail(`"${key}" is reserved`);
  const integer = integerPart(key);
  for (const char of key.slice(1)) digitOf(char);
  if (key.length > integer.length && key.endsWith('0')) fail(`"${key}" has a trailing zero`);
}

/** A fraction strictly between fractions `a` and `b` (`null` = 1). Neither ends in `0`. */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const low = a === '' ? 0 : digitOf(a[0]);
  const high = b === null ? DIGITS.length : digitOf(b[0]);
  if (high - low > 1) return DIGITS.charAt(Math.round((low + high) / 2));
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS.charAt(low) + midpoint(a.slice(1), null);
}

function incrementInteger(integer: string): string | null {
  const head = integer.charAt(0);
  const digits = integer.slice(1).split('');
  let carry = true;
  for (let i = digits.length - 1; carry && i >= 0; i--) {
    const next = digitOf(digits[i]) + 1;
    if (next === DIGITS.length) {
      digits[i] = '0';
    } else {
      digits[i] = DIGITS.charAt(next);
      carry = false;
    }
  }
  if (!carry) return head + digits.join('');
  if (head === 'Z') return ZERO;
  if (head === 'z') return null;
  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
  if (nextHead > 'a') digits.push('0');
  else digits.pop();
  return nextHead + digits.join('');
}

function decrementInteger(integer: string): string | null {
  const head = integer.charAt(0);
  const digits = integer.slice(1).split('');
  let borrow = true;
  for (let i = digits.length - 1; borrow && i >= 0; i--) {
    const next = digitOf(digits[i]) - 1;
    if (next === -1) {
      digits[i] = LAST_DIGIT;
    } else {
      digits[i] = DIGITS.charAt(next);
      borrow = false;
    }
  }
  if (!borrow) return head + digits.join('');
  if (head === 'a') return `Z${LAST_DIGIT}`;
  if (head === 'A') return null;
  const nextHead = String.fromCharCode(head.charCodeAt(0) - 1);
  if (nextHead < 'Z') digits.push(LAST_DIGIT);
  else digits.pop();
  return nextHead + digits.join('');
}

/**
 * A key strictly between `a` and `b`; `null` is an open end. Throws on malformed keys and when
 * `a >= b` (callers re-key the list then).
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) assertKey(a);
  if (b !== null) assertKey(b);
  if (a !== null && b !== null && a >= b) fail(`"${a}" is not before "${b}"`);
  if (a === null) {
    if (b === null) return ZERO;
    const integer = integerPart(b);
    if (integer === SMALLEST_INTEGER) return integer + midpoint('', b.slice(integer.length));
    if (integer < b) return integer;
    return decrementInteger(integer) ?? fail('cannot go before the smallest key');
  }
  const integerA = integerPart(a);
  const fractionA = a.slice(integerA.length);
  if (b === null) {
    return incrementInteger(integerA) ?? integerA + midpoint(fractionA, null);
  }
  const integerB = integerPart(b);
  if (integerA === integerB) return integerA + midpoint(fractionA, b.slice(integerB.length));
  const next = incrementInteger(integerA) ?? fail('cannot go past the largest key');
  return next < b ? next : integerA + midpoint(fractionA, null);
}

/** `n` strictly increasing keys between `a` and `b` (open ends as in `keyBetween`). */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) {
    if (a !== null && b !== null && a >= b) fail(`"${a}" is not before "${b}"`);
    return [];
  }
  if (n === 1) return [keyBetween(a, b)];
  if (b === null) {
    const keys: string[] = [];
    let last = a;
    for (let i = 0; i < n; i++) {
      last = keyBetween(last, null);
      keys.push(last);
    }
    return keys;
  }
  if (a === null) {
    const keys: string[] = [];
    let first: string = b;
    for (let i = 0; i < n; i++) {
      first = keyBetween(null, first);
      keys.push(first);
    }
    return keys.reverse();
  }
  const half = Math.floor(n / 2);
  const middle = keyBetween(a, b);
  return [...keysBetween(a, middle, half), middle, ...keysBetween(middle, b, n - half - 1)];
}
