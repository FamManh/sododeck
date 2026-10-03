/**
 * Typed field values (032): what a value of each kind must look like, and how a value survives a
 * kind change (clarify Q2, research R6). Pure.
 *
 * The file format accepts any string / number / `{ from, to }` / `{ url, label? }` for any field
 * (dangling values load); these rules are what the editor writes and what Problems checks.
 */
import type { FieldDef, FieldKind, FieldOption, Id, SododeckFile } from '@sododeck/schema';

import { isRecord } from './convert';
import { findField, hasValue, isBuiltInField, valueOf } from './fields';

export const FIELD_KINDS: readonly FieldKind[] = [
  'text',
  'number',
  'select',
  'status',
  'person',
  'date',
  'dateRange',
  'link',
  'progress',
];

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LINK = /^(https?:\/\/\S+|mailto:\S+)$/i;

/** A real calendar date written `YYYY-MM-DD` (no time, no time zone). */
export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE.exec(value);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isLinkUrl(value: unknown): value is string {
  return typeof value === 'string' && LINK.test(value.trim());
}

/** Why `value` cannot be stored in `field`, or null when it can (FR-002, FR-015). */
export function validateValue(
  field: Pick<FieldDef, 'kind' | 'options'>,
  value: unknown,
): string | null {
  switch (field.kind) {
    case 'text':
      return typeof value === 'string' && value.trim() !== '' ? null : 'Enter some text.';
    case 'person':
      return typeof value === 'string' && value.trim() !== '' ? null : 'Enter a name.';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'Enter a number.';
    case 'progress':
      return typeof value === 'number' && value >= 0 && value <= 100
        ? null
        : 'Enter a number from 0 to 100.';
    case 'select':
    case 'status':
      return typeof value === 'string' && (field.options ?? []).some((o) => o.id === value)
        ? null
        : 'Pick one of the options.';
    case 'date':
      return isDateString(value) ? null : 'Enter a date as YYYY-MM-DD.';
    case 'dateRange': {
      if (!isRecord(value) || !isDateString(value.from) || !isDateString(value.to)) {
        return 'Enter a start and an end date.';
      }
      return value.to < value.from ? 'The end is before the start.' : null;
    }
    case 'link':
      return isRecord(value) &&
        isLinkUrl(value.url) &&
        (value.label === undefined || typeof value.label === 'string')
        ? null
        : 'Enter a web (http, https) or mail (mailto) address.';
  }
}

function labelOf(options: readonly FieldOption[] | undefined, id: unknown): string | undefined {
  return options?.find((option) => option.id === id)?.label;
}

/**
 * `value` of field `from` as a value of kind `to.kind` (clarify Q2), or null when it is cleared.
 * Kept: text ↔ person; select ↔ status (same option ids); number ↔ progress (0–100 only);
 * number, date, select / status (label), person, link (address) → text; text → number when it
 * reads as one; date → one-day range; range → its start; text → the option with that label.
 */
export function convertValue(
  from: Pick<FieldDef, 'kind' | 'options'>,
  to: { kind: FieldKind; options?: readonly FieldOption[] },
  value: unknown,
): unknown {
  const converted = rawConvert(from, to, value);
  if (converted === null) return null;
  // Select ↔ status carry their options when the caller passes none.
  const options = to.options ?? (isChoice(from.kind) ? from.options : undefined);
  return validateValue(
    { kind: to.kind, options: options ? [...options] : undefined },
    converted,
  ) === null
    ? converted
    : null;
}

const isChoice = (kind: FieldKind) => kind === 'select' || kind === 'status';

function rawConvert(
  from: Pick<FieldDef, 'kind' | 'options'>,
  to: { kind: FieldKind; options?: readonly FieldOption[] },
  value: unknown,
): unknown {
  if (from.kind === to.kind) return value;
  if (isChoice(from.kind) && isChoice(to.kind)) return value;
  switch (to.kind) {
    case 'text':
      switch (from.kind) {
        case 'person':
        case 'date':
          return value;
        case 'number':
        case 'progress':
          return typeof value === 'number' ? String(value) : null;
        case 'select':
        case 'status':
          return labelOf(from.options, value) ?? null;
        case 'link':
          return isRecord(value) ? (value.url ?? null) : null;
        default:
          return null;
      }
    case 'person':
      return from.kind === 'text' ? value : null;
    case 'number':
      if (from.kind === 'progress') return value;
      if (from.kind === 'text' && typeof value === 'string' && value.trim() !== '') {
        const number = Number(value.trim());
        return Number.isFinite(number) ? number : null;
      }
      return null;
    case 'progress':
      return from.kind === 'number' ? value : null;
    case 'select':
    case 'status': {
      if (from.kind !== 'text' || typeof value !== 'string') return null;
      const label = value.trim().slice(0, 48);
      return to.options?.find((option) => option.label === label)?.id ?? null;
    }
    case 'dateRange':
      return from.kind === 'date' ? { from: value, to: value } : null;
    case 'date':
      return from.kind === 'dateRange' && isRecord(value) ? (value.from ?? null) : null;
    case 'link':
      return null;
  }
}

/** What changing a field's kind does: its new options and every card's new value (null = cleared). */
export interface KindChangePlan {
  /** The options the field gets (select / status), or undefined for other kinds. */
  options: FieldOption[] | undefined;
  /** Node id → converted value, or null when it is cleared. Only cards holding a value. */
  values: Map<Id, unknown>;
  cleared: number;
}

/**
 * Plans a kind change (R6). Select ↔ status carry their options (select drops status icons);
 * text → select / status makes one option per distinct trimmed text, in first-seen order, with
 * ids from `newOptionId`.
 */
export function planKindChange(
  deck: Pick<SododeckFile, 'nodes' | 'fields' | 'fieldDefaults'>,
  fieldId: Id,
  kind: FieldKind,
  newOptionId: (index: number) => Id = (index) => `option-${String(index)}`,
): KindChangePlan {
  const field = findField(deck, fieldId);
  const values = new Map<Id, unknown>();
  if (field === undefined || isBuiltInField(fieldId))
    return { options: undefined, values, cleared: 0 };
  const choice = kind === 'select' || kind === 'status';
  let options: FieldOption[] | undefined;
  if (choice && (field.kind === 'select' || field.kind === 'status')) {
    options = (field.options ?? []).map((option) => {
      if (kind === 'status') return { ...option };
      const { icon: _icon, ...rest } = option;
      return rest;
    });
  } else if (choice && field.kind === 'text') {
    const labels: string[] = [];
    for (const node of deck.nodes) {
      const value = valueOf(node, fieldId);
      if (typeof value !== 'string') continue;
      const label = value.trim().slice(0, 48);
      if (label !== '' && !labels.includes(label)) labels.push(label);
    }
    options = labels.map((label, index) => ({ id: newOptionId(index), label }));
  } else if (choice) {
    options = [];
  }
  let cleared = 0;
  for (const node of deck.nodes) {
    const value = valueOf(node, fieldId);
    if (!hasValue(value)) continue;
    const next = convertValue(field, { kind, options }, value);
    values.set(node.id, next);
    if (next === null) cleared++;
  }
  return { options, values, cleared };
}

/** How many values changing the field to `kind` would clear (for "N values will be cleared"). */
export function clearedByKindChange(
  deck: Pick<SododeckFile, 'nodes' | 'fields' | 'fieldDefaults'>,
  fieldId: Id,
  kind: FieldKind,
): number {
  return planKindChange(deck, fieldId, kind).cleared;
}
