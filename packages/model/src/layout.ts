/** Root types of the deck document and lookups over them. The layout is documented in deck.ts. */
import type { Id, SododeckFile } from '@sododeck/schema';
import type * as Y from 'yjs';

import type { YObject, YValue } from './convert';

export type DeckDoc = Y.Doc;

/** Array collections, in canonical file order. */
export const ARRAY_COLLECTIONS = [
  'nodes',
  'groups',
  'edges',
  'views',
  'features',
  'flows',
] as const satisfies readonly (keyof SododeckFile)[];

/** Every id-keyed array collection of the file, stickies included. */
export const COLLECTIONS = [...ARRAY_COLLECTIONS, 'stickies'] as const;

export type Collection = (typeof COLLECTIONS)[number];
export type ObjectOf<C extends Collection> = SododeckFile[C][number];

/** Where an object lives: deck metadata, a collection, or the rules map. */
export type Scope = 'meta' | Collection | 'rules';

/** Identifies an object; `child` names a step or branch of a flow, or a column or row of a rule. */
export interface ObjectRef {
  scope: Scope;
  /** Object id (`''` for meta). */
  id: Id;
  child?: { kind: 'step' | 'branch' | 'column' | 'row'; id: Id };
}

/** Root types, i.e. everything an editor's undo history covers. */
export function rootTypes(doc: DeckDoc): Y.AbstractType<unknown>[] {
  return [
    doc.getMap('meta'),
    ...COLLECTIONS.map((c) => doc.getArray(c)),
    doc.getMap('rules'),
  ] as Y.AbstractType<unknown>[];
}

export function metaMap(doc: DeckDoc): YObject {
  return doc.getMap<YValue>('meta');
}

export function collectionArray(doc: DeckDoc, c: Collection): Y.Array<YObject> {
  return doc.getArray<YObject>(c);
}

export function rulesMap(doc: DeckDoc): Y.Map<YObject> {
  return doc.getMap<YObject>('rules');
}

/** Index of the object with `id` in a collection, or -1. Linear: collections stay ≤ a few thousand. */
export function indexOfId(array: Y.Array<YObject>, id: Id): number {
  let found = -1;
  let index = 0;
  for (const map of array) {
    if (map.get('id') === id) {
      found = index;
      break;
    }
    index++;
  }
  return found;
}
