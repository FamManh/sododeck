/**
 * Decision table evaluation (ADR 0009): which rows match a set of inputs under the rule's hit
 * policy, and the rule-level checks. Pure and derived for display; results are never stored.
 */
import type { Id, Rule } from '@sododeck/schema';

import { matchCell, parseCell, type Cell } from './cells';

export type Evaluation =
  /** First match and Unique: one row. Collect: every matching row, in order. */
  | { status: 'match'; rows: readonly Id[] }
  /** Unique only: several rows match, so there is no winner. */
  | { status: 'ambiguous'; rows: readonly Id[] }
  | { status: 'none' };

export interface RuleChecks {
  /** Some row has every condition cell Any (or empty). */
  catchAll: boolean;
  invalidCells: readonly { rowId: Id; columnId: Id }[];
}

// Parsed cells per rule object: snapshots keep an unchanged rule's identity, so typing in the
// test panel re-parses nothing.
const parsed = new WeakMap<Rule, readonly (readonly Cell[])[]>();

function parsedRows(rule: Rule): readonly (readonly Cell[])[] {
  let rows = parsed.get(rule);
  if (rows === undefined) {
    rows = rule.rows.map((row) => row.when.map(parseCell));
    parsed.set(rule, rows);
  }
  return rows;
}

/** Evaluates a rule. Inputs are keyed by input column id; a missing key counts as `''`. */
export function evaluateRule(rule: Rule, inputs: Readonly<Record<Id, string>>): Evaluation {
  const values = rule.inputs.map((column) => inputs[column.id] ?? '');
  const cells = parsedRows(rule);
  const matching: Id[] = [];
  for (const [i, row] of rule.rows.entries()) {
    const rowCells = cells[i] ?? [];
    if (rowCells.every((cell, c) => matchCell(cell, values[c] ?? ''))) {
      matching.push(row.id);
      if (rule.hitPolicy === 'first') break;
    }
  }
  if (matching.length === 0) return { status: 'none' };
  if (rule.hitPolicy === 'unique' && matching.length > 1) {
    return { status: 'ambiguous', rows: matching };
  }
  return { status: 'match', rows: matching };
}

/** Catch-all detection and invalid condition cells, for the rule editor's CHECKS. */
export function ruleChecks(rule: Rule): RuleChecks {
  const cells = parsedRows(rule);
  const invalidCells: { rowId: Id; columnId: Id }[] = [];
  let catchAll = false;
  for (const [i, row] of rule.rows.entries()) {
    const rowCells = cells[i] ?? [];
    if (rowCells.every((cell) => cell.kind === 'any')) catchAll = true;
    rowCells.forEach((cell, c) => {
      const columnId = rule.inputs[c]?.id;
      if (cell.kind === 'invalid' && columnId !== undefined) {
        invalidCells.push({ rowId: row.id, columnId });
      }
    });
  }
  return { catchAll, invalidCells };
}
