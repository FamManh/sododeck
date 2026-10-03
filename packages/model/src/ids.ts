/**
 * Id generation (research R3): `<type prefix>-<10 random base-36 chars>`, e.g. `node-k3j9x0q2ab`.
 * The prefix is the object type, never its title. Generated ids are unique across the whole deck
 * (not only per collection), so a sticky anchor, which may name any object, is unambiguous.
 */
import type { Id } from '@sododeck/schema';
import type * as Y from 'yjs';

import {
  childList,
  collectionMap,
  COLLECTIONS,
  rulesMap,
  type DeckDoc,
  type ListMap,
} from './layout';

export type IdPrefix =
  | 'node'
  | 'group'
  | 'edge'
  | 'view'
  | 'feature'
  | 'flow'
  | 'step'
  | 'branch'
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

function listIds(list: ListMap | undefined, visit: (id: string) => boolean): boolean {
  if (list === undefined) return false;
  for (const id of list.keys()) if (visit(id)) return true;
  return false;
}

/**
 * Calls `visit` with every id in the deck: collection objects, steps, branches, rules, rule
 * columns and rows. Stops early when `visit` returns true, and then returns true.
 */
export function forEachDeckId(doc: DeckDoc, visit: (id: string) => boolean): boolean {
  for (const c of COLLECTIONS) {
    for (const [id, map] of collectionMap(doc, c).entries()) {
      if (visit(id)) return true;
      if (c === 'flows' && listIds(childList(map, 'steps'), visit)) return true;
      if (c === 'flows' && listIds(childList(map, 'branches'), visit)) return true;
    }
  }
  for (const [id, rule] of rulesMap(doc).entries()) {
    if (visit(id)) return true;
    for (const part of ['inputs', 'outputs', 'rows']) {
      if (listIds(childList(rule, part), visit)) return true;
    }
  }
  return false;
}

export function deckHasId(doc: DeckDoc, id: Id): boolean {
  return forEachDeckId(doc, (existing) => existing === id);
}

export interface IdAllocator {
  /**
   * Returns a new id not used anywhere in the deck. `reserved` holds ids chosen for objects that
   * are not written yet (e.g. a rule's columns).
   */
  allocate(prefix: IdPrefix, reserved?: ReadonlySet<Id>): Id;
  /** Records ids this editor writes itself (explicit ids on paste or import). */
  reserve(ids: Iterable<Id>): void;
  /** Stops listening to the document. */
  destroy(): void;
}

/**
 * Generates ids unused in `doc`. Known ids are cached so bulk adds stay linear: the cache is
 * dropped after any transaction that is not `origin`'s (loads, other tabs, undo), and ids this
 * editor adds are recorded. Stale entries for deleted objects only make it more conservative.
 */
export function makeIdAllocator(
  doc: DeckDoc,
  newId: (prefix: string) => Id,
  origin: object,
): IdAllocator {
  let known: Set<Id> | undefined;
  const knownIds = () => {
    if (known === undefined) {
      const ids = new Set<Id>();
      forEachDeckId(doc, (id) => (ids.add(id), false));
      known = ids;
    }
    return known;
  };
  const invalidate = (transaction: Y.Transaction) => {
    if (transaction.origin !== origin) known = undefined;
  };
  doc.on('afterTransaction', invalidate);

  return {
    allocate: (prefix, reserved) => {
      const ids = knownIds();
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const id = newId(prefix);
        if (reserved?.has(id) !== true && !ids.has(id)) {
          ids.add(id);
          return id;
        }
      }
      throw new Error(
        `Could not generate a unique "${prefix}" id: the id generator keeps colliding.`,
      );
    },
    reserve: (ids) => {
      if (known !== undefined) for (const id of ids) known.add(id);
    },
    destroy: () => {
      doc.off('afterTransaction', invalidate);
    },
  };
}

/** Ids a sticky may anchor to: collection objects, steps and rules (not rule columns or rows). */
export function anchorableIds(doc: DeckDoc): Set<Id> {
  const ids = new Set<Id>();
  for (const c of COLLECTIONS) {
    for (const [id, map] of collectionMap(doc, c).entries()) {
      ids.add(id);
      if (c === 'flows') listIds(childList(map, 'steps'), (stepId) => (ids.add(stepId), false));
    }
  }
  for (const id of rulesMap(doc).keys()) ids.add(id);
  return ids;
}
