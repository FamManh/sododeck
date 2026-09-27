/**
 * The deck document model. This module is the ONLY place that converts
 * between the Yjs document and the `.sododeck.json` format.
 *
 * Yjs layout (skeleton, revisit with the full schema in M1):
 *   doc.getMap('meta')           → { $schema, version, name?, description?, tags? (Y.Array) }
 *   doc.getArray(<collection>)   → Y.Map per object (nodes, groups, edges, ...)
 *   doc.getMap('rules')          → rule id → Y.Map
 * Nested JSON objects become Y.Map and nested arrays become Y.Array, so every
 * field is individually editable and mergeable.
 */
import type { Id, Rule, SododeckFile } from '@sododeck/schema';
import { parseSododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { fromY, toY, type YObject, type YValue } from './convert';
import { DeckValidationError } from './errors';

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

/** Identifies an object; `child` names a step of a flow, or a column or row of a rule. */
export interface ObjectRef {
  scope: Scope;
  /** Object id (`''` for meta). */
  id: Id;
  child?: { kind: 'step' | 'column' | 'row'; id: Id };
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

/** Creates a new, empty deck document. */
export function createDeck(): DeckDoc {
  return fromJSON({
    $schema: 'https://sododeck.com/schema/v1.json',
    version: 1,
    nodes: [],
    groups: [],
    edges: [],
    views: [],
    features: [],
    flows: [],
    rules: {},
    stickies: [],
  } satisfies SododeckFile);
}

/**
 * Validates `input` against the v1 schema and loads it into a new Y.Doc.
 * @throws DeckValidationError when the input is not a valid v1 file.
 */
export function fromJSON(input: unknown): DeckDoc {
  const parsed = parseSododeckFile(input);
  if (!parsed.success) throw new DeckValidationError(parsed.issues);
  const file = parsed.data;

  const doc = new Y.Doc();
  doc.transact(() => {
    const meta = metaMap(doc);
    meta.set('$schema', file.$schema);
    meta.set('version', file.version);
    if (file.name !== undefined) meta.set('name', file.name);
    if (file.description !== undefined) meta.set('description', file.description);
    if (file.tags !== undefined) meta.set('tags', toY(file.tags));

    for (const name of COLLECTIONS) {
      doc.getArray<YValue>(name).push(file[name].map((item) => toY(item)));
    }

    const rules = doc.getMap<YValue>('rules');
    for (const [id, rule] of Object.entries(file.rules)) rules.set(id, toY(rule));
  });
  return doc;
}

/** Reads the document back into a plain `.sododeck.json` object with canonical top-level key order. */
export function toJSON(doc: DeckDoc): SododeckFile {
  const meta = metaMap(doc);
  const collection = <K extends Collection>(name: K) =>
    collectionArray(doc, name).toArray().map(fromY) as SododeckFile[K];

  const name = meta.get('name');
  const description = meta.get('description');
  const tags = meta.get('tags');

  return {
    $schema: meta.get('$schema') as SododeckFile['$schema'],
    version: meta.get('version') as SododeckFile['version'],
    // Optional metadata is emitted only when present, so files without it round-trip unchanged.
    ...(name === undefined ? {} : { name: name as string }),
    ...(description === undefined ? {} : { description: description as string }),
    ...(tags === undefined ? {} : { tags: fromY(tags) as string[] }),
    nodes: collection('nodes'),
    groups: collection('groups'),
    edges: collection('edges'),
    views: collection('views'),
    features: collection('features'),
    flows: collection('flows'),
    rules: fromY(rulesMap(doc)) as SododeckFile['rules'],
    stickies: collection('stickies'),
  };
}

/** Serializes a file for saving/export. TODO(M1): fixed per-object key order for readable git diffs. */
export function serializeDeck(file: SododeckFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
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

/** Reads one object of a collection as plain data. */
export function getObject<C extends Collection>(
  doc: DeckDoc,
  c: C,
  id: Id,
): ObjectOf<C> | undefined {
  const array = collectionArray(doc, c);
  const index = indexOfId(array, id);
  return index === -1 ? undefined : (fromY(array.get(index)) as ObjectOf<C>);
}

/** Reads one rule (decision table) as plain data. */
export function getRule(doc: DeckDoc, id: Id): Rule | undefined {
  const rule = rulesMap(doc).get(id);
  return rule === undefined ? undefined : (fromY(rule) as Rule);
}
