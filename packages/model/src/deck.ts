/**
 * The deck document model. This module is the ONLY place that converts
 * between the Yjs document and the `.sododeck.json` format.
 *
 * Yjs layout (skeleton, revisit with the full schema in M1):
 *   doc.getMap('meta')           → { $schema, version }
 *   doc.getArray(<collection>)   → Y.Map per object (nodes, groups, edges, ...)
 *   doc.getMap('rules')          → rule id → Y.Map
 * Nested JSON objects become Y.Map and nested arrays become Y.Array, so every
 * field is individually editable and mergeable.
 */
import { parseSododeckFile, type SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

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

type ArrayCollection = (typeof ARRAY_COLLECTIONS)[number];

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type YValue = null | boolean | number | string | Y.Map<YValue> | Y.Array<YValue>;

export class DeckValidationError extends Error {
  constructor(readonly issues: { path: string; message: string }[]) {
    super(`Invalid .sododeck.json: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
    this.name = 'DeckValidationError';
  }
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
    const meta = doc.getMap<YValue>('meta');
    meta.set('$schema', file.$schema);
    meta.set('version', file.version);

    for (const name of [...ARRAY_COLLECTIONS, 'stickies'] as const) {
      doc.getArray<YValue>(name).push(file[name].map((item) => toY(item as Json)));
    }

    const rules = doc.getMap<YValue>('rules');
    for (const [id, rule] of Object.entries(file.rules)) rules.set(id, toY(rule as Json));
  });
  return doc;
}

/** Reads the document back into a plain `.sododeck.json` object with canonical top-level key order. */
export function toJSON(doc: DeckDoc): SododeckFile {
  const meta = doc.getMap<YValue>('meta');
  const collection = (name: ArrayCollection | 'stickies') =>
    doc.getArray<YValue>(name).toArray().map(fromY) as SododeckFile[typeof name];

  return {
    $schema: meta.get('$schema') as SododeckFile['$schema'],
    version: meta.get('version') as SododeckFile['version'],
    nodes: collection('nodes'),
    groups: collection('groups'),
    edges: collection('edges'),
    views: collection('views'),
    features: collection('features'),
    flows: collection('flows'),
    rules: fromY(doc.getMap<YValue>('rules')) as SododeckFile['rules'],
    stickies: collection('stickies'),
  };
}

/** Serializes a file for saving/export. TODO(M1): fixed per-object key order for readable git diffs. */
export function serializeDeck(file: SododeckFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

function toY(value: Json): YValue {
  if (Array.isArray(value)) {
    const array = new Y.Array<YValue>();
    array.push(value.map(toY));
    return array;
  }
  if (value !== null && typeof value === 'object') {
    const map = new Y.Map<YValue>();
    for (const [key, child] of Object.entries(value)) map.set(key, toY(child));
    return map;
  }
  return value;
}

function fromY(value: YValue): Json {
  if (value instanceof Y.Array) return value.toArray().map(fromY);
  if (value instanceof Y.Map) {
    const out: Record<string, Json> = {};
    for (const [key, child] of value.entries()) out[key] = fromY(child);
    return out;
  }
  return value;
}
