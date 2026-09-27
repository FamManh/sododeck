/**
 * Id generation (research R3): `<type prefix>-<10 random base-36 chars>`, e.g. `node-k3j9x0q2ab`.
 * The prefix is the object type, never its title. Generated ids are unique across the whole deck
 * (not only per collection), so a sticky anchor, which may name any object, is unambiguous.
 */
import type { Id } from '@sododeck/schema';
import * as Y from 'yjs';

import { collectionArray, COLLECTIONS, rulesMap, type DeckDoc } from './layout';

export type IdPrefix =
  | 'node'
  | 'group'
  | 'edge'
  | 'view'
  | 'feature'
  | 'flow'
  | 'step'
  | 'rule'
  | 'col'
  | 'row'
  | 'sticky';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const RANDOM_LENGTH = 10;
/** Enough retries that a collision streak means a broken generator, not bad luck. */
const MAX_ATTEMPTS = 100;

/** Default generator: crypto-random, available in browsers, Web Workers and Node. */
export function defaultNewId(prefix: string): Id {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
  let random = '';
  // 256 % 36 skews a few characters slightly; irrelevant for uniqueness at 36^10.
  for (const byte of bytes) random += ALPHABET.charAt(byte % ALPHABET.length);
  return `${prefix}-${random}`;
}

function arrayIds(value: unknown, visit: (id: string) => boolean): boolean {
  if (!(value instanceof Y.Array)) return false;
  for (const item of value as Y.Array<unknown>) {
    if (item instanceof Y.Map) {
      const id: unknown = item.get('id');
      if (typeof id === 'string' && visit(id)) return true;
    }
  }
  return false;
}

/**
 * Calls `visit` with every id in the deck: collection objects, steps, rules, rule columns and
 * rows. Stops early when `visit` returns true, and then returns true.
 */
export function forEachDeckId(doc: DeckDoc, visit: (id: string) => boolean): boolean {
  for (const c of COLLECTIONS) {
    for (const map of collectionArray(doc, c)) {
      const id = map.get('id');
      if (typeof id === 'string' && visit(id)) return true;
      if (c === 'flows' && arrayIds(map.get('steps'), visit)) return true;
    }
  }
  for (const [id, rule] of rulesMap(doc).entries()) {
    if (visit(id)) return true;
    for (const part of ['inputs', 'outputs', 'rows']) {
      if (arrayIds(rule.get(part), visit)) return true;
    }
  }
  return false;
}

export function deckHasId(doc: DeckDoc, id: Id): boolean {
  return forEachDeckId(doc, (existing) => existing === id);
}

/** Returns a function that generates ids that are not yet used anywhere in `doc`. */
export function makeIdAllocator(
  doc: DeckDoc,
  newId: (prefix: string) => Id,
): (prefix: IdPrefix, reserved?: ReadonlySet<Id>) => Id {
  // `reserved` holds ids allocated for objects that are not written yet (e.g. a rule's columns).
  return (prefix, reserved) => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const id = newId(prefix);
      if (reserved?.has(id) !== true && !deckHasId(doc, id)) return id;
    }
    throw new Error(
      `Could not generate a unique "${prefix}" id: the id generator keeps colliding.`,
    );
  };
}

/** Ids a sticky may anchor to: collection objects, steps and rules (not rule columns or rows). */
export function anchorableIds(doc: DeckDoc): Set<Id> {
  const ids = new Set<Id>();
  for (const c of COLLECTIONS) {
    for (const map of collectionArray(doc, c)) {
      const id = map.get('id');
      if (typeof id === 'string') ids.add(id);
      if (c === 'flows') arrayIds(map.get('steps'), (stepId) => (ids.add(stepId), false));
    }
  }
  for (const id of rulesMap(doc).keys()) ids.add(id);
  return ids;
}
