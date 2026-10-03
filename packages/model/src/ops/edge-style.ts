/**
 * Connector line style ops (029 shape, 022 dash / width / colour / animation). `style` lives in a
 * nested `Y.Map` on the edge's own map, written key by key like card `style` (`ops/style.ts`), so
 * a tab setting `dash` and another setting `color` both survive. A default value is never stored
 * (`solid`, width 2, not animated, no colour). `route` is never touched here (clarification Q2).
 */
import type { Edge, EdgeShape, EdgeStyle, Id } from '@sododeck/schema';
import * as Y from 'yjs';

import { jsonEqual, type YObject, type YValue } from '../convert';
import { collectionMap } from '../layout';
import { readObject } from '../read';
import { assertValid, validateObject } from '../validate';
import { requireEntry, type EditContext } from './context';

/** `null` (or a default value) puts a key back to its default and removes it. */
export type EdgeStylePatch = {
  [K in keyof EdgeStyle]?: EdgeStyle[K] | null;
};

const STYLE_KEYS = ['shape', 'dash', 'width', 'color', 'animated'] as const;

/** Whether `value` is what an absent key already means (so it is not stored). */
function isDefault(key: keyof EdgeStyle, value: unknown): boolean {
  switch (key) {
    case 'dash':
      return value === 'solid';
    case 'width':
      return value === 2;
    case 'animated':
      return value === false;
    default:
      return false;
  }
}

/** Sets (`undefined` removes) one style key, creating or dropping the nested map as needed. */
function writeStyleKey(edgeMap: YObject, key: keyof EdgeStyle, value: unknown): void {
  const existing = edgeMap.get('style');
  if (value === undefined) {
    if (existing instanceof Y.Map) {
      existing.delete(key);
      if (existing.size === 0) edgeMap.delete('style');
    }
    return;
  }
  const next = value as YValue;
  if (existing instanceof Y.Map) {
    if (existing.get(key) !== next) existing.set(key, next);
    return;
  }
  const style = new Y.Map<YValue>();
  style.set(key, next);
  edgeMap.set('style', style);
}

/** Stores `shape`, or removes it (and the then-empty `style`) when `shape` is `null`. */
export function writeEdgeShape(edgeMap: YObject, shape: EdgeShape | null): void {
  writeStyleKey(edgeMap, 'shape', shape ?? undefined);
}

/**
 * Applies `patch` to the style of every listed edge in one transaction (one undo step). Validates
 * all ids and values first. `curved` is stored only where leaving it absent would read as elbow
 * (an edge with a route offset); otherwise it removes the key.
 */
export function setEdgeStyle(
  ctx: EditContext,
  edgeIds: readonly Id[],
  patch: EdgeStylePatch,
): void {
  if (edgeIds.length === 0) return;
  const list = collectionMap(ctx.doc, 'edges');
  const plans = edgeIds.map((id) => {
    const map = requireEntry(list, id, 'Edge');
    const current = readObject('edges', id, map) as unknown as Edge;
    const hasOffset = current.route?.offset !== undefined;
    const next = new Map<string, unknown>(Object.entries(current.style ?? {}));
    for (const key of STYLE_KEYS) {
      const value = patch[key];
      if (value === undefined) continue;
      const remove =
        value === null ||
        isDefault(key, value) ||
        (key === 'shape' && value === 'curved' && !hasOffset);
      if (remove) next.delete(key);
      else next.set(key, value);
    }
    const candidate: Record<string, unknown> = { ...current };
    if (next.size === 0) delete candidate.style;
    else candidate.style = Object.fromEntries(next);
    assertValid(validateObject('edges', candidate));
    return { map, before: current.style, next };
  });
  const changed = plans.filter(
    ({ before, next }) => !jsonEqual(before ?? {}, Object.fromEntries(next)),
  );
  if (changed.length === 0) return;
  ctx.transact(() => {
    for (const { map, next } of changed) {
      for (const key of STYLE_KEYS) writeStyleKey(map, key, next.get(key));
    }
  });
}

/** Sets the line type of every listed edge as one undo step (029); see `setEdgeStyle`. */
export function setEdgeShape(ctx: EditContext, edgeIds: readonly Id[], shape: EdgeShape): void {
  setEdgeStyle(ctx, edgeIds, { shape });
}
