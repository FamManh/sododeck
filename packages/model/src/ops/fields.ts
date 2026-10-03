/**
 * Typed field operations (032, ADR 0027, research R4). Each op validates first, then writes in one
 * transaction (one undo step) including the values it touches.
 *
 * Definitions live in `meta.fields` (a layout-2 list, each item with an `options` list) and
 * `meta.fieldDefaults`; values in one `$value:<field>` key per card (text.ts). Built-in values
 * stay on `node.tech` / `host` / `owner`.
 *
 * Materialising (R1): before an op changes a code default field, the whole default set of its
 * type is written into `fields` and the type joins `fieldDefaults`, in the same transaction. A
 * built-in gets a deck entry (order and on-card only) when it is turned on the card or moved.
 * Entries are inserted where the type's list already shows them, so materialising never reorders.
 */
import type {
  ColorRef,
  FieldDef,
  FieldKind,
  FieldOption,
  Id,
  SododeckFile,
  StatusIcon,
  TypeId,
} from '@sododeck/schema';
import * as Y from 'yjs';

import { CARD_TYPES, cardType, typeName } from '../card-types';
import { fromY, jsonEqual, toY, type YObject, type YValue } from '../convert';
import { DeckEditError } from '../errors';
import { planKindChange, validateValue } from '../field-values';
import {
  appliesTo,
  BUILT_IN_FIELDS,
  canonicalPerson,
  fieldsOfType,
  findField,
  isBuiltInField,
  usesCodeDefaults,
  type ResolvedField,
} from '../fields';
import {
  childList,
  collectionMap,
  fieldDefaultsMap,
  fieldsList,
  insertAt,
  metaMap,
  orderedEntries,
  planMove,
  type ListMap,
} from '../layout';
import { readCollection, readFieldDefaults, readFields } from '../read';
import { valueKey } from '../text';
import { assertValid, validateObject } from '../validate';
import { createField, createOption, createOptionList, writeField } from '../write';
import type { EditContext } from './context';

export type NewFieldOption = Omit<FieldOption, 'id'> & { id?: Id };
/** A new field: its definition without id; options may come without ids. */
export type NewField = Omit<FieldDef, 'id' | 'options'> & { options?: NewFieldOption[] };
/** What `updateField` may change; `unit: null` clears the unit. */
export interface FieldPatch {
  name?: string;
  types?: TypeId[];
  onCard?: boolean;
  unit?: string | null;
}
/** What `updateOption` may change; `null` clears the colour or icon. */
export interface OptionPatch {
  label?: string;
  color?: ColorRef | null;
  icon?: StatusIcon | null;
}

type FieldDeck = Pick<SododeckFile, 'fields' | 'fieldDefaults'>;

const BUILT_IN_ORDER = new Map(BUILT_IN_FIELDS.map((field, index) => [field.id, index]));

function invalid(path: string, message: string): never {
  throw new DeckEditError('invalid', [{ path, message }]);
}

function fieldDeck(ctx: EditContext): FieldDeck {
  return { fields: readFields(ctx.doc), fieldDefaults: readFieldDefaults(ctx.doc) };
}

function fullDeck(ctx: EditContext): FieldDeck & Pick<SododeckFile, 'nodes'> {
  return { ...fieldDeck(ctx), nodes: readCollection(ctx.doc, 'nodes') };
}

function requireField(deck: FieldDeck, id: Id): ResolvedField {
  const field = findField(deck, id);
  if (field === undefined) {
    throw new DeckEditError('not-found', [{ path: '', message: `Field "${id}" does not exist.` }]);
  }
  return field;
}

/** The plain definition of a resolved field (no `source`). */
function plain(field: ResolvedField): FieldDef {
  const { source: _source, ...def } = field;
  return def;
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Name rules (FR-013, AS5): not empty, at most 64, unique within each of its types ignoring case. */
function assertName(
  deck: FieldDeck,
  name: string,
  types: readonly TypeId[] | undefined,
  exceptId?: Id,
): void {
  const trimmed = name.trim();
  if (trimmed === '') invalid('name', 'A field needs a name.');
  if (trimmed.length > 64) invalid('name', 'A field name has at most 64 characters.');
  for (const type of types ?? CARD_TYPES.map((t) => t.id)) {
    const clash = fieldsOfType(deck, type).find(
      (field) => field.id !== exceptId && nameKey(field.name) === nameKey(trimmed),
    );
    if (clash !== undefined) {
      invalid('name', `${typeName(type)} already has a field named "${clash.name}".`);
    }
  }
}

function isChoice(kind: FieldKind): boolean {
  return kind === 'select' || kind === 'status';
}

/** `meta.fields`, created on the first field definition change (inside a transaction). */
function attachedFields(ctx: EditContext): ListMap {
  const existing = fieldsList(ctx.doc);
  if (existing !== undefined) return existing;
  const list = new Y.Map<YObject>();
  metaMap(ctx.doc).set('fields', list as unknown as YValue);
  return list;
}

/** Index of the first stored field that `typeId` lists (or the end of the list). */
function firstIndexFor(list: ListMap, typeId: TypeId): number {
  const entries = orderedEntries(list);
  const index = entries.findIndex(([id, item]) => {
    const types = fromY(item.get('types'));
    return appliesTo({ id, name: '', kind: 'text', types: types as TypeId[] | undefined }, typeId);
  });
  return index === -1 ? entries.length : index;
}

/**
 * Writes `typeId`'s code defaults into `fields` (before the first stored field of the type, so
 * the list keeps its order) and records the type in `fieldDefaults`. No-op once materialised.
 */
function materialiseDefaults(ctx: EditContext, typeId: TypeId): void {
  if (!usesCodeDefaults({ fieldDefaults: readFieldDefaults(ctx.doc) }, typeId)) return;
  const list = attachedFields(ctx);
  const at = firstIndexFor(list, typeId);
  let offset = 0;
  for (const field of cardType(typeId)?.defaultFields ?? []) {
    if (list.has(field.id)) continue;
    insertAt(list, field.id, createField(field, ''), at + offset);
    offset++;
  }
  const meta = metaMap(ctx.doc);
  let map = fieldDefaultsMap(ctx.doc);
  if (map === undefined) {
    map = new Y.Map<YValue>();
    meta.set('fieldDefaults', map);
  }
  map.set(typeId, true);
}

/**
 * Gives a built-in a deck entry (name and kind only), placed before the first stored built-in
 * that follows it in code order, else at the end: where every type's list already shows it.
 */
function storeBuiltIn(ctx: EditContext, id: Id): YObject {
  const list = attachedFields(ctx);
  const existing = list.get(id);
  if (existing !== undefined) return existing;
  const code = BUILT_IN_FIELDS.find((field) => field.id === id);
  if (code === undefined) throw new Error(`Not a built-in field: ${id}`);
  const rank = BUILT_IN_ORDER.get(id) ?? 0;
  const entries = orderedEntries(list);
  const later = entries.findIndex(([other]) => (BUILT_IN_ORDER.get(other) ?? -1) > rank);
  const item = createField({ id, name: code.name, kind: code.kind }, '');
  insertAt(list, id, item, later === -1 ? entries.length : later);
  return item;
}

/** Makes a field's definition stored (materialising its type or storing the built-in). */
function storedEntry(ctx: EditContext, field: ResolvedField): YObject {
  if (field.source === 'built-in') return storeBuiltIn(ctx, field.id);
  if (field.source === 'default') {
    const type = field.types?.[0];
    if (type !== undefined) materialiseDefaults(ctx, type);
  }
  const entry = fieldsList(ctx.doc)?.get(field.id);
  if (entry === undefined) throw new Error(`Field "${field.id}" is not stored.`);
  return entry;
}

function setKey(map: YObject, key: string, value: unknown): void {
  if (value === undefined) {
    if (map.has(key)) map.delete(key);
  } else if (!jsonEqual(fromY(map.get(key)), value)) {
    map.set(key, toY(value));
  }
}

/** Removes `fieldId`'s value from every card for which `drop(value)` holds. */
function dropValues(ctx: EditContext, fieldId: Id, drop: (value: unknown) => boolean): void {
  const key = valueKey(fieldId);
  for (const node of collectionMap(ctx.doc, 'nodes').values()) {
    if (node.has(key) && drop(fromY(node.get(key)))) node.delete(key);
  }
}

function withOptionIds(ctx: EditContext, options: readonly NewFieldOption[]): FieldOption[] {
  return options.map((option) => ({ ...option, id: option.id ?? ctx.allocate('option') }));
}

function assertOptionLabels(options: readonly FieldOption[]): void {
  const seen = new Set<string>();
  options.forEach((option, index) => {
    const key = nameKey(option.label);
    if (key === '') invalid(`options.${String(index)}.label`, 'An option needs a label.');
    if (seen.has(key)) {
      invalid(`options.${String(index)}.label`, `There is already an option "${option.label}".`);
    }
    seen.add(key);
  });
}

/** Adds a field at the end of the deck's list (or after `after`) and returns its id. */
export function addField(ctx: EditContext, data: NewField, opts: { after?: Id } = {}): Id {
  const deck = fieldDeck(ctx);
  assertName(deck, data.name, data.types);
  if (data.types?.length === 0) invalid('types', 'A field applies to at least one card type.');
  const id = ctx.allocate('field');
  const { options: newOptions, onCard, ...rest } = data;
  const def: FieldDef = { ...rest, id, name: data.name.trim() };
  if (onCard === true) def.onCard = true;
  if (newOptions !== undefined) {
    def.options = withOptionIds(ctx, newOptions).map((o) => ({ ...o, label: o.label.trim() }));
  }
  if (def.options !== undefined) assertOptionLabels(def.options);
  assertValid(validateObject('field', def));
  ctx.transact(() => {
    const list = attachedFields(ctx);
    const entries = orderedEntries(list);
    const after = opts.after === undefined ? -1 : entries.findIndex(([e]) => e === opts.after);
    insertAt(list, id, createField(def, ''), after === -1 ? undefined : after + 1);
  });
  return id;
}

/** Renames, retargets, shows / hides on the card or sets the unit of a field. */
export function updateField(ctx: EditContext, id: Id, patch: FieldPatch): void {
  const deck = fieldDeck(ctx);
  const field = requireField(deck, id);
  if (
    field.source === 'built-in' &&
    (patch.name !== undefined || patch.types !== undefined || patch.unit !== undefined)
  ) {
    invalid('', `${field.name} is built in: it can only be reordered or shown on the card.`);
  }
  const candidate: FieldDef = { ...plain(field) };
  if (patch.name !== undefined) candidate.name = patch.name.trim();
  if (patch.types !== undefined) {
    if (patch.types.length === 0) invalid('types', 'A field applies to at least one card type.');
    candidate.types = [...patch.types];
  }
  if (patch.onCard !== undefined) {
    if (patch.onCard) candidate.onCard = true;
    else delete candidate.onCard;
  }
  if (patch.unit === null) delete candidate.unit;
  else if (patch.unit !== undefined) candidate.unit = patch.unit.trim();
  if (patch.name !== undefined || patch.types !== undefined) {
    assertName(deck, candidate.name, candidate.types, id);
  }
  assertValid(validateObject('field', candidate));
  const key = patch.name !== undefined || patch.unit !== undefined ? `field:${id}` : undefined;
  ctx.transact(() => {
    const entry = storedEntry(ctx, field);
    if (field.source === 'built-in') {
      setKey(entry, 'onCard', candidate.onCard);
      return;
    }
    setKey(entry, 'name', candidate.name);
    setKey(entry, 'types', candidate.types);
    setKey(entry, 'onCard', candidate.onCard);
    setKey(entry, 'unit', candidate.unit);
  }, key);
}

/**
 * Moves field `id` before `beforeId` (or to the end) in `typeId`'s list. The type's code fields
 * are stored first, so the order of every field the type shows is explicit.
 */
export function moveField(ctx: EditContext, id: Id, beforeId: Id | null, typeId: TypeId): void {
  const deck = fieldDeck(ctx);
  requireField(deck, id);
  if (beforeId !== null) requireField(deck, beforeId);
  if (beforeId === id) return;
  ctx.transact(() => {
    materialiseDefaults(ctx, typeId);
    for (const field of BUILT_IN_FIELDS) {
      if (appliesTo(field, typeId)) storeBuiltIn(ctx, field.id);
    }
    const list = attachedFields(ctx);
    const rest = orderedEntries(list)
      .map(([entry]) => entry)
      .filter((entry) => entry !== id);
    const before = beforeId === null ? -1 : rest.indexOf(beforeId);
    planMove(list, id, before === -1 ? rest.length : before)?.();
  });
}

/** Deletes a field and every value it holds, in one step. Built-ins cannot be deleted. */
export function deleteField(ctx: EditContext, id: Id): void {
  const field = requireField(fieldDeck(ctx), id);
  if (field.source === 'built-in') invalid('', `${field.name} is built in and cannot be deleted.`);
  ctx.transact(() => {
    storedEntry(ctx, field);
    fieldsList(ctx.doc)?.delete(id);
    dropValues(ctx, id, () => true);
  });
}

function requireChoice(deck: FieldDeck, fieldId: Id): ResolvedField {
  const field = requireField(deck, fieldId);
  if (!isChoice(field.kind)) {
    invalid('options', `Only select and status fields have options; "${field.name}" does not.`);
  }
  return field;
}

function optionsList(entry: YObject): ListMap {
  const existing = childList(entry, 'options');
  if (existing !== undefined) return existing;
  const list = createOptionList([]);
  entry.set('options', list as unknown as YValue);
  return list;
}

/** Adds an option at the end (or after `after`) and returns its id. */
export function addOption(
  ctx: EditContext,
  fieldId: Id,
  option: NewFieldOption,
  opts: { after?: Id } = {},
): Id {
  const field = requireChoice(fieldDeck(ctx), fieldId);
  const id = option.id ?? ctx.allocate('option');
  const added: FieldOption = { ...option, id, label: option.label.trim() };
  const options = [...(field.options ?? []), added];
  assertOptionLabels(options);
  assertValid(validateObject('field', { ...plain(field), options }));
  ctx.transact(() => {
    const list = optionsList(storedEntry(ctx, field));
    const entries = orderedEntries(list);
    const after = opts.after === undefined ? -1 : entries.findIndex(([e]) => e === opts.after);
    insertAt(list, id, createOption(added, ''), after === -1 ? undefined : after + 1);
  });
  return id;
}

function requireOption(field: ResolvedField, optionId: Id): FieldOption {
  const option = field.options?.find((candidate) => candidate.id === optionId);
  if (option === undefined) {
    throw new DeckEditError('not-found', [
      { path: '', message: `Option "${optionId}" of field "${field.id}" does not exist.` },
    ]);
  }
  return option;
}

/** Renames, recolours or changes the icon of an option. */
export function updateOption(
  ctx: EditContext,
  fieldId: Id,
  optionId: Id,
  patch: OptionPatch,
): void {
  const field = requireChoice(fieldDeck(ctx), fieldId);
  const next: FieldOption = { ...requireOption(field, optionId) };
  if (patch.label !== undefined) next.label = patch.label.trim();
  if (patch.color === null) delete next.color;
  else if (patch.color !== undefined) next.color = patch.color;
  if (patch.icon === null) delete next.icon;
  else if (patch.icon !== undefined) next.icon = patch.icon;
  const options = (field.options ?? []).map((o) => (o.id === optionId ? next : o));
  assertOptionLabels(options);
  assertValid(validateObject('field', { ...plain(field), options }));
  ctx.transact(
    () => {
      const item = optionsList(storedEntry(ctx, field)).get(optionId);
      if (item === undefined) return;
      setKey(item, 'label', next.label);
      setKey(item, 'color', next.color);
      setKey(item, 'icon', next.icon);
    },
    patch.label !== undefined ? `option:${fieldId}:${optionId}` : undefined,
  );
}

/** Moves an option before `beforeId` (or to the end). */
export function moveOption(ctx: EditContext, fieldId: Id, optionId: Id, beforeId: Id | null): void {
  const field = requireChoice(fieldDeck(ctx), fieldId);
  requireOption(field, optionId);
  if (beforeId !== null) requireOption(field, beforeId);
  if (beforeId === optionId) return;
  ctx.transact(() => {
    const list = optionsList(storedEntry(ctx, field));
    const rest = orderedEntries(list)
      .map(([entry]) => entry)
      .filter((entry) => entry !== optionId);
    const before = beforeId === null ? -1 : rest.indexOf(beforeId);
    planMove(list, optionId, before === -1 ? rest.length : before)?.();
  });
}

/** Deletes an option and clears the values that use it, in one step. */
export function deleteOption(ctx: EditContext, fieldId: Id, optionId: Id): void {
  const field = requireChoice(fieldDeck(ctx), fieldId);
  requireOption(field, optionId);
  ctx.transact(() => {
    optionsList(storedEntry(ctx, field)).delete(optionId);
    dropValues(ctx, fieldId, (value) => value === optionId);
  });
}

/**
 * Changes a field's kind (R6): values that convert are kept, the rest cleared, all in one step.
 * Built-ins never change kind.
 */
export function changeFieldKind(ctx: EditContext, id: Id, kind: FieldKind): void {
  const deck = fullDeck(ctx);
  const field = requireField(deck, id);
  if (field.source === 'built-in') invalid('kind', `${field.name} is built in: its kind is fixed.`);
  if (field.kind === kind) return;
  const plan = planKindChange(deck, id, kind, () => ctx.allocate('option'));
  const candidate: FieldDef = { ...plain(field), kind };
  if (kind !== 'number') delete candidate.unit;
  if (plan.options === undefined || (plan.options.length === 0 && field.options === undefined)) {
    delete candidate.options;
  } else {
    candidate.options = plan.options;
  }
  assertValid(validateObject('field', candidate));
  ctx.transact(() => {
    const entry = storedEntry(ctx, field);
    entry.set('kind', kind);
    setKey(entry, 'unit', candidate.unit);
    if (candidate.options === undefined) {
      if (entry.has('options')) entry.delete('options');
    } else if (isChoice(field.kind) && childList(entry, 'options') !== undefined) {
      // Select ↔ status keep their option maps (and ids); only icons are dropped for select.
      for (const option of optionsList(entry).values()) {
        if (kind === 'select' && option.has('icon')) option.delete('icon');
      }
    } else {
      entry.set('options', createOptionList(candidate.options) as unknown as YValue);
    }
    const nodes = collectionMap(ctx.doc, 'nodes');
    const key = valueKey(id);
    for (const [nodeId, value] of plan.values) {
      const node = nodes.get(nodeId);
      if (node === undefined) continue;
      if (value === null) node.delete(key);
      else setKey(node, key, value);
    }
  });
}

/**
 * Sets (or clears with `null`) one field's value on every listed card, in one step. Validates
 * against the field (FR-015); person values take the deck's existing spelling (FR-014b);
 * built-ins write `node.tech` / `host` / `owner`. Setting a value never materialises definitions.
 */
export function setValues(
  ctx: EditContext,
  nodeIds: readonly Id[],
  fieldId: Id,
  value: unknown,
): void {
  const deck = fieldDeck(ctx);
  const field = requireField(deck, fieldId);
  const nodes = collectionMap(ctx.doc, 'nodes');
  const missing = nodeIds.filter((id) => !nodes.has(id));
  if (missing.length > 0) {
    throw new DeckEditError(
      'not-found',
      missing.map((id) => ({ path: '', message: `Component "${id}" does not exist.` })),
    );
  }
  let next: unknown = value;
  if (next !== null) {
    if (field.kind === 'person' && typeof next === 'string') {
      next = canonicalPerson({ ...deck, nodes: readCollection(ctx.doc, 'nodes') }, next);
    }
    const message = validateValue(field, next);
    if (message !== null) invalid(`values.${fieldId}`, message);
  }
  ctx.transact(
    () => {
      for (const id of nodeIds) {
        const node = nodes.get(id);
        if (node === undefined) continue;
        if (isBuiltInField(fieldId)) {
          const current = node.get(fieldId);
          const stored = next === null ? undefined : next;
          if (current !== stored) writeField(node, 'nodes', fieldId, stored);
        } else {
          setKey(node, valueKey(fieldId), next === null ? undefined : next);
        }
      }
    },
    `values:${fieldId}:${nodeIds.join(',')}`,
  );
}
