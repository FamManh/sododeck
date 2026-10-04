/**
 * Types of the schema export (045, data-model §1–§2). Everything under `db/export` is pure: a
 * `SododeckFile` snapshot and a request in, text out. No React, DOM, Yjs or `editor/` imports.
 */
import type { Cardinality, DbAction, Dialect, Id } from '@sododeck/schema';

import type { ExportNote } from './notes';

export type SchemaFormat = 'sql' | 'dbml' | 'mermaid-er' | 'dictionary';

export type SqlDialect = 'postgres' | 'mysql' | 'sqlite';

export interface SqlOptions {
  enumsAndIndexes: boolean;
  junctionTables: boolean;
  ifNotExists: boolean;
}

export const DEFAULT_SQL_OPTIONS: SqlOptions = {
  enumsAndIndexes: true,
  junctionTables: true,
  ifNotExists: false,
};

export type SchemaScopeRequest =
  | { kind: 'selection'; tableIds: readonly Id[] }
  | { kind: 'database'; cardId: Id }
  | { kind: 'deck' };

export interface SchemaExportRequest {
  format: SchemaFormat;
  scope: SchemaScopeRequest;
  /** SQL only; `null` = the deck's dialect. */
  dialect: SqlDialect | null;
  sql: SqlOptions;
}

export interface SchemaExportResult {
  /** Full output, `\n` line ends, one trailing newline; `''` when no table is in scope. */
  text: string;
  notes: readonly ExportNote[];
  tableCount: number;
}

/** What a writer returns: its text and the notes it adds to the slice's. */
export interface WriterOutput {
  text: string;
  notes: readonly ExportNote[];
}

export interface SliceType {
  stored: string;
  size?: string;
  /** The form to write: the dialect form after translation on a Generic deck (SQL), else stored(size). */
  written: string;
}

export type DefaultValue =
  { kind: 'value'; value: string | number | boolean } | { kind: 'expr'; expr: string };

export interface SliceEnum {
  id: Id;
  name: string;
  schema: string | null;
  note?: string;
  values: readonly { name: string; note?: string }[];
}

export interface SliceColumn {
  id: Id;
  name: string;
  type: SliceType;
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  increment: boolean;
  default?: DefaultValue;
  check?: string;
  note?: string;
  enum?: SliceEnum;
}

export type SliceIndexPart = { kind: 'column'; column: Id } | { kind: 'expr'; expr: string };

export interface SliceIndex {
  id: Id;
  name?: string;
  parts: readonly SliceIndexPart[];
  unique: boolean;
  method?: string;
  note?: string;
}

export interface SliceCheck {
  name?: string;
  expr: string;
}

export interface SliceForeignKey {
  relationshipId: Id;
  table: Id;
  columns: readonly Id[];
  refTable: Id;
  refColumns: readonly Id[];
  onDelete?: DbAction;
  onUpdate?: DbAction;
  /** Relationship label, for comments and DBML only. */
  name?: string;
  /** Part of a cycle: Postgres / MySQL add it after all tables (`ALTER TABLE`). */
  deferred: boolean;
}

export interface SliceTable {
  id: Id;
  name: string;
  /** `null` for absent or `public`. */
  schema: string | null;
  note?: string;
  columns: readonly SliceColumn[];
  /** Columns with `pk`, stored order. */
  primaryKey: readonly Id[];
  indexes: readonly SliceIndex[];
  checks: readonly SliceCheck[];
  /** FKs this table holds (research R4, R5). */
  foreignKeys: readonly SliceForeignKey[];
  /** `true` for a generated n–n table (research R6). */
  junction: boolean;
  /** For a junction table: the two tables it joins (comment line). */
  joins?: readonly [Id, Id];
}

export interface SliceRelationship {
  id: Id;
  from: Id;
  to: Id;
  /** Column ends that resolve (stale ids left out); an n–n side without columns is its table's key. */
  fromColumns: readonly Id[];
  toColumns: readonly Id[];
  cardinality?: Cardinality;
  fromOptional: boolean;
  toOptional: boolean;
  onDelete?: DbAction;
  onUpdate?: DbAction;
  label?: string;
  /**
   * Why SQL and DBML cannot write it as a reference (a note says so), or `null` when they can.
   * Mermaid and the dictionary write every relationship.
   */
  unwritable: 'stale' | 'length-mismatch' | 'no-columns' | 'no-key' | null;
}

export interface SchemaSlice {
  deckName: string;
  scopeLabel: string;
  /** The deck's, or for SQL on a Generic deck the picked one; `generic` for other formats. */
  dialect: Dialect;
  /** In scope, stable order: schema, name, id (FR-017). */
  tables: readonly SliceTable[];
  /** Generated n–n tables (SQL with junction tables on). */
  junctions: readonly SliceTable[];
  /** Ids of `tables` and `junctions` in dependency order (research R4), for SQL. */
  sqlOrder: readonly Id[];
  /** Enums used by a column in scope, deck order. */
  enums: readonly SliceEnum[];
  /** Relationships with both ends in scope: by from table order, then id. */
  relationships: readonly SliceRelationship[];
  /** FKs added after all tables (Postgres / MySQL cycles). */
  deferredFks: readonly SliceForeignKey[];
  notes: readonly ExportNote[];
  /** References from a table in scope to a table outside it (FR-019): "orders.account_id → billing.accounts". */
  outside: readonly { tableId: Id; reference: string }[];
}
