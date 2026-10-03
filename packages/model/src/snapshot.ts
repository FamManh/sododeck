/**
 * Incremental read model (003 research R1). Keeps one plain `SododeckFile` in step with the
 * document and, per transaction, rebuilds only the objects that changed and the containers that
 * hold them. Untouched objects keep their identity (structural sharing), so views can skip work
 * with reference checks, and a drag frame costs one object, not a full `toJSON`.
 */
import type { SododeckFile } from '@sododeck/schema';

import { jsonEqual } from './convert';
import { toJSON } from './deck';
import { canonicalizeEntry, fileKeyOrder } from './key-order';
import {
  collectionMap,
  COLLECTIONS,
  orderedEntries,
  rulesMap,
  type Collection,
  type DeckDoc,
} from './layout';
import { observeDeck, type ObjectChange } from './observe';
import { readMeta, readObject, readRule } from './read';

export interface DeckSnapshot {
  /** Current plain deck. A new top-level object after every change; untouched objects keep identity. */
  get: () => SododeckFile;
  /** Called once per transaction, after `get()` is up to date. Returns unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Stops following the document; `get()` keeps returning the last deck. */
  destroy: () => void;
}

type Item = { id: string };

/** What one transaction touched in a scope: ids to rebuild, and whether its order may change. */
interface Touched {
  ids: Set<string>;
  reorder: boolean;
}

/**
 * Rebuilds a collection, reusing every object that was not touched. The previous order is kept
 * when no item was added, removed or moved (research R6): a field edit costs no sort.
 */
function rebuildCollection(
  doc: DeckDoc,
  c: Collection,
  previous: readonly Item[],
  { ids, reorder }: Touched,
): Item[] {
  const list = collectionMap(doc, c);
  const read = (id: string) => {
    const map = list.get(id);
    return map === undefined ? undefined : canonicalizeEntry(c, readObject(c, id, map) as Item);
  };
  if (!reorder) {
    return previous.flatMap((item) => (ids.has(item.id) ? (read(item.id) ?? []) : [item]));
  }
  const byId = new Map<string, Item>();
  for (const item of previous) if (!byId.has(item.id)) byId.set(item.id, item);
  return orderedEntries(list).map(([id, map]) => {
    const reusable = ids.has(id) ? undefined : byId.get(id);
    return reusable ?? canonicalizeEntry(c, readObject(c, id, map) as Item);
  });
}

function rebuildRules(
  doc: DeckDoc,
  previous: SododeckFile['rules'],
  touched: ReadonlySet<string>,
): SododeckFile['rules'] {
  const out: SododeckFile['rules'] = {};
  for (const [id, rule] of orderedEntries(rulesMap(doc))) {
    const reusable = touched.has(id) ? undefined : previous[id];
    out[id] = reusable ?? canonicalizeEntry('rules', readRule(rule));
  }
  return out;
}

/** Applies one transaction's changes to the previous deck. */
function apply(doc: DeckDoc, previous: SododeckFile, changes: ObjectChange[]): SododeckFile {
  const touched = new Map<string, Touched>();
  for (const change of changes) {
    let entry = touched.get(change.scope);
    if (entry === undefined) {
      entry = { ids: new Set(), reorder: false };
      touched.set(change.scope, entry);
    }
    // A step, column or row change rebuilds its owning flow or rule.
    entry.ids.add(change.id);
    if (change.child === undefined && (change.kind !== 'updated' || change.keys.length === 0)) {
      entry.reorder = true;
    }
  }

  const parts: Record<string, unknown> = {};
  const meta = touched.has('meta') ? (readMeta(doc) as Record<string, unknown>) : undefined;
  for (const key of fileKeyOrder()) {
    if ((COLLECTIONS as readonly string[]).includes(key)) {
      const c = key as Collection;
      const entry = touched.get(c);
      parts[key] =
        entry === undefined ? previous[c] : rebuildCollection(doc, c, previous[c], entry);
    } else if (key === 'rules') {
      const entry = touched.get('rules');
      parts[key] =
        entry === undefined ? previous.rules : rebuildRules(doc, previous.rules, entry.ids);
    } else {
      const before = (previous as unknown as Record<string, unknown>)[key];
      // An unchanged meta value keeps its identity (032: `fields` feeds memoised field lists, so
      // renaming the deck must not make every card rebuild its fields).
      const value = meta === undefined || jsonEqual(before, meta[key]) ? before : meta[key];
      if (value !== undefined) parts[key] = value;
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
