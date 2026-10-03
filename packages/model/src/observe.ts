/**
 * Change observation (research R6): translates Yjs events into `DeckChange`s so surfaces update
 * incrementally without knowing the document layout.
 */
import * as Y from 'yjs';

import { COLLECTIONS, isInternalKey, type DeckDoc, type ObjectRef, type Scope } from './layout';
import { editorOrigins } from './ops/context';
import { BLANK_PREFIX, VALUE_PREFIX } from './text';

export interface ObjectChange extends ObjectRef {
  kind: 'added' | 'updated' | 'removed';
  /** Top-level fields that changed (for `updated`), sorted. Empty for a reorder. */
  keys: string[];
}

export interface DeckChange {
  /** `local`: this tab's editors; `undo`/`redo`: their history; `remote`: anything else. */
  origin: 'local' | 'undo' | 'redo' | 'remote';
  changes: ObjectChange[];
}

type Root = Y.Map<unknown>;
/** The event type `observeDeep` hands out. */
type DeckEvent = Parameters<Parameters<Root['observeDeep']>[0]>[0][number];

const SCOPE_ORDER: readonly Scope[] = ['meta', ...COLLECTIONS, 'rules'];

/** Child lists of a flow and of a rule, and the kind of child they hold. */
const FLOW_CHILDREN: Readonly<Record<string, 'step' | 'branch'>> = {
  steps: 'step',
  branches: 'branch',
};
const RULE_CHILDREN: Readonly<Record<string, 'column' | 'row'>> = {
  inputs: 'column',
  outputs: 'column',
  rows: 'row',
};

type Kind = ObjectChange['kind'];

class ChangeBuffer {
  private readonly byKey = new Map<
    string,
    { ref: ObjectRef; added: boolean; removed: boolean; updated: boolean; keys: Set<string> }
  >();

  record(ref: ObjectRef, kind: Kind, keys: Iterable<string> = []): void {
    const key = `${ref.scope}\u0000${ref.id}\u0000${ref.child?.kind ?? ''}\u0000${ref.child?.id ?? ''}`;
    let entry = this.byKey.get(key);
    if (entry === undefined) {
      entry = { ref, added: false, removed: false, updated: false, keys: new Set() };
      this.byKey.set(key, entry);
    }
    if (kind === 'added') entry.added = true;
    else if (kind === 'removed') entry.removed = true;
    else entry.updated = true;
    for (const k of keys) entry.keys.add(k);
  }

  /** Merges per object: removed + added (a reorder) is an update; added + removed is nothing. */
  flush(): ObjectChange[] {
    const out: ObjectChange[] = [];
    for (const { ref, added, removed, updated, keys } of this.byKey.values()) {
      let kind: Kind;
      if (added && removed) {
        kind = 'updated';
      } else if (added) {
        kind = 'added';
      } else if (removed) {
        kind = 'removed';
      } else if (updated) {
        kind = 'updated';
      } else {
        continue;
      }
      out.push({ ...ref, kind, keys: kind === 'updated' ? [...keys].sort() : [] });
    }
    this.byKey.clear();
    const rank = (scope: Scope) => SCOPE_ORDER.indexOf(scope);
    // Stable sort: within a scope, changes keep the order Yjs reported them in.
    return out.sort((a, b) => rank(a.scope) - rank(b.scope));
  }
}

/** Field names a map event changed: internal keys dropped, a blank marker named as its field. */
function fieldKeys(event: DeckEvent): string[] {
  if (!(event instanceof Y.YMapEvent)) return [];
  const keys: string[] = [];
  for (const key of event.keysChanged as Set<string>) {
    if (key.startsWith(BLANK_PREFIX)) keys.push(key.slice(BLANK_PREFIX.length));
    else if (key.startsWith(VALUE_PREFIX)) keys.push('values');
    else if (!isInternalKey(key)) keys.push(key);
  }
  return keys;
}

/** Keys changed by an event at `rest` below an object: its own fields, or the field it is inside. */
function keysOf(event: DeckEvent, rest: readonly (string | number)[]): string[] {
  const first = rest[0];
  return first === undefined ? fieldKeys(event) : [String(first)];
}

/** Items added, removed or replaced in a list map (the event's own key changes). */
function recordListKeys(
  event: DeckEvent,
  buffer: ChangeBuffer,
  refOf: (id: string) => ObjectRef,
): void {
  for (const [id, change] of event.changes.keys) {
    if (isInternalKey(id)) continue;
    const kind =
      change.action === 'add' ? 'added' : change.action === 'delete' ? 'removed' : 'updated';
    buffer.record(refOf(id), kind);
  }
}

/**
 * The side (`when` / `then`) of each cell key a row's `cells` event changed. A column removed in
 * the same transaction is gone from its list but still known to it as a deleted entry.
 */
function cellSides(event: DeckEvent, rule: Y.Map<unknown>): string[] {
  const outputs = rule.get('outputs');
  const sides = new Set<string>();
  for (const column of event.changes.keys.keys()) {
    const isOutput = outputs instanceof Y.Map && (outputs.has(column) || outputs._map.has(column));
    sides.add(isOutput ? 'then' : 'when');
  }
  return [...sides];
}

/** Records one event of an object's subtree; `path` is relative to the object. */
function recordObjectEvent(
  event: DeckEvent,
  buffer: ChangeBuffer,
  ref: ObjectRef,
  object: Y.Map<unknown>,
  path: readonly (string | number)[],
): void {
  const [field, childId, ...rest] = path;
  if (field === undefined) {
    buffer.record(ref, 'updated', fieldKeys(event));
    return;
  }
  const children =
    ref.scope === 'flows' ? FLOW_CHILDREN : ref.scope === 'rules' ? RULE_CHILDREN : {};
  const childKind = typeof field === 'string' ? children[field] : undefined;
  if (childKind === undefined) {
    buffer.record(ref, 'updated', [String(field)]);
    return;
  }
  const childRef = (id: string): ObjectRef => ({ ...ref, child: { kind: childKind, id } });
  if (childId === undefined) {
    recordListKeys(event, buffer, childRef);
    return;
  }
  const keys =
    childKind === 'row' && rest[0] === 'cells' ? cellSides(event, object) : keysOf(event, rest);
  buffer.record(childRef(String(childId)), 'updated', keys);
}

function recordEvent(scope: Scope, root: Root, event: DeckEvent, buffer: ChangeBuffer): void {
  const path = event.path;
  if (scope === 'meta') {
    buffer.record({ scope, id: '' }, 'updated', keysOf(event, path));
    return;
  }
  const [head, ...rest] = path;
  if (head === undefined) {
    recordListKeys(event, buffer, (id) => ({ scope, id }));
    return;
  }
  const object = root.get(String(head));
  if (object instanceof Y.Map) {
    recordObjectEvent(event, buffer, { scope, id: String(head) }, object, rest);
  }
}

function originOf(origin: unknown): DeckChange['origin'] {
  if (origin instanceof Y.UndoManager)
    return origin.undoing ? 'undo' : origin.redoing ? 'redo' : 'remote';
  return typeof origin === 'object' && origin !== null && editorOrigins.has(origin)
    ? 'local'
    : 'remote';
}

/** Calls `listener` once per transaction that changed the deck. Returns an unsubscribe function. */
export function observeDeck(doc: DeckDoc, listener: (change: DeckChange) => void): () => void {
  const buffer = new ChangeBuffer();
  const roots: [Scope, Root][] = [
    ['meta', doc.getMap('meta')],
    ...COLLECTIONS.map((c): [Scope, Root] => [c, doc.getMap(c)]),
    ['rules', doc.getMap('rules')],
  ];
  const handlers = roots.map(([scope, root]) => {
    const handler = (events: DeckEvent[]) => {
      for (const event of events) recordEvent(scope, root, event, buffer);
    };
    root.observeDeep(handler);
    return () => {
      root.unobserveDeep(handler);
    };
  });
  const flush = (transaction: Y.Transaction) => {
    const changes = buffer.flush();
    if (changes.length > 0) listener({ origin: originOf(transaction.origin), changes });
  };
  doc.on('afterTransaction', flush);
  return () => {
    for (const off of handlers) off();
    doc.off('afterTransaction', flush);
  };
}
