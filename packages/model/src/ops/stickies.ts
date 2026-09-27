/**
 * Sticky note ops: pin, unpin and move keep the note's screen point (data-model "States and
 * transitions of a note", research R3). The add/discard draft dance lives in `editor.ts`, which
 * has the undo manager this needs; this module holds the plain, validated writes.
 */
import type { Id, Sticky } from '@sododeck/schema';

import { toJSON } from '../deck';
import { nodeCanvasPosition, stickyCanvasPosition, type Point } from '../geometry';
import { collectionArray, indexOfId } from '../layout';
import { addObject, updateObject } from './collections';
import type { EditContext } from './context';
import { DeckEditError } from '../errors';
import type { NewObject } from './types';

/** Adds a sticky, keyed so the caller can merge later edits of the same note (drafts). */
export function addSticky(ctx: EditContext, data: Omit<NewObject<'stickies'>, 'id'>): Id {
  const id = ctx.allocate('sticky');
  addObject(ctx, 'stickies', { ...data, id }, `stickies:${id}`);
  return id;
}

/** Deletes a sticky if it still exists (a no-op when removed remotely). Keyed like `addSticky`. */
export function deleteStickyIfPresent(ctx: EditContext, id: Id): void {
  const array = collectionArray(ctx.doc, 'stickies');
  const index = indexOfId(array, id);
  if (index === -1) return;
  ctx.transact(() => {
    array.delete(index, 1);
  }, `stickies:${id}`);
}

function requireSticky(ctx: EditContext, id: Id): Sticky {
  const sticky = toJSON(ctx.doc).stickies.find((s) => s.id === id);
  if (!sticky) {
    throw new DeckEditError('not-found', [{ path: '', message: `Sticky "${id}" does not exist.` }]);
  }
  return sticky;
}

/** Pins a note to a node, keeping its current canvas point (writes `anchor` + an offset). */
export function pinSticky(ctx: EditContext, id: Id, nodeId: Id): void {
  const file = toJSON(ctx.doc);
  const sticky = requireSticky(ctx, id);
  const base = nodeCanvasPosition(file, nodeId);
  if (base === null) {
    throw new DeckEditError('missing-reference', [
      { path: 'anchor', message: `Node "${nodeId}" does not exist.` },
    ]);
  }
  const point = stickyCanvasPosition(file, sticky).point;
  updateObject(ctx, 'stickies', id, {
    anchor: nodeId,
    position: { x: point.x - base.x, y: point.y - base.y },
  });
}

/** Unpins a note, keeping its current canvas point (removes `anchor`, writes an absolute point). */
export function unpinSticky(ctx: EditContext, id: Id): void {
  const file = toJSON(ctx.doc);
  const sticky = requireSticky(ctx, id);
  const point = stickyCanvasPosition(file, sticky).point;
  updateObject(ctx, 'stickies', id, { anchor: null, position: point });
}

/** Moves a note to a canvas point: an offset when pinned to a node, an absolute point otherwise. */
export function moveSticky(ctx: EditContext, id: Id, point: Point): void {
  const file = toJSON(ctx.doc);
  const sticky = requireSticky(ctx, id);
  const placement = stickyCanvasPosition(file, sticky);
  if (placement.status === 'pinned') {
    // The node always resolves: `placement.pinnedTo` came from `stickyCanvasPosition`, which only
    // reports `pinned` when `nodeCanvasPosition` found the node.
    const base = nodeCanvasPosition(file, placement.pinnedTo) as Point;
    updateObject(ctx, 'stickies', id, {
      position: { x: point.x - base.x, y: point.y - base.y },
    });
  } else {
    updateObject(ctx, 'stickies', id, { position: point });
  }
}
