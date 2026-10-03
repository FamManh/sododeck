/**
 * Connector line type op (029, data-model.md). `style.shape` lives in a nested `Y.Map` on the
 * edge's own map, written key by key like card `style` (`ops/style.ts`), so a tab setting `shape`
 * and another moving `route.offset` both survive. `route` is never touched here (clarification Q2).
 */
import type { Edge, EdgeShape, Id } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YObject, YValue } from '../convert';
import { collectionMap } from '../layout';
import { readObject } from '../read';
import { assertValid, validateObject } from '../validate';
import { requireEntry, type EditContext } from './context';

/** Stores `shape`, or removes it (and the then-empty `style`) when `shape` is `null`. */
export function writeEdgeShape(edgeMap: YObject, shape: EdgeShape | null): void {
  const existing = edgeMap.get('style');
  if (shape === null) {
    if (existing instanceof Y.Map) {
      existing.delete('shape');
      if (existing.size === 0) edgeMap.delete('style');
    }
    return;
  }
  if (existing instanceof Y.Map) {
    existing.set('shape', shape);
    return;
  }
  const style = new Y.Map<YValue>();
  style.set('shape', shape);
  edgeMap.set('style', style);
}

/**
 * Sets the line type of every listed edge in one transaction (one undo step). Validates all ids
 * and the shape first. `curved` is stored only where leaving it absent would read as elbow (an
 * edge with a route offset); otherwise it removes the key.
 */
export function setEdgeShape(ctx: EditContext, edgeIds: readonly Id[], shape: EdgeShape): void {
  if (edgeIds.length === 0) return;
  const list = collectionMap(ctx.doc, 'edges');
  const entries = edgeIds.map((id) => {
    const map = requireEntry(list, id, 'Edge');
    const current = readObject('edges', id, map) as unknown as Edge;
    assertValid(validateObject('edges', { ...current, style: { shape } }));
    return { map, hasOffset: current.route?.offset !== undefined };
  });
  ctx.transact(() => {
    for (const { map, hasOffset } of entries) {
      writeEdgeShape(map, shape === 'curved' && !hasOffset ? null : shape);
    }
  });
}
