/**
 * The deck document model. This module is the ONLY place that converts
 * between the Yjs document and the `.sododeck.json` format.
 *
 * Yjs layout: persisted from feature 005 on, so changing it needs an ADR and a migration
 * (ADR 0005, specs/002-yjs-model/data-model.md).
 *
 *   doc.getMap('meta')         Y.Map        $schema, version, name?, description?, tags? (Y.Array)
 *   doc.getArray('nodes')      Y.Array<Y.Map>  one map per node, in file order
 *   doc.getArray('groups')     Y.Array<Y.Map>  one map per group
 *   doc.getArray('edges')      Y.Array<Y.Map>  one map per edge
 *   doc.getArray('views')      Y.Array<Y.Map>  includes → Y.Array; positions → Y.Map(node id → Y.Map x,y);
 *                                              011 (ADR 0012, optional): excludeGroups, excludeKinds,
 *                                              excludeTags, dimKinds, pinned, collapsed → Y.Array.
 *                                              `collapsed` is written with an untracked origin.
 *   doc.getArray('features')   Y.Array<Y.Map>  one map per feature
 *   doc.getArray('flows')      Y.Array<Y.Map>  steps → Y.Array<Y.Map>; step ruleInputs → nested Y.Map;
 *                                              branches (006, optional) → Y.Array<Y.Map>
 *   doc.getMap('rules')        Y.Map<Y.Map>    rule id → rule; inputs/outputs/rows → Y.Array<Y.Map>;
 *                                              row when/then → Y.Array<string>
 *   doc.getArray('stickies')   Y.Array<Y.Map>  one map per sticky
 *
 * Inside objects, nested objects (position, positions, ruleInputs, links) become Y.Map and arrays
 * become Y.Array, so every field is individually editable and mergeable (FR-004). Scalars,
 * including all text, are plain values: two concurrent writes to one text field resolve as last
 * write wins for that field (no Y.Text; letter-by-letter merge is a later layout change).
 * Optional fields are absent when unset, never stored as null or undefined.
 *
 * Output key order is not taken from Y.Map; `toJSON` rebuilds every object in schema order
 * (key-order.ts).
 */
import type { Id, Rule, SododeckFile } from '@sododeck/schema';
import { parseSododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { fromY, toY, type YValue } from './convert';
import { DeckValidationError } from './errors';
import { canonicalize } from './key-order';
import {
  collectionArray,
  COLLECTIONS,
  indexOfId,
  metaMap,
  rulesMap,
  type Collection,
  type DeckDoc,
  type ObjectOf,
} from './layout';
import { checkDuplicateIds } from './load-checks';

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
  const duplicates = checkDuplicateIds(file);
  if (duplicates.length > 0) throw new DeckValidationError(duplicates);

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

/** Reads the document back into a plain `.sododeck.json` object in canonical key order. */
export function toJSON(doc: DeckDoc): SododeckFile {
  const meta = metaMap(doc);
  const collection = <K extends Collection>(name: K) =>
    collectionArray(doc, name).toArray().map(fromY) as SododeckFile[K];

  const name = meta.get('name');
  const description = meta.get('description');
  const tags = meta.get('tags');

  return canonicalize({
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
  });
}

/** Serializes a file for saving/export, in canonical key order so git diffs show only edits. */
export function serializeDeck(file: SododeckFile): string {
  return `${JSON.stringify(canonicalize(file), null, 2)}\n`;
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
