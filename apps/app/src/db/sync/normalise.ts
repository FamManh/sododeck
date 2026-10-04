/**
 * Normalisation shared by the planner and the round-trip tests (046 R6): both sides of a
 * comparison are put in the shape the DBML writer produces and the DBML reader reads back, so the
 * writer's own text is an empty plan (SC-004). Pure.
 */
import type { DbColumn, DbIndex, Node } from '@sododeck/schema';

import { DBML_METHODS } from '../export/dbml-writer';
import type { RawColumn, RawIndex, RawTable } from '../import/types';

const trimmed = (text: string | undefined): string | undefined => {
  const value = text?.trim();
  return value === undefined || value === '' ? undefined : value;
};

/** `public` and an absent schema are the same schema; DBML text never says `public.`. */
export function schemaName(schema: string | undefined): string | undefined {
  const value = trimmed(schema);
  return value === undefined || value.toLowerCase() === 'public' ? undefined : value;
}

/** A check as the text holds it: DBML has table checks only, so a column's check joins them. */
export interface NormalCheck {
  name?: string;
  expr: string;
  /** The deck object it came from: a table check, or the column whose `check` it is. */
  origin?: { kind: 'check'; id: string } | { kind: 'column'; id: string };
}

export interface NormalDeckTable {
  node: Node;
  title: string;
  schema: string | undefined;
  note: string | undefined;
  columns: DbColumn[];
  indexes: DbIndex[];
  checks: NormalCheck[];
}

/** The deck's table in the form the writer expresses it (notes trimmed, column checks moved). */
export function normaliseDeckTable(node: Node): NormalDeckTable {
  const columns = node.columns ?? [];
  const checks: NormalCheck[] = [
    ...(node.checks ?? [])
      .filter((c) => c.expr.trim() !== '')
      .map((c) => ({
        ...(trimmed(c.name) === undefined ? {} : { name: c.name }),
        expr: c.expr,
        origin: { kind: 'check' as const, id: c.id },
      })),
    ...columns.flatMap((c) =>
      trimmed(c.check) === undefined
        ? []
        : [{ expr: c.check ?? '', origin: { kind: 'column' as const, id: c.id } }],
    ),
  ];
  return {
    node,
    title: node.title.trim(),
    schema: schemaName(node.schema),
    note: trimmed(node.description),
    columns,
    indexes: (node.indexes ?? []).map((index) => {
      // The writer drops a method DBML cannot hold; comparing without it never clears the stored one.
      const method = trimmed(index.method)?.toLowerCase();
      const { method: _stored, ...rest } = index;
      return method !== undefined && DBML_METHODS.has(method) ? { ...rest, method } : rest;
    }),
    checks,
  };
}

function normaliseRawColumn(column: RawColumn): RawColumn {
  const { check: _check, note, ...rest } = column;
  const text = trimmed(note);
  return { ...rest, ...(text === undefined ? {} : { note: text }) };
}

function normaliseRawIndex(index: RawIndex): RawIndex {
  const { note, method, ...rest } = index;
  const text = trimmed(note);
  const kind = trimmed(method)?.toLowerCase();
  return {
    ...rest,
    ...(kind === undefined ? {} : { method: kind }),
    ...(text === undefined ? {} : { note: text }),
  };
}

/** The parsed table with the same rules: column checks become table checks, notes trimmed. */
export function normaliseRawTable(table: RawTable): RawTable {
  const columnChecks = table.columns.flatMap((c) =>
    trimmed(c.check) === undefined ? [] : [{ expr: c.check ?? '', line: c.line }],
  );
  const { note, ...rest } = table;
  const text = trimmed(note);
  return {
    ...rest,
    ...(text === undefined ? {} : { note: text }),
    columns: table.columns.map(normaliseRawColumn),
    indexes: table.indexes.map(normaliseRawIndex),
    checks: [...table.checks.filter((c) => c.expr.trim() !== ''), ...columnChecks],
  };
}

/** Table checks plus column checks, as expression lists: used by the round-trip tests. */
export function checkExpressions(node: Node): string[] {
  return normaliseDeckTable(node).checks.map((c) => c.expr);
}

/** A node with every column's check moved to the table's checks (new ids are not made). */
export function foldColumnChecks(node: Node): Node {
  const columns = (node.columns ?? []).map((c) => {
    const { check: _check, ...rest } = c;
    return rest;
  });
  const checks = normaliseDeckTable(node).checks.map((c, i) => ({
    id: c.origin?.kind === 'check' ? c.origin.id : `folded.${String(i)}`,
    ...(c.name === undefined ? {} : { name: c.name }),
    expr: c.expr,
  }));
  return {
    ...node,
    ...(node.columns === undefined ? {} : { columns }),
    ...(checks.length === 0 ? {} : { checks }),
  };
}
