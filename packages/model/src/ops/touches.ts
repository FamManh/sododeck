/**
 * The tables and columns a flow step reads or writes (049, ADR 0035). A touch is keyed by its
 * `(table, column)` pair: a step holds each pair at most once (S15), so the ops name a touch by
 * that key rather than by its index, which another tab may shift.
 */
import type { Id, Touch } from '@sododeck/schema';
import * as Y from 'yjs';

import { fromY, toY, type YObject } from '../convert';
import { DeckEditError } from '../errors';
import { requireEntry, type EditContext } from './context';
import { columnIdsOf, requireTable } from './db-tables';
import { stepsOf } from './steps';

/** Names one touch of a step: a table, or one column of it. */
export interface TouchKey {
  table: Id;
  column?: Id;
}

export type TouchAccess = Touch['access'];

const ACCESS: readonly TouchAccess[] = ['read', 'write'];

/** True when `touch` is the entry named by `key`. */
export function isTouch(touch: TouchKey, key: TouchKey): boolean {
  return touch.table === key.table && touch.column === key.column;
}

function isTouchValue(value: unknown): value is Touch {
  if (value === null || typeof value !== 'object') return false;
  const { table, access } = value as Record<string, unknown>;
  return typeof table === 'string' && (access === 'read' || access === 'write');
}

/** A stored step's touches as plain data, in order (empty when it has none). */
export function touchesOf(step: YObject): Touch[] {
  const plain = fromY(step.get('touches'));
  return Array.isArray(plain) ? plain.filter(isTouchValue) : [];
}

function describe(key: TouchKey): string {
  return key.column === undefined
    ? `table "${key.table}"`
    : `column "${key.column}" of table "${key.table}"`;
}

function requireAccess(access: unknown): asserts access is TouchAccess {
  if (!ACCESS.includes(access as TouchAccess)) {
    throw new DeckEditError('invalid', [
      { path: 'touches.access', message: `Access must be "read" or "write".` },
    ]);
  }
}

/** The index of the touch named by `key`, or throws `not-found`. */
function requireTouch(step: YObject, stepId: Id, key: TouchKey): number {
  const index = touchesOf(step).findIndex((touch) => isTouch(touch, key));
  if (index === -1) {
    throw new DeckEditError('not-found', [
      { path: 'touches', message: `Step "${stepId}" does not touch ${describe(key)}.` },
    ]);
  }
  return index;
}

/**
 * Appends a touch to a step. Throws `not-found` for an unknown table, `invalid` when the node is
 * not a table, the access is not read / write or the pair is already listed, and
 * `missing-reference` when the column is not a column of that table. One undo step.
 */
export function addTouch(ctx: EditContext, flowId: Id, stepId: Id, touch: Touch): void {
  const step = requireEntry(stepsOf(ctx, flowId), stepId, 'Step');
  requireAccess(touch.access);
  const table = requireTable(ctx, touch.table);
  if (touch.column !== undefined && !columnIdsOf(table).has(touch.column)) {
    throw new DeckEditError('missing-reference', [
      {
        path: 'touches.column',
        message: `Column "${touch.column}" is not a column of table "${touch.table}".`,
      },
    ]);
  }
  if (touchesOf(step).some((existing) => isTouch(existing, touch))) {
    throw new DeckEditError('invalid', [
      { path: 'touches', message: `Step "${stepId}" already touches ${describe(touch)}.` },
    ]);
  }
  const entry: Touch = { table: touch.table, access: touch.access };
  if (touch.column !== undefined) entry.column = touch.column;
  ctx.transact(() => {
    const list = step.get('touches');
    if (list instanceof Y.Array) list.push([toY(entry)]);
    else step.set('touches', toY([entry]));
  });
}

/** Sets a touch to read or write. No-op when unchanged. One undo step. */
export function setTouchAccess(
  ctx: EditContext,
  flowId: Id,
  stepId: Id,
  key: TouchKey,
  access: TouchAccess,
): void {
  const step = requireEntry(stepsOf(ctx, flowId), stepId, 'Step');
  requireAccess(access);
  const index = requireTouch(step, stepId, key);
  const list = step.get('touches');
  if (!(list instanceof Y.Array)) return;
  const entry: unknown = list.get(index);
  if (!(entry instanceof Y.Map) || entry.get('access') === access) return;
  ctx.transact(() => {
    entry.set('access', access);
  });
}

/** Removes one touch; the field goes when the list is empty. One undo step. */
export function removeTouch(ctx: EditContext, flowId: Id, stepId: Id, key: TouchKey): void {
  const step = requireEntry(stepsOf(ctx, flowId), stepId, 'Step');
  const index = requireTouch(step, stepId, key);
  const list = step.get('touches');
  if (!(list instanceof Y.Array)) return;
  ctx.transact(() => {
    list.delete(index, 1);
    if (list.length === 0) step.delete('touches');
  });
}
