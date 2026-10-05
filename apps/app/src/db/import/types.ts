/**
 * Types of the schema import (044, data-model.md). Everything under `db/import` except
 * `import-client.ts`, `place-import.ts` and `apply-import.ts` is pure: text and an
 * `ImportTarget` in, plain data out. No React, DOM, Yjs or `editor/` imports.
 */
import type { Fragment, NewDbEnum } from '@sododeck/model';
import type { Cardinality, DbAction, Dialect, Id, StickyColor } from '@sododeck/schema';

import type { SqlDialect } from '../export/types';

export type { SqlDialect };

export type ImportFormat = 'sql' | 'dbml';

/** What the dialog sends: the text and the user's choices (data-model "ImportSource"). */
export interface ImportSource {
  text: string;
  fileName?: string;
  format: 'auto' | ImportFormat;
  /** SQL only; `auto` → detected (research R4). */
  dialect: 'auto' | SqlDialect;
  detectFk: boolean;
}

/** Where the import goes and what the target deck already holds (data-model "ImportTarget"). */
export interface ImportTarget {
  kind: 'card' | 'deck' | 'new-deck';
  cardId?: Id;
  /** `generic` for a new deck. */
  deckDialect: Dialect;
  deckHasTables: boolean;
  /** A DBML project note becomes the deck description only when the deck has none. */
  deckHasDescription: boolean;
  tableNames: readonly { schema?: string; name: string }[];
  enumNames: readonly { schema?: string; name: string }[];
}

/** FR-007…FR-009: what happens to the deck's dialect. */
export type DialectOutcome = 'set' | 'convert' | 'keep-generic' | 'same';

export interface ParseError {
  /** 1-based line in the source text. */
  line: number;
  column?: number;
  message: string;
}

export interface TypeConversion {
  from: string;
  to: string;
  count: number;
}

export interface ImportCounts {
  tables: number;
  relationships: number;
  enums: number;
}

export interface ImportPreview {
  format: ImportFormat;
  detectedDialect: SqlDialect | null;
  /** The dialect the import is read as (picked, detected, or the fallback grammar). */
  dialect: SqlDialect | null;
  counts: ImportCounts;
  skippedCount: number;
  conversions: TypeConversion[];
  dialectOutcome: DialectOutcome;
  error?: ParseError;
}

/** Why a statement or clause was not mapped (FR-017). Text per reason in `report-text.ts`. */
export type SkipReason =
  | 'view'
  | 'function'
  | 'procedure'
  | 'trigger'
  | 'grant'
  | 'policy'
  | 'partition'
  | 'sequence'
  | 'extension'
  | 'schema'
  | 'data'
  | 'session'
  | 'drop-or-rename'
  | 'alter'
  | 'dangling-fk'
  | 'unknown-table'
  | 'parse-error'
  | 'unknown';

export interface SkippedEntry {
  line: number;
  excerpt: string;
  reason: SkipReason;
  /** Replaces the reason's text when the reason needs a name ("references accounts, …"). */
  detail?: string;
}

export type ChangeKind =
  | 'type-converted'
  | 'type-kept'
  | 'option-dropped'
  | 'renamed-duplicate'
  | 'name-exists'
  | 'enum-name-exists'
  | 'schema-dropped';

export interface ChangedEntry {
  line?: number;
  /** `renamed-duplicate`: the line of the first declaration, kept under its name (062). */
  firstLine?: number;
  /** What changed, e.g. `orders.status` or `orders`. */
  target: string;
  kind: ChangeKind;
  detail: string;
}

export interface MappedCounts {
  tables: number;
  relationships: number;
  enums: number;
  indexes: number;
  checks: number;
  groups: number;
  stickies: number;
}

/** A foreign key guessed from a column name (FR-024). Ids are plan ids until remapped. */
export interface FkSuggestion {
  fromTable: Id;
  fromColumn: Id;
  toTable: Id;
  toColumn: Id;
  /** "orders.customer_id → customers.id". */
  label: string;
  cardinality: Cardinality;
  fromOptional: boolean;
}

export type SuggestionState = 'open' | 'accepted' | 'dismissed';

export interface ImportReport {
  source: { fileName?: string; format: ImportFormat; dialect: SqlDialect | null };
  mapped: MappedCounts;
  skipped: SkippedEntry[];
  changed: ChangedEntry[];
  /** `null` when the option was off (no section). */
  suggestions: (FkSuggestion & { state: SuggestionState; edgeId?: Id })[] | null;
}

export interface PlanEnum extends NewDbEnum {
  planId: Id;
}

export interface PlanSticky {
  text: string;
  color?: StickyColor;
}

/** The result of parsing and mapping, before anything is written (data-model "ImportPlan"). */
export interface ImportPlan {
  /** Tables, relationship edges and groups with plan-local ids; `enumRef` = plan enum ids. */
  fragment: Fragment;
  enums: PlanEnum[];
  stickies: PlanSticky[];
  /** The deck description to set (DBML project note on a deck without one). */
  description?: string;
  setDialect: Dialect | null;
  dialectOutcome: DialectOutcome;
  conversions: TypeConversion[];
  report: ImportReport;
  suggestions: FkSuggestion[];
}

// ---------------------------------------------------------------------------------------------
// RawSchema: the neutral shape both readers produce, so one `buildPlan` maps SQL and DBML.

export type RawDefault =
  { kind: 'value'; value: string | number | boolean } | { kind: 'expr'; expr: string };

export interface RawColumn {
  name: string;
  /** As written, lower case, size still inside (`varchar(255)`); `''` when untyped. */
  type: string;
  /** Schema of a qualified type (`billing.status`), for enum lookup. */
  typeSchema?: string;
  pk?: boolean;
  notNull?: boolean;
  unique?: boolean;
  increment?: boolean;
  default?: RawDefault;
  check?: string;
  note?: string;
  /** MySQL inline `ENUM(…)` values. */
  enumValues?: string[];
  line: number;
}

export type RawIndexPart = { column: string } | { expr: string };

export interface RawIndex {
  name?: string;
  parts: RawIndexPart[];
  unique?: boolean;
  /** DBML `pk` index: a composite primary key. */
  pk?: boolean;
  method?: string;
  note?: string;
  line: number;
}

export interface RawCheck {
  name?: string;
  expr: string;
  line: number;
}

export interface RawTableRef {
  schema?: string;
  name: string;
}

export interface RawTable extends RawTableRef {
  columns: RawColumn[];
  /** Table-level primary key (`PRIMARY KEY (a, b)`), column names in key order. */
  primaryKey?: string[];
  indexes: RawIndex[];
  checks: RawCheck[];
  note?: string;
  /** DBML `headercolor`, as written. */
  headerColor?: string;
  line: number;
}

export interface RawRefEnd extends RawTableRef {
  columns: string[];
}

export interface RawRef {
  name?: string;
  /** The referencing side. */
  from: RawRefEnd;
  /** The referenced side. */
  to: RawRefEnd;
  /** DBML only: the written cardinality and optional markers (FR-013 exception). */
  cardinality?: Cardinality;
  fromOptional?: boolean;
  toOptional?: boolean;
  onDelete?: DbAction;
  onUpdate?: DbAction;
  line: number;
  excerpt: string;
}

export interface RawEnum {
  name: string;
  schema?: string;
  values: { name: string; note?: string }[];
  note?: string;
  line: number;
}

export interface RawGroup {
  name: string;
  tables: RawTableRef[];
  color?: string;
  note?: string;
  line: number;
}

export interface RawNote {
  text: string;
  line: number;
}

/** A DBML block the code panel does not read as input (046 R15); the planner warns on it. */
export interface RawNonInput {
  kind: 'table-group' | 'note' | 'header-color' | 'project' | 'ref-color' | 'records';
  /** 1-based start; `endLine` / `endColumn` close the range when the compiler gave one. */
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface RawSchema {
  format: ImportFormat;
  tables: RawTable[];
  refs: RawRef[];
  enums: RawEnum[];
  groups: RawGroup[];
  notes: RawNote[];
  projectNote?: string;
  /** DBML `Project` `database_type`. */
  dialect?: SqlDialect;
  skipped: SkippedEntry[];
  changed: ChangedEntry[];
  /** DBML only (046): where the blocks that are not inputs sit. */
  inputs?: RawNonInput[];
}

/** One statement of a SQL text (research R2). */
export interface Statement {
  text: string;
  /** 1-based line of its first token. */
  line: number;
  endLine: number;
  kind: StatementKind;
}

/** Modelled kinds go to the parser; the others are skipped with the reason of the same name. */
export type StatementKind =
  | 'create-table'
  | 'create-type'
  | 'create-index'
  | 'alter-table'
  | 'comment-on'
  | 'view'
  | 'function'
  | 'procedure'
  | 'trigger'
  | 'sequence'
  | 'extension'
  | 'schema'
  | 'policy'
  | 'partition'
  | 'grant'
  | 'data'
  | 'session'
  | 'drop'
  | 'other';
