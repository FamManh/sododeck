/**
 * The deck document model. This module is the ONLY place that converts
 * between the Yjs document and the `.sododeck.json` format.
 *
 * Yjs layout 2 (036, ADR 0021; replaces the layout of ADR 0005 §1). Every list is stored by id with
 * an order, so a move is one key change, a delete takes everything written inside the item with
 * it, and lookups do not depend on list size:
 *
 *   doc.getMap('meta')       Y.Map            $schema, version, name?, description (Y.Text), tags?
 *                                               (Y.Array), swatches (Y.Array, always present, 020),
 *                                               tagColors (Y.Map tag → colour, always present, 033),
 *                                               packs (Y.Map packId → true, only once the deck has a
 *                                               pack choice, 030), fields (Y.Map<id, Y.Map> list of
 *                                               field definitions, each with an `options` list, 032)
 *                                               and fieldDefaults (Y.Map typeId → true, 032), both
 *                                               only once the file has them or a field changed;
 *                                               dialect (plain) and enums (Y.Map<id, Y.Map> list,
 *                                               each with a `values` list), both only once the
 *                                               file has them or an op wrote them (040);
                                               tableDisplay (Y.Map, always present, written
                                               only with entries, 041)
 *                                               relationshipDisplay (Y.Map, the same, 042)
 *                                               groupingMode (plain, only when 'schema', 048)
 *   doc.getMap('nodes')      Y.Map<id, Y.Map>  one map per component; a table's columns, indexes
 *                                               and checks → Y.Map<id, Y.Map> (only when stored,
 *                                               even empty; 040); index `columns` a whole value
 *   doc.getMap('groups')     Y.Map<id, Y.Map>  one map per group
 *   doc.getMap('edges')      Y.Map<id, Y.Map>  one map per connection
 *   doc.getMap('views')      Y.Map<id, Y.Map>  includes, filters, pinned, collapsed → Y.Array;
 *                                               positions, groupFrames → Y.Map. `collapsed` and the
 *                                               presets are written with an untracked origin (011).
 *   doc.getMap('features')   Y.Map<id, Y.Map>  one map per feature
 *   doc.getMap('flows')      Y.Map<id, Y.Map>  steps, branches → Y.Map<id, Y.Map> (always present);
 *                                               step ruleInputs → nested Y.Map
 *   doc.getMap('rules')      Y.Map<id, Y.Map>  inputs, outputs, rows → Y.Map<id, Y.Map> (always
 *                                               present); row cells → Y.Map<columnId, string>
 *   doc.getMap('stickies')   Y.Map<id, Y.Map>  one map per note
 *
 * Inside a list item: the id is the map key (no `id` field); `$order` is a fractional-index key and
 * lists read sorted by (`$order`, id) (order-key.ts); `$blank:<field>` keeps an explicitly empty
 * value; `$value:<field id>` holds one typed field value of a card (032), read back as `values`.
 * Long text fields (text-fields.ts) are `Y.Text`, always present, merged letter by letter;
 * every other scalar is a plain value (last write wins). Nested objects are `Y.Map`, arrays
 * `Y.Array`, so every field is individually editable and mergeable. Optional fields are absent
 * when unset. Keys starting with `$` are internal: never output, never reported.
 *
 * `read.ts` and `write.ts` are the only readers and writers of these maps. Output key order is not
 * taken from Y.Map; `toJSON` rebuilds every object in schema order (key-order.ts).
 */
import type { Id, Rule, SododeckFile } from '@sododeck/schema';
import { checkSemanticRules, sododeckFileSchema, toIssues } from '@sododeck/schema';
import * as Y from 'yjs';

import { NEW_DECK_PACKS } from './card-types';
import { toY, type YObject, type YValue } from './convert';
import { DeckValidationError } from './errors';
import { canonicalize } from './key-order';
import {
  collectionMap,
  COLLECTIONS,
  metaMap,
  rulesMap,
  type Collection,
  type DeckDoc,
  type ObjectOf,
} from './layout';
import {
  attachAssets,
  metaOf,
  repairAssets,
  type AssetBytes,
  type AssetMeta,
  type AssetProblem,
} from './assets';
import { checkDuplicateIds } from './load-checks';
import { keysBetween } from './order-key';
import { readAssets, readCollection, readMeta, readObject, readRule, readRules } from './read';
import { blankKey } from './text';
import { createEnum, createField, createObject, createRule } from './write';

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
    packs: [...NEW_DECK_PACKS],
  } satisfies SododeckFile);
}

/** A deck loaded from a file: the document, the picture bytes and the pictures that were damaged. */
export interface LoadedDeck {
  doc: DeckDoc;
  /** Bytes of every sound picture, by picture id; the app writes them to its blob store. */
  bytes: Map<string, Uint8Array>;
  /** Pictures whose data in the file could not be used: shown as missing, never an error (055). */
  problems: AssetProblem[];
}

/**
 * Validates `input` against the v1 schema and loads it into a new Y.Doc, returning the picture
 * bytes next to it (055). A picture whose data is damaged (bad base64, wrong size, hash that is
 * not its id, type outside the allow-list, over 5 MiB) does not refuse the file: it is listed in
 * `problems` and its images show a placeholder. The document never holds picture bytes.
 * @throws DeckValidationError when the input is not a valid v1 file.
 */
export function loadDeck(input: unknown): LoadedDeck {
  const repaired = repairAssets(input);
  return {
    doc: buildDoc(repaired.input, repaired.metas),
    bytes: repaired.bytes,
    problems: repaired.problems,
  };
}

/**
 * Validates `input` against the v1 schema and loads it into a new Y.Doc. Picture bytes are not
 * returned: callers that handle pictures use `loadDeck`.
 * @throws DeckValidationError when the input is not a valid v1 file.
 */
export function fromJSON(input: unknown): DeckDoc {
  return loadDeck(input).doc;
}

/**
 * Validates `input` in as few rounds as possible (062 R5): every structural issue and every
 * duplicate or ambiguous id at once; the format rules S1–S15 / I1–I6 need typed data, so they run
 * (with the id checks) only when the structure holds.
 * @throws DeckValidationError when the input is not a valid v1 file.
 */
export function validateDeckFile(input: unknown): SododeckFile {
  const parsed = sododeckFileSchema.safeParse(input);
  if (!parsed.success) {
    throw new DeckValidationError([...toIssues(parsed.error, input), ...checkDuplicateIds(input)]);
  }
  const file = parsed.data;
  const issues = [...checkSemanticRules(file), ...checkDuplicateIds(file)];
  if (issues.length > 0) throw new DeckValidationError(issues);
  return file;
}

function buildDoc(input: unknown, metas: ReadonlyMap<string, AssetMeta> = new Map()): DeckDoc {
  const file = validateDeckFile(input);

  const doc = new Y.Doc();
  doc.transact(() => {
    const meta = metaMap(doc);
    meta.set('$schema', file.$schema);
    meta.set('version', file.version);
    if (file.name !== undefined) meta.set('name', file.name);
    // Always a Y.Text, so two tabs typing the first description share it (research R7).
    meta.set('description', new Y.Text(file.description ?? ''));
    if (file.description === '') meta.set(blankKey('description'), true);
    if (file.tags !== undefined) meta.set('tags', toY(file.tags));
    // Always present (even empty), so concurrent addSwatch() calls in two tabs share one
    // Y.Array from the start instead of racing to create it (020 research R3).
    meta.set('swatches', toY(file.swatches ?? []));
    // Same reason for `tagColors` (033 R2): two tabs colouring their first tag must share one map.
    meta.set('tagColors', toY(file.tagColors ?? {}));
    // Lazy, unlike the two above: a file without `packs` must stay without it (030 R4). A deck
    // that has one carries it from the start, so two tabs toggling packs share the map.
    if (file.packs !== undefined) {
      meta.set('packs', toY(Object.fromEntries(file.packs.map((id) => [id, true]))));
    }
    // Typed fields (032, R3): lazy like `packs`, so an older deck is written back without them.
    if (file.fields !== undefined) {
      const fields = new Y.Map<YObject>();
      const fieldKeys = keysBetween(null, null, file.fields.length);
      file.fields.forEach((field, i) => {
        fields.set(field.id, createField(field, fieldKeys[i] ?? ''));
      });
      meta.set('fields', fields as unknown as YValue);
    }
    if (file.fieldDefaults !== undefined) {
      meta.set(
        'fieldDefaults',
        toY(Object.fromEntries(file.fieldDefaults.map((id) => [id, true]))),
      );
    }
    // Database schema (040, R5–R6): lazy like `fields`, so an older deck stays without them.
    if (file.dialect !== undefined) meta.set('dialect', file.dialect);
    if (file.blockSqlExport !== undefined) meta.set('blockSqlExport', file.blockSqlExport);
    if (file.enums !== undefined) {
      const enums = new Y.Map<YObject>();
      const enumKeys = keysBetween(null, null, file.enums.length);
      file.enums.forEach((item, i) => {
        enums.set(item.id, createEnum(item, enumKeys[i] ?? ''));
      });
      meta.set('enums', enums as unknown as YValue);
    }
    // Grouping mode (048): a plain scalar, only when the file has it, like `dialect`.
    if (file.groupingMode !== undefined) meta.set('groupingMode', file.groupingMode);
    // Pictures (055): what the document stores about each one, lazy like `packs`. No bytes.
    if (file.assets !== undefined && Object.keys(file.assets).length > 0) {
      const assets = new Y.Map<YObject>();
      for (const [id, asset] of Object.entries(file.assets)) {
        assets.set(id, toY(metas.get(id) ?? metaOf(asset)) as YObject);
      }
      meta.set('assets', assets as unknown as YValue);
    }
    // Table display (041, R4): always present like `tagColors`, emitted only with entries.
    meta.set('tableDisplay', toY(file.tableDisplay ?? {}));
    // Relationship display (042): the same, so a first write on two tabs shares one map.
    meta.set('relationshipDisplay', toY(file.relationshipDisplay ?? {}));

    for (const name of COLLECTIONS) {
      const list = collectionMap(doc, name);
      const items: readonly ObjectOf<Collection>[] = file[name] ?? [];
      const keys = keysBetween(null, null, items.length);
      items.forEach((item, i) => {
        list.set(
          item.id,
          createObject(name, item as unknown as Record<string, unknown>, keys[i] ?? ''),
        );
      });
    }

    // Rules carry an order too, so every client writes the `rules` object in the same key order.
    const rules = rulesMap(doc);
    const entries = Object.entries(file.rules);
    const keys = keysBetween(null, null, entries.length);
    entries.forEach(([id, rule], i) => {
      rules.set(id, createRule(rule, keys[i] ?? ''));
    });
  });
  return doc;
}

/**
 * Reads the document back into a plain `.sododeck.json` object in canonical key order. `images` and
 * `assets` are present only when the deck has images; `assets` entries carry `data: ''` because the
 * document holds no picture bytes (`serializeDeck` fills them).
 */
export function toJSON(doc: DeckDoc): SododeckFile {
  const images = readCollection(doc, 'images');
  const assets = readAssets(doc, images);
  return canonicalize({
    ...readMeta(doc),
    nodes: readCollection(doc, 'nodes'),
    groups: readCollection(doc, 'groups'),
    edges: readCollection(doc, 'edges'),
    views: readCollection(doc, 'views'),
    features: readCollection(doc, 'features'),
    flows: readCollection(doc, 'flows'),
    rules: readRules(doc),
    stickies: readCollection(doc, 'stickies'),
    ...(images.length === 0 ? {} : { images }),
    ...(assets === undefined ? {} : { assets }),
  } as SododeckFile);
}

/**
 * Serializes a file or a document for saving/export, in canonical key order so git diffs show
 * only edits. With `bytes` (picture id → bytes) each used picture's base64 `data` is written;
 * a picture without bytes is written as missing, and pictures no image uses are dropped (055).
 */
export function serializeDeck(source: SododeckFile | DeckDoc, bytes?: AssetBytes): string {
  const file = source instanceof Y.Doc ? toJSON(source) : source;
  return `${JSON.stringify(canonicalize(attachAssets(file, bytes)), null, 2)}\n`;
}

/** Reads one object of a collection as plain data. */
export function getObject<C extends Collection>(
  doc: DeckDoc,
  c: C,
  id: Id,
): ObjectOf<C> | undefined {
  const map = collectionMap(doc, c).get(id);
  return map === undefined ? undefined : (readObject(c, id, map) as unknown as ObjectOf<C>);
}

/** Reads one rule (decision table) as plain data. */
export function getRule(doc: DeckDoc, id: Id): Rule | undefined {
  const rule = rulesMap(doc).get(id);
  return rule === undefined ? undefined : readRule(rule);
}
