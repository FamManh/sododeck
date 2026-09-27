/**
 * Change observation (research R6): translates Yjs events into `DeckChange`s so surfaces update
 * incrementally without knowing the document layout.
 */
import * as Y from 'yjs';

import { COLLECTIONS, type DeckDoc, type ObjectRef, type Scope } from './layout';
import { editorOrigins } from './ops/context';

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

type Root = Y.Map<unknown> | Y.Array<unknown>;
/** The event type `observeDeep` hands out. */
type DeckEvent = Parameters<Parameters<Root['observeDeep']>[0]>[0][number];

const SCOPE_ORDER: readonly Scope[] = ['meta', ...COLLECTIONS, 'rules'];

const CHILD_KINDS: Readonly<Record<string, 'step' | 'branch' | 'column' | 'row'>> = {
  steps: 'step',
  branches: 'branch',
  inputs: 'column',
  outputs: 'column',
  rows: 'row',
};

/** Id of a Y.Map item, including one deleted in this transaction (read before it is GC'd). */
function idOfItem(item: Y.Item): string | undefined {
  if (!(item.content instanceof Y.ContentType)) return undefined;
  const type = item.content.type;
  if (!(type instanceof Y.Map)) return undefined;
  const value: unknown = type._map.get('id')?.content.getContent()[0];
  return typeof value === 'string' ? value : undefined;
}

function idAt(array: unknown, index: unknown): string | undefined {
  if (!(array instanceof Y.Array) || typeof index !== 'number') return undefined;
  const item: unknown = array.get(index);
  if (!(item instanceof Y.Map)) return undefined;
  const id: unknown = item.get('id');
  return typeof id === 'string' ? id : undefined;
}

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

/** Children added to / removed from an array of id-carrying maps. */
function recordArrayDelta(
  event: DeckEvent,
  buffer: ChangeBuffer,
  refOf: (id: string) => ObjectRef,
): void {
  for (const item of event.changes.added) {
    const id = idOfItem(item);
    if (id !== undefined) buffer.record(refOf(id), 'added');
  }
  for (const item of event.changes.deleted) {
    const id = idOfItem(item);
    if (id !== undefined) buffer.record(refOf(id), 'removed');
  }
}

/** Items of a Y.Array, including those deleted in this transaction. */
function itemsOf(array: unknown): Y.Item[] {
  const items: Y.Item[] = [];
  if (!(array instanceof Y.Array)) return items;
  for (let item = array._start; item !== null; item = item.right) items.push(item);
  return items;
}

/**
 * A flow's `branches` field is optional, so the first branch sets it and removing the last one
 * deletes it (ADR 0008). Reports that as branch children added or removed, like steps.
 */
function recordBranchesField(
  event: Y.YMapEvent<unknown>,
  buffer: ChangeBuffer,
  ref: ObjectRef,
): void {
  const change = event.changes.keys.get('branches');
  if (change === undefined) return;
  const childRef = (id: string): ObjectRef => ({ ...ref, child: { kind: 'branch', id } });
  if (change.action !== 'add') {
    for (const item of itemsOf(change.oldValue)) {
      const id = idOfItem(item);
      if (id !== undefined) buffer.record(childRef(id), 'removed');
    }
  }
  if (change.action !== 'delete') {
    for (const item of itemsOf(event.target.get('branches'))) {
      const id = item.deleted ? undefined : idOfItem(item);
      if (id !== undefined) buffer.record(childRef(id), 'added');
    }
  }
}

function keysOf(event: DeckEvent, rest: readonly (string | number)[]): string[] {
  const first = rest[0];
  if (first === undefined)
    return event instanceof Y.YMapEvent ? Array.from(event.keysChanged, String) : [];
  return [String(first)];
}

/**
 * Records one event of an object map subtree. `path` is relative to the object; `children` gives
 * the array holding a child kind (steps, columns, rows).
 */
function recordObjectEvent(
  event: DeckEvent,
  buffer: ChangeBuffer,
  ref: ObjectRef,
  object: Y.Map<unknown>,
  path: readonly (string | number)[],
): void {
  const [field, index, ...rest] = path;
  if (field === undefined && ref.scope === 'flows' && event instanceof Y.YMapEvent) {
    recordBranchesField(event, buffer, ref);
    const keys = keysOf(event, path).filter((k) => k !== 'branches');
    if (keys.length > 0 || !event.keysChanged.has('branches')) buffer.record(ref, 'updated', keys);
    return;
  }
  const childKind = typeof field === 'string' ? CHILD_KINDS[field] : undefined;
  const flowChild = field === 'steps' || field === 'branches';
  if (childKind === undefined || (ref.scope === 'rules') === flowChild) {
    buffer.record(ref, 'updated', keysOf(event, path));
    return;
  }
  const children = object.get(field as string);
  const childRef = (id: string): ObjectRef => ({ ...ref, child: { kind: childKind, id } });
  if (index === undefined) {
    recordArrayDelta(event, buffer, childRef);
    return;
  }
  const childId = idAt(children, index);
  if (childId !== undefined) buffer.record(childRef(childId), 'updated', keysOf(event, rest));
}

function recordEvent(scope: Scope, root: Root, event: DeckEvent, buffer: ChangeBuffer): void {
  const path = event.path;
  if (scope === 'meta') {
    buffer.record({ scope, id: '' }, 'updated', keysOf(event, path));
    return;
  }
  const [head, ...rest] = path;
  if (scope === 'rules') {
    if (head === undefined) {
      for (const [id, change] of event.changes.keys) {
        buffer.record(
          { scope, id },
          change.action === 'add' ? 'added' : change.action === 'delete' ? 'removed' : 'updated',
        );
      }
      return;
    }
    const rule: unknown = root instanceof Y.Map ? root.get(String(head)) : undefined;
    if (rule instanceof Y.Map)
      recordObjectEvent(event, buffer, { scope, id: String(head) }, rule, rest);
    return;
  }
  if (head === undefined) {
    recordArrayDelta(event, buffer, (id) => ({ scope, id }));
    return;
  }
  const object: unknown =
    root instanceof Y.Array && typeof head === 'number' ? root.get(head) : undefined;
  const id = idAt(root, head);
  if (object instanceof Y.Map && id !== undefined)
    recordObjectEvent(event, buffer, { scope, id }, object, rest);
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
    ...COLLECTIONS.map((c): [Scope, Root] => [c, doc.getArray(c)]),
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
