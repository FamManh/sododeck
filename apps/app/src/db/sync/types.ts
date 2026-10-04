/**
 * Types of the schema sync pipeline (046, data-model.md). Everything under `db/sync` except
 * `apply-schema-plan.ts` is pure: a deck snapshot, a `RawSchema` and a `SyncContext` in, plain
 * data out. No React, DOM, Yjs or `editor/` imports.
 */
import type {
  Cardinality,
  DbAction,
  DbCheck,
  DbColumn,
  DbIndex,
  Edge,
  Id,
  Node,
} from '@sododeck/schema';

export type ProblemCode =
  | 'syntax'
  | 'unknown-setting'
  | 'duplicate-table'
  | 'duplicate-column'
  | 'duplicate-enum'
  | 'duplicate-index'
  | 'missing-ref-table'
  | 'missing-ref-column'
  | 'enum-default'
  | 'enum-in-use'
  | 'locked'
  | 'not-an-input'
  | 'replaced';

/** A problem in the text, with a 1-based range (data-model "TextProblem"). */
export interface TextProblem {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
  code: ProblemCode;
}

/** A table (and the relationships and enum links it had) captured before an apply removed it. */
export interface RememberedTable {
  node: Node;
  edges: Edge[];
}

/** Lower-cased `schema.name` → what was removed (research R7). */
export type SessionMemory = Map<string, RememberedTable>;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SyncScope = { kind: 'schema' } | { kind: 'selection'; baseline: readonly Id[] };

export interface SyncContext {
  scope: SyncScope;
  memory: SessionMemory;
  /** Injected so tests are deterministic; real ids come from the model's generator. */
  newId: (prefix: string) => Id;
  /** Placement in an empty deck. */
  viewport: Rect;
  /** The size of a card, for placing new tables; a rough table estimate when absent. */
  sizeOf?: (node: Node) => { width: number; height: number };
}

/** Fields of a table DBML expresses (the only ones a patch may hold). */
export interface TablePatch {
  title?: string;
  /** `null` clears. */
  schema?: string | null;
  description?: string | null;
}

export interface ColumnPatch {
  name?: string;
  type?: string;
  size?: string | null;
  pk?: boolean | null;
  notNull?: boolean | null;
  unique?: boolean | null;
  increment?: boolean | null;
  default?: string | number | boolean | null;
  defaultExpr?: string | null;
  check?: string | null;
  enumRef?: Id | null;
  note?: string | null;
}

export interface IndexPatch {
  name?: string | null;
  columns?: DbIndex['columns'];
  unique?: boolean | null;
  method?: string | null;
  note?: string | null;
}

export interface CheckPatch {
  name?: string | null;
  expr?: string;
}

/** Part operations of one table, in apply order: adds, updates, moves, removes. */
export interface PartOps<TItem extends { id: Id }, TPatch> {
  adds: { item: TItem; index: number }[];
  updates: { id: Id; patch: TPatch }[];
  /** Final order of the surviving and added ids; applied with `move*`. */
  order: Id[];
  removes: Id[];
}

export interface TableOps {
  tableId: Id;
  columns: PartOps<DbColumn, ColumnPatch>;
  indexes: PartOps<DbIndex, IndexPatch>;
  checks: PartOps<DbCheck, CheckPatch>;
}

export interface EnumPatch {
  name?: string;
  schema?: string | null;
  note?: string | null;
}

export interface EnumValueData {
  id: Id;
  name: string;
  note?: string;
}

export interface EnumOps {
  adds: { id: Id; name: string; schema?: string; note?: string; values: EnumValueData[] }[];
  updates: {
    id: Id;
    patch: EnumPatch;
    valueAdds: { value: EnumValueData; index: number }[];
    valueUpdates: { id: Id; patch: { name?: string; note?: string | null } }[];
    valueOrder: Id[];
    valueRemoves: Id[];
  }[];
  removes: Id[];
}

export interface NewRelationship {
  id: Id;
  /** A remembered edge restored with the table: its other fields (route, style) come back. */
  base?: Edge;
  from: Id;
  to: Id;
  /** Empty for a plain n-n between two keys. */
  fromColumns: Id[];
  toColumns: Id[];
  name?: string;
  cardinality: Cardinality;
  fromOptional?: boolean;
  toOptional?: boolean;
  onDelete?: DbAction;
  onUpdate?: DbAction;
}

export interface RelationshipPatch {
  name?: string | null;
  from?: Id;
  to?: Id;
  /** `null` removes the column ends (a plain n-n). */
  fromColumns?: Id[] | null;
  toColumns?: Id[] | null;
  cardinality?: Cardinality;
  fromOptional?: boolean | null;
  toOptional?: boolean | null;
  onDelete?: DbAction | null;
  onUpdate?: DbAction | null;
}

/** Everything one apply changes (data-model "SchemaPlan"); applied in one merged batch. */
export interface SchemaPlan {
  /** Complete table nodes with columns, indexes, checks and a position. */
  addTables: { node: Node; restoredFrom?: 'memory' }[];
  updateTables: { id: Id; patch: TablePatch }[];
  tableOps: TableOps[];
  enumOps: EnumOps;
  relationshipOps: {
    adds: NewRelationship[];
    updates: { id: Id; patch: RelationshipPatch }[];
    removes: Id[];
  };
  removeTables: { id: Id; name: string }[];
  /** Whole schema and every table removed → the panel asks to confirm. */
  removesAll: boolean;
  /** No operation: nothing is written. */
  isEmpty: boolean;
}

export interface SyncResult {
  plan: SchemaPlan;
  problems: TextProblem[];
}

export function emptyPlan(): SchemaPlan {
  return {
    addTables: [],
    updateTables: [],
    tableOps: [],
    enumOps: { adds: [], updates: [], removes: [] },
    relationshipOps: { adds: [], updates: [], removes: [] },
    removeTables: [],
    removesAll: false,
    isEmpty: true,
  };
}
