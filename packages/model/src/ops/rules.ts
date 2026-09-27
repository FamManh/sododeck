/**
 * Rule (decision table) operations. Every row keeps exactly one `when` cell per input column and
 * one `then` cell per output column, in column order (data-model "Rule table invariants").
 */
import { emptySododeckFile, type Id, type Rule } from '@sododeck/schema';
import type * as Y from 'yjs';

import { fromY, toY, type YObject } from '../convert';
import { rulesMap } from '../layout';
import { findIndexById, getMapById, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { checkDuplicateIds } from '../load-checks';
import { assertValid, validateObject, validateRule } from '../validate';
import { removeRuleColumn as removeColumnCascade, type RemovalResult } from './cascade';
import { assertFreeIds, moveInArray } from './collections';
import { applyPatch, writePatch } from './patch';
import type { NewRule, Patch } from './types';

type Side = 'inputs' | 'outputs';

const CELLS: Record<Side, 'when' | 'then'> = { inputs: 'when', outputs: 'then' };

function ruleMap(ctx: EditContext, id: Id): YObject {
  const rule = rulesMap(ctx.doc).get(id);
  if (rule === undefined) {
    throw new DeckEditError('not-found', [{ path: '', message: `Rule "${id}" does not exist.` }]);
  }
  return rule;
}

function list(rule: YObject, field: 'inputs' | 'outputs' | 'rows'): Y.Array<YObject> {
  return rule.get(field) as Y.Array<YObject>;
}

function cells(row: YObject, field: 'when' | 'then'): Y.Array<string> {
  return row.get(field) as Y.Array<string>;
}

/** The side a column is on, and its index there. */
function findColumn(rule: YObject, columnId: Id): { side: Side; index: number } {
  for (const side of ['inputs', 'outputs'] as const) {
    const index = list(rule, side)
      .toArray()
      .findIndex((column) => column.get('id') === columnId);
    if (index !== -1) return { side, index };
  }
  throw new DeckEditError('not-found', [
    { path: '', message: `Column "${columnId}" does not exist.` },
  ]);
}

const clampInsert = (index: number | undefined, length: number) =>
  index === undefined ? length : Math.max(0, Math.min(length, Math.trunc(index)));

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
    rulesMap(ctx.doc).set(id, toY(rule) as YObject);
  });
  return id;
}

export function updateRule(
  ctx: EditContext,
  id: Id,
  patch: Patch<Omit<Rule, 'inputs' | 'outputs' | 'rows'>>,
): void {
  const map = ruleMap(ctx, id);
  const { candidate, changed } = applyPatch(fromY(map) as Record<string, unknown>, patch, [
    'inputs',
    'outputs',
    'rows',
  ]);
  if (changed.length === 0) return;
  assertValid(validateObject('rule', candidate));
  ctx.transact(() => {
    writePatch(map, candidate, changed);
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
  const columns = list(rule, side);
  const at = clampInsert(index, columns.length);
  ctx.transact(() => {
    columns.insert(at, [toY({ id, label }) as YObject]);
    for (const row of list(rule, 'rows')) cells(row, CELLS[side]).insert(at, ['']);
  });
  return id;
}

export function renameRuleColumn(ctx: EditContext, ruleId: Id, columnId: Id, label: string): void {
  const rule = ruleMap(ctx, ruleId);
  const { side, index } = findColumn(rule, columnId);
  assertValid(validateObject('column', { id: columnId, label }));
  const column = list(rule, side).get(index);
  if (column.get('label') === label) return;
  ctx.transact(() => {
    column.set('label', label);
  }, `rules:${ruleId}:${columnId}`);
}

export function moveRuleColumn(ctx: EditContext, ruleId: Id, columnId: Id, toIndex: number): void {
  const rule = ruleMap(ctx, ruleId);
  const { side, index } = findColumn(rule, columnId);
  const columns = list(rule, side);
  const to = Math.max(0, Math.min(columns.length - 1, Math.trunc(toIndex)));
  if (to === index) return;
  ctx.transact(() => {
    moveInArray(ctx, columns, index, to);
    for (const row of list(rule, 'rows')) {
      const rowCells = cells(row, CELLS[side]);
      const value = rowCells.get(index);
      rowCells.delete(index, 1);
      rowCells.insert(to, [value]);
    }
  });
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
    const count = list(rule, side).length;
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
  const rows = list(rule, 'rows');
  const at = clampInsert(index, rows.length);
  ctx.transact(() => {
    rows.insert(at, [toY(row) as YObject]);
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
  const row = getMapById(list(rule, 'rows'), rowId, 'Row');
  const { side, index } = findColumn(rule, columnId);
  const candidate = fromY(row) as Record<string, string[]>;
  candidate[CELLS[side]]?.splice(index, 1, value);
  assertValid(validateObject('row', candidate));
  const rowCells = cells(row, CELLS[side]);
  if (rowCells.get(index) === value) return;
  ctx.transact(() => {
    rowCells.delete(index, 1);
    rowCells.insert(index, [value]);
  }, `rules:${ruleId}:${rowId}:${columnId}`);
}

export function moveRuleRow(ctx: EditContext, ruleId: Id, rowId: Id, toIndex: number): void {
  const rows = list(ruleMap(ctx, ruleId), 'rows');
  moveInArray(ctx, rows, findIndexById(rows, rowId, 'Row'), toIndex);
}

export function removeRuleRow(ctx: EditContext, ruleId: Id, rowId: Id): void {
  const rows = list(ruleMap(ctx, ruleId), 'rows');
  const index = findIndexById(rows, rowId, 'Row');
  ctx.transact(() => {
    rows.delete(index, 1);
  });
}
