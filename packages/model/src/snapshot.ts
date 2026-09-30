/**
 * Incremental read model (003 research R1). Keeps one plain `SododeckFile` in step with the
 * document and, per transaction, rebuilds only the objects that changed and the containers that
 * hold them. Untouched objects keep their identity (structural sharing), so views can skip work
 * with reference checks, and a drag frame costs one object, not a full `toJSON`.
 */
import type { SododeckFile } from '@sododeck/schema';

import { fromY } from './convert';
import { toJSON } from './deck';
import { canonicalizeEntry, fileKeyOrder } from './key-order';
import {
  collectionArray,
  COLLECTIONS,
  metaMap,
  rulesMap,
  type Collection,
  type DeckDoc,
} from './layout';
import { observeDeck, type ObjectChange } from './observe';

export interface DeckSnapshot {
  /** Current plain deck. A new top-level object after every change; untouched objects keep identity. */
  get: () => SododeckFile;
  /** Called once per transaction, after `get()` is up to date. Returns unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Stops following the document; `get()` keeps returning the last deck. */
  destroy: () => void;
}

type Item = { id: string };

/** Rebuilds a collection in document order, reusing every object that was not touched. */
function rebuildCollection(
  doc: DeckDoc,
  c: Collection,
  previous: readonly Item[],
  touched: ReadonlySet<string>,
): Item[] {
  const byId = new Map<string, Item>();
  for (const item of previous) if (!byId.has(item.id)) byId.set(item.id, item);
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const map of collectionArray(doc, c)) {
    const id = map.get('id');
    const reusable =
      typeof id === 'string' && !touched.has(id) && !seen.has(id) ? byId.get(id) : undefined;
    if (typeof id === 'string') seen.add(id);
    out.push(reusable ?? canonicalizeEntry(c, fromY(map) as Item));
  }
  return out;
}

function rebuildRules(
  doc: DeckDoc,
  previous: SododeckFile['rules'],
  touched: ReadonlySet<string>,
): SododeckFile['rules'] {
  const out: SododeckFile['rules'] = {};
  for (const [id, rule] of rulesMap(doc).entries()) {
    const reusable = touched.has(id) ? undefined : previous[id];
    out[id] = reusable ?? canonicalizeEntry('rules', fromY(rule) as SododeckFile['rules'][string]);
  }
  return out;
}

/** Applies one transaction's changes to the previous deck. */
function apply(doc: DeckDoc, previous: SododeckFile, changes: ObjectChange[]): SododeckFile {
  const touched = new Map<string, Set<string>>();
  for (const change of changes) {
    let ids = touched.get(change.scope);
    if (ids === undefined) {
      ids = new Set();
      touched.set(change.scope, ids);
    }
    // A step, column or row change rebuilds its owning flow or rule.
    ids.add(change.id);
  }

  const parts: Record<string, unknown> = {};
  const meta = metaMap(doc);
  const metaChanged = touched.has('meta');
  for (const key of fileKeyOrder()) {
    if ((COLLECTIONS as readonly string[]).includes(key)) {
      const c = key as Collection;
      const ids = touched.get(c);
      parts[key] = ids === undefined ? previous[c] : rebuildCollection(doc, c, previous[c], ids);
    } else if (key === 'rules') {
      const ids = touched.get('rules');
      parts[key] = ids === undefined ? previous.rules : rebuildRules(doc, previous.rules, ids);
    } else {
      const value = metaChanged
        ? fromY(meta.get(key))
        : (previous as unknown as Record<string, unknown>)[key];
      // `swatches` is always a stored Y.Array (020, R3), but is emitted only when non-empty,
      // exactly like `toJSON` (an old deck without any keeps no `swatches` key).
      const omit = key === 'swatches' && Array.isArray(value) && value.length === 0;
      if (value !== undefined && !omit) parts[key] = value;
    }
  }
  return parts as unknown as SododeckFile;
}

/** Follows `doc` and keeps an up-to-date, structurally shared plain deck. */
export function createDeckSnapshot(doc: DeckDoc): DeckSnapshot {
  let current = toJSON(doc);
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined = observeDeck(doc, ({ changes }) => {
    current = apply(doc, current, changes);
    for (const listener of [...listeners]) listener();
  });

  return {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy: () => {
      stop?.();
      stop = undefined;
      listeners.clear();
    },
  };
}
