/**
 * Which fields are long text, per object kind (036 research R7): every field the schema describes
 * as markdown, plus a step's `payload`. They are stored as `Y.Text`; every other string is a plain
 * value (last write wins). A schema test keeps this table complete. The database parts of 040
 * (columns, indexes, checks, enums, enum values) have plain-text notes only (research R3).
 */

export type TextKind =
  | 'meta'
  | 'nodes'
  | 'groups'
  | 'edges'
  | 'views'
  | 'features'
  | 'flows'
  | 'stickies'
  | 'step'
  | 'branch'
  | 'rule'
  | 'column'
  | 'row'
  | 'dbColumn'
  | 'dbIndex'
  | 'dbCheck'
  | 'enum'
  | 'enumValue';

export const TEXT_FIELDS: Readonly<Record<TextKind, readonly string[]>> = {
  meta: ['description'],
  nodes: ['description'],
  groups: ['description'],
  edges: ['description'],
  views: [],
  features: ['description'],
  flows: ['description'],
  stickies: ['text'],
  step: ['description', 'notes', 'payload'],
  branch: ['description'],
  rule: ['description'],
  column: [],
  row: [],
  dbColumn: [],
  dbIndex: [],
  dbCheck: [],
  enum: [],
  enumValue: [],
};

/** Long text fields that are required, so an empty one still reads as `""`. */
const REQUIRED: Readonly<Partial<Record<TextKind, readonly string[]>>> = { stickies: ['text'] };

export function isTextField(kind: TextKind, key: string): boolean {
  return TEXT_FIELDS[kind].includes(key);
}

export function isRequiredText(kind: TextKind, key: string): boolean {
  return REQUIRED[kind]?.includes(key) === true;
}
