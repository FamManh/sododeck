/**
 * Card size and connector route ops (017, research R8, data-model.md). Both are format-level: the
 * model validates and merges, but never clamps a size or picks a default side — that is the app's
 * job (`cardSize`, `resolveSides`).
 */
import type { EdgeRoute, Id, Side, Size } from '@sododeck/schema';
import * as Y from 'yjs';

import { isRecord, jsonEqual, toY, type YObject } from '../convert';
import { collectionMap } from '../layout';
import { readObject } from '../read';
import { requireEntry, type EditContext } from './context';
import { assertValid, validateObject } from '../validate';
import { writeField } from '../write';

/** `null` removes a key of the route; `undefined` (an absent key) leaves it unchanged. */
export type EdgeRoutePatch = {
  fromSide?: Side | null;
  toSide?: Side | null;
  offset?: number | null;
};

/**
 * Sets or clears (`null`) a card's stored size. Does not clamp: the schema only requires
 * `width` / `height` above 0. One undo step, joining an open gesture.
 */
export function setCardSize(ctx: EditContext, nodeId: Id, size: Size | null): void {
  const map = requireEntry(collectionMap(ctx.doc, 'nodes'), nodeId, 'Node');
  const current = readObject('nodes', nodeId, map);
  if (size === null) {
    if (current.size === undefined) return;
    ctx.transact(() => {
      map.delete('size');
    }, `nodes:${nodeId}:size`);
    return;
  }
  if (jsonEqual(current.size, size)) return;
  const candidate = { ...current, size };
  assertValid(validateObject('nodes', candidate));
  ctx.transact(() => {
    writeField(map, 'nodes', 'size', size);
  }, `nodes:${nodeId}:size`);
}

const ROUTE_KEYS = ['fromSide', 'toSide', 'offset'] as const;

/** Merges `patch` into the current route: `null` removes a key, `offset: 0` is dropped. */
function mergeRoute(current: EdgeRoute | undefined, patch: EdgeRoutePatch): EdgeRoute | undefined {
  const merged: { fromSide?: Side; toSide?: Side; offset?: number } = { ...current };
  if (patch.fromSide === null) delete merged.fromSide;
  else if (patch.fromSide !== undefined) merged.fromSide = patch.fromSide;
  if (patch.toSide === null) delete merged.toSide;
  else if (patch.toSide !== undefined) merged.toSide = patch.toSide;
  if (patch.offset === null) delete merged.offset;
  else if (patch.offset !== undefined) merged.offset = patch.offset;
  if (merged.offset === 0) delete merged.offset;
  return Object.keys(merged).length === 0 ? undefined : merged;
}

/** Writes `route`'s keys one by one so two tabs changing different keys both keep their change. */
function writeRoute(edgeMap: YObject, merged: EdgeRoute | undefined): void {
  if (merged === undefined) {
    edgeMap.delete('route');
    return;
  }
  let routeMap = edgeMap.get('route');
  if (!(routeMap instanceof Y.Map)) {
    routeMap = new Y.Map();
    edgeMap.set('route', routeMap);
  }
  for (const key of ROUTE_KEYS) {
    const value = merged[key];
    if (value === undefined) {
      if (routeMap.has(key)) routeMap.delete(key);
    } else if (routeMap.get(key) !== value) {
      routeMap.set(key, toY(value));
    }
  }
}

/**
 * Merges `patch` into an edge's route (`null` clears the whole route). `null` on one key removes
 * it, `offset: 0` is dropped, and `route` itself is removed once no key is left. One undo step,
 * joining an open gesture.
 */
export function setEdgeRoute(ctx: EditContext, edgeId: Id, patch: EdgeRoutePatch | null): void {
  const map = requireEntry(collectionMap(ctx.doc, 'edges'), edgeId, 'Edge');
  const current = readObject('edges', edgeId, map);
  const currentRoute = isRecord(current.route) ? (current.route as EdgeRoute) : undefined;
  const merged = patch === null ? undefined : mergeRoute(currentRoute, patch);
  if (jsonEqual(currentRoute, merged)) return;
  const candidate = { ...current };
  if (merged === undefined) delete candidate.route;
  else candidate.route = merged;
  assertValid(validateObject('edges', candidate));
  ctx.transact(() => {
    writeRoute(map, merged);
  }, `edges:${edgeId}:route`);
}
