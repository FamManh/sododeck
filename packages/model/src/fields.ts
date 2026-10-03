/**
 * Typed fields (032, ADR 0027): where a type's fields come from and what a card holds. Pure, no
 * Yjs; the app and the ops read through these helpers.
 *
 * Three sources, merged by `fieldsOfType` (research R1):
 * 1. Built-in fields (code): `tech` and `host` for Architecture types, `owner` for every type.
 *    Their values stay on `node.tech` / `node.host` / `node.owner`; a deck entry with their id
 *    stores only order and on-card choice.
 * 2. Default fields (code, `CardType.defaultFields`): used until the type is in `fieldDefaults`,
 *    after which only the deck's entries count (a deleted default stays deleted).
 * 3. Deck fields (`fields`), in deck order.
 *
 * A type's list: its code defaults, then deck fields of the type in deck order, then the built-ins
 * not stored in the deck. Built-ins come last because a card's own fields matter more (frame 124:
 * Task lists Status, Assignee, Due date, then Owner); an unstored built-in sits just before the
 * first stored built-in that follows it in code order, so built-ins keep their code order.
 */
import type { FieldDef, Id, Node, SododeckFile, TypeId } from '@sododeck/schema';

import { CARD_TYPES, cardType } from './card-types';

export type FieldSource = 'built-in' | 'default' | 'deck';

/** A field as a type lists it, with where its definition comes from. */
export interface ResolvedField extends FieldDef {
  readonly source: FieldSource;
}

type FieldDeck = Pick<SododeckFile, 'fields' | 'fieldDefaults'>;

const ARCHITECTURE_TYPES: readonly TypeId[] = CARD_TYPES.filter(
  (type) => type.pack === 'architecture',
).map((type) => type.id);

/** Tech, Host and Owner (032 FR-004), off the card until the user turns them on. */
export const BUILT_IN_FIELDS: readonly FieldDef[] = [
  { id: 'tech', name: 'Tech', kind: 'text', types: [...ARCHITECTURE_TYPES] },
  { id: 'host', name: 'Host', kind: 'text', types: [...ARCHITECTURE_TYPES] },
  { id: 'owner', name: 'Owner', kind: 'person' },
];

export type BuiltInFieldId = 'tech' | 'host' | 'owner';

const BUILT_IN_BY_ID = new Map(BUILT_IN_FIELDS.map((field, index) => [field.id, { field, index }]));

const DEFAULT_BY_ID = new Map(
  CARD_TYPES.flatMap((type) => type.defaultFields.map((field) => [field.id, field] as const)),
);

export function isBuiltInField(id: Id): id is BuiltInFieldId {
  return BUILT_IN_BY_ID.has(id);
}

/** Whether `id` is a code default field of some type (e.g. `task.status`). */
export function isDefaultField(id: Id): boolean {
  return DEFAULT_BY_ID.has(id);
}

/** Whether a field applies to cards of `typeId` (built-ins by their code types). */
export function appliesTo(field: FieldDef, typeId: TypeId): boolean {
  const types = BUILT_IN_BY_ID.get(field.id)?.field.types ?? field.types;
  return types === undefined || types.includes(typeId);
}

/** The deck's own entries, `[]` when absent. */
export function deckFields(deck: FieldDeck): readonly FieldDef[] {
  return deck.fields ?? [];
}

/** Whether `typeId`'s defaults are still the app's (not materialised into the deck). */
export function usesCodeDefaults(deck: FieldDeck, typeId: TypeId): boolean {
  return !(deck.fieldDefaults ?? []).includes(typeId);
}

const resolve = (field: FieldDef, source: FieldSource): ResolvedField => ({ ...field, source });

/** A stored built-in entry: code name, kind and types; the deck's on-card choice. */
function resolveBuiltIn(code: FieldDef, entry: FieldDef): ResolvedField {
  const out: ResolvedField = { ...code, source: 'built-in' };
  return entry.onCard === true ? { ...out, onCard: true } : out;
}

function mergeFields(deck: FieldDeck, typeId: TypeId): ResolvedField[] {
  const stored = deckFields(deck);
  const storedIds = new Set(stored.map((field) => field.id));
  const out: ResolvedField[] = [];
  if (usesCodeDefaults(deck, typeId)) {
    for (const field of cardType(typeId)?.defaultFields ?? []) {
      if (!storedIds.has(field.id)) out.push(resolve(field, 'default'));
    }
  }
  const pending = BUILT_IN_FIELDS.filter(
    (field) => appliesTo(field, typeId) && !storedIds.has(field.id),
  );
  const flushBefore = (index: number) => {
    while (pending.length > 0) {
      const next = pending[0];
      const at = next === undefined ? undefined : BUILT_IN_BY_ID.get(next.id)?.index;
      if (next === undefined || at === undefined || at >= index) return;
      out.push(resolve(next, 'built-in'));
      pending.shift();
    }
  };
  for (const field of stored) {
    const builtIn = BUILT_IN_BY_ID.get(field.id);
    if (builtIn !== undefined) {
      if (!appliesTo(builtIn.field, typeId)) continue;
      flushBefore(builtIn.index);
      out.push(resolveBuiltIn(builtIn.field, field));
    } else if (appliesTo(field, typeId)) {
      out.push(resolve(field, 'deck'));
    }
  }
  for (const field of pending) out.push(resolve(field, 'built-in'));
  return out;
}

// Memoised per field list (and `fieldDefaults`) identity and type, so 500 cards of one type
// share one list and the snapshot's structural sharing keeps it alive between edits (R10).
const NONE = {};
const memo = new WeakMap<object, WeakMap<object, Map<TypeId, readonly ResolvedField[]>>>();

/** A type's fields: code defaults (until materialised), deck fields, then built-ins. */
export function fieldsOfType(deck: FieldDeck, typeId: TypeId): readonly ResolvedField[] {
  const byFields =
    memo.get(deck.fields ?? NONE) ?? new WeakMap<object, Map<TypeId, readonly ResolvedField[]>>();
  memo.set(deck.fields ?? NONE, byFields);
  const byDefaults =
    byFields.get(deck.fieldDefaults ?? NONE) ?? new Map<TypeId, readonly ResolvedField[]>();
  byFields.set(deck.fieldDefaults ?? NONE, byDefaults);
  let fields = byDefaults.get(typeId);
  if (fields === undefined) {
    fields = mergeFields(deck, typeId);
    byDefaults.set(typeId, fields);
  }
  return fields;
}

/**
 * A card's fields: its type's, plus Tech / Host when the card holds a value for them although its
 * type does not list them (a card whose type changed keeps showing what it holds, FR-004).
 */
export function fieldsOfNode(deck: FieldDeck, node: Node): readonly ResolvedField[] {
  const fields = fieldsOfType(deck, node.type);
  const extra = BUILT_IN_FIELDS.filter(
    (field) =>
      !fields.some((listed) => listed.id === field.id) && hasValue(valueOf(node, field.id)),
  );
  if (extra.length === 0) return fields;
  const owner = fields.findIndex((field) => field.id === 'owner');
  const at = owner === -1 ? fields.length : owner;
  return [...fields.slice(0, at), ...extra.map((f) => resolve(f, 'built-in')), ...fields.slice(at)];
}

/** A field by id: the deck entry (built-ins keep code name and kind), else the code definition. */
export function findField(deck: FieldDeck, id: Id): ResolvedField | undefined {
  const entry = deckFields(deck).find((field) => field.id === id);
  const builtIn = BUILT_IN_BY_ID.get(id)?.field;
  if (builtIn !== undefined) {
    return entry === undefined ? resolve(builtIn, 'built-in') : resolveBuiltIn(builtIn, entry);
  }
  if (entry !== undefined) return resolve(entry, 'deck');
  const code = DEFAULT_BY_ID.get(id);
  return code === undefined ? undefined : resolve(code, 'default');
}

/** A card's value for a field: built-ins read their own node key. */
export function valueOf(node: Node, fieldId: Id): unknown {
  if (isBuiltInField(fieldId)) return node[fieldId];
  return node.values?.[fieldId];
}

/** A value counts as held unless absent or an empty string. */
export function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/** Cards holding a value for the field (or, with `optionId`, holding that option). */
export function fieldUsage(deck: Pick<SododeckFile, 'nodes'>, fieldId: Id, optionId?: Id): number {
  let count = 0;
  for (const node of deck.nodes) {
    const value = valueOf(node, fieldId);
    if (optionId === undefined ? hasValue(value) : value === optionId) count++;
  }
  return count;
}

/** Person identity: trimmed, spaces collapsed, lower-cased (like tags, 033). */
export function personKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Ids of every person field in the deck or the code defaults. */
function personFieldIds(deck: FieldDeck): Set<Id> {
  const ids = new Set<Id>();
  for (const field of DEFAULT_BY_ID.values()) if (field.kind === 'person') ids.add(field.id);
  for (const field of deckFields(deck)) {
    if (field.kind === 'person') ids.add(field.id);
    else ids.delete(field.id);
  }
  return ids;
}

const spellings = new WeakMap<object, { fields: unknown; map: Map<string, string> }>();

/** Person key → the first spelling used in the deck (owners and person values, node order). */
function personSpellings(deck: Pick<SododeckFile, 'nodes' | 'fields' | 'fieldDefaults'>) {
  const cached = spellings.get(deck.nodes);
  if (cached !== undefined && cached.fields === deck.fields) return cached.map;
  const ids = personFieldIds(deck);
  const out = new Map<string, string>();
  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const key = personKey(value);
    if (key !== '' && !out.has(key)) out.set(key, value.trim());
  };
  for (const node of deck.nodes) {
    add(node.owner);
    for (const [id, value] of Object.entries(node.values ?? {})) if (ids.has(id)) add(value);
  }
  spellings.set(deck.nodes, { fields: deck.fields, map: out });
  return out;
}

/** Names already used for a person in the deck, once each ignoring case, sorted (FR-014b). */
export function personSuggestions(
  deck: Pick<SododeckFile, 'nodes' | 'fields' | 'fieldDefaults'>,
): readonly string[] {
  return [...personSpellings(deck).values()].sort((a, b) => a.localeCompare(b));
}

/** The deck's existing spelling of a name (ignoring case and spacing), else the trimmed text. */
export function canonicalPerson(
  deck: Pick<SododeckFile, 'nodes' | 'fields' | 'fieldDefaults'>,
  text: string,
): string {
  return personSpellings(deck).get(personKey(text)) ?? text.trim();
}
