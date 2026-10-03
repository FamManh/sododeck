/**
 * Rule (decision table) operations. Columns and rows are ordered lists, and a row's cells are keyed
 * by column id (036 research R5), so every row reads exactly one `when` cell per input column and
 * one `then` cell per output column by construction, whatever two tabs do at once.
 */
import { emptySododeckFile, type Id, type Rule } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YObject } from '../convert';
import { childList, insertAt, planMove, rulesMap, type ListMap } from '../layout';
import { requireEntry, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { checkDuplicateIds } from '../load-checks';
import { columnIds, readRow, readRule } from '../read';
import { assertValid, validateObject, validateRule } from '../validate';
import { createObject, createRow, createRule, writeFields } from '../write';
import { removeRuleColumn as removeColumnCascade, type RemovalResult } from './cascade';
import { assertFreeIds } from './collections';
import { applyPatch } from './patch';
import type { NewRule, Patch } from './types';

type Side = 'inputs' | 'outputs';

function ruleMap(ctx: EditContext, id: Id): YObject {
  const rule = rulesMap(ctx.doc).get(id);
  if (rule === undefined) {
    throw new DeckEditError('not-found', [{ path: '', message: `Rule "${id}" does not exist.` }]);
  }
  return rule;
}

function list(rule: YObject, field: 'inputs' | 'outputs' | 'rows'): ListMap {
  const children = childList(rule, field);
  if (children === undefined) throw new TypeError(`Rule has no "${field}" list.`);
  return children;
}

/** The side a column is on, and its index there. */
function findColumn(rule: YObject, columnId: Id): { side: Side; index: number } {
  for (const side of ['inputs', 'outputs'] as const) {
    const index = columnIds(rule, side).indexOf(columnId);
    if (index !== -1) return { side, index };
  }
  throw new DeckEditError('not-found', [
    { path: '', message: `Column "${columnId}" does not exist.` },
  ]);
}

export function addRule(ctx: EditContext, data: NewRule): Id {
  const { id: explicitId, ...fields } = data;
  const id = explicitId ?? ctx.allocate('rule');
  // The id is the rule's key in `rules`, not a field. Key order is restored on write-out.
  const rule: Rule = {
    ...fields,
    hitPolicy: fields.hitPolicy ?? 'first',
    inputs: fields.inputs ?? [],
    outputs: fields.outputs ?? [],
    rows: fields.rows ?? [],
  };
  // Also checks that the key is a valid id (schema rule S3).
  assertValid(validateRule(id, rule));
  if (explicitId !== undefined) assertFreeIds(ctx.doc, [{ path: 'id', id }]);
  const duplicates = checkDuplicateIds({ ...emptySododeckFile(), rules: { [id]: rule } });
  if (duplicates.length > 0) throw new DeckEditError('duplicate-id', duplicates);

  ctx.transact(() => {
    insertAt(rulesMap(ctx.doc), id, createRule(rule, ''));
  });
  ctx.reserve([id, ...[...rule.inputs, ...rule.outputs, ...rule.rows].map((x) => x.id)]);
  return id;
}

export function updateRule(
  ctx: EditContext,
  id: Id,
  patch: Patch<Omit<Rule, 'inputs' | 'outputs' | 'rows'>>,
): void {
  const map = ruleMap(ctx, id);
  const current = readRule(map) as unknown as Record<string, unknown>;
  const { candidate, changed } = applyPatch(current, patch, ['inputs', 'outputs', 'rows']);
  if (changed.length === 0) return;
  assertValid(validateObject('rule', candidate));
  ctx.transact(() => {
    writeFields(map, 'rule', candidate, changed);
  }, `rules:${id}`);
}

export function addRuleColumn(
  ctx: EditContext,
  ruleId: Id,
  side: Side,
  label: string,
  index?: number,
): Id {
  const rule = ruleMap(ctx, ruleId);
  const id = ctx.allocate('col');
  assertValid(validateObject('column', { id, label }));
  // One write: rows have no cell for the new column yet, which reads as `''` (any value).
  ctx.transact(() => {
    insertAt(list(rule, side), id, createObject('column', { id, label }, ''), index);
  });
  return id;
}

export function renameRuleColumn(ctx: EditContext, ruleId: Id, columnId: Id, label: string): void {
  const rule = ruleMap(ctx, ruleId);
  const { side } = findColumn(rule, columnId);
  assertValid(validateObject('column', { id: columnId, label }));
  const column = requireEntry(list(rule, side), columnId, 'Column');
  if (column.get('label') === label) return;
  ctx.transact(() => {
    column.set('label', label);
  }, `rules:${ruleId}:${columnId}`);
}

export function moveRuleColumn(ctx: EditContext, ruleId: Id, columnId: Id, toIndex: number): void {
  const rule = ruleMap(ctx, ruleId);
  const { side } = findColumn(rule, columnId);
  // Cells are keyed by column, so a move is one order change and touches no row.
  const move = planMove(list(rule, side), columnId, toIndex);
  if (move !== undefined) ctx.transact(move);
}

export function removeRuleColumn(ctx: EditContext, ruleId: Id, columnId: Id): RemovalResult {
  const rule = ruleMap(ctx, ruleId);
  const { side } = findColumn(rule, columnId);
  return removeColumnCascade(ctx, rule, ruleId, side, columnId);
}

/** Adds a row; missing cells are filled with `''` (any value). */
export function addRuleRow(
  ctx: EditContext,
  ruleId: Id,
  given: { when?: string[]; then?: string[] } = {},
  index?: number,
): Id {
  const rule = ruleMap(ctx, ruleId);
  const fill = (values: string[] = [], side: Side, field: 'when' | 'then') => {
    const count = list(rule, side).size;
    if (values.length > count) {
      throw new DeckEditError('invalid', [
        {
          path: field,
          message: `${String(values.length)} cells given for ${String(count)} columns.`,
        },
      ]);
    }
    return [...values, ...Array.from({ length: count - values.length }, () => '')];
  };
  const id = ctx.allocate('row');
  const row = {
    id,
    when: fill(given.when, 'inputs', 'when'),
    then: fill(given.then, 'outputs', 'then'),
  };
  assertValid(validateObject('row', row));
  const inputs = columnIds(rule, 'inputs');
  const outputs = columnIds(rule, 'outputs');
  ctx.transact(() => {
    insertAt(list(rule, 'rows'), id, createRow(row, inputs, outputs, ''), index);
  });
  return id;
}

export function setRuleCell(
  ctx: EditContext,
  ruleId: Id,
  rowId: Id,
  columnId: Id,
  value: string,
): void {
  const rule = ruleMap(ctx, ruleId);
  const row = requireEntry(list(rule, 'rows'), rowId, 'Row');
  const { side, index } = findColumn(rule, columnId);
  const candidate = readRow(rowId, row, columnIds(rule, 'inputs'), columnIds(rule, 'outputs'));
  const cellsOfSide = side === 'inputs' ? candidate.when : candidate.then;
  if (cellsOfSide[index] === value) return;
  cellsOfSide.splice(index, 1, value);
  assertValid(validateObject('row', candidate));
  ctx.transact(() => {
    let cells = row.get('cells');
    if (!(cells instanceof Y.Map)) {
      cells = new Y.Map();
      row.set('cells', cells);
    }
    // One key per cell, so two tabs editing different cells of a row both keep their edit.
    cells.set(columnId, value);
  }, `rules:${ruleId}:${rowId}:${columnId}`);
}

export function moveRuleRow(ctx: EditContext, ruleId: Id, rowId: Id, toIndex: number): void {
  const rows = list(ruleMap(ctx, ruleId), 'rows');
  requireEntry(rows, rowId, 'Row');
  const move = planMove(rows, rowId, toIndex);
  if (move !== undefined) ctx.transact(move);
}

export function removeRuleRow(ctx: EditContext, ruleId: Id, rowId: Id): void {
  const rows = list(ruleMap(ctx, ruleId), 'rows');
  requireEntry(rows, rowId, 'Row');
  ctx.transact(() => {
    rows.delete(rowId);
  });
}
