/**
 * Sticky note ops: pin, unpin and move keep the note's screen point (data-model "States and
 * transitions of a note", research R3). The add/discard draft dance lives in `editor.ts`, which
 * has the undo manager this needs; this module holds the plain, validated writes.
 */
import type { Id, Size, Sticky, StickyColor } from '@sododeck/schema';

import { jsonEqual, type YObject } from '../convert';
import { toJSON } from '../deck';
import { clampStickySize, nodeCanvasPosition, stickyCanvasPosition, type Point } from '../geometry';
import { collectionMap } from '../layout';
import { readObject } from '../read';
import { tagKey } from '../tags';
import { assertValid, validateObject } from '../validate';
import { writeField } from '../write';
import { addObject, updateObject } from './collections';
import { requireEntry, type EditContext } from './context';
import { DeckEditError } from '../errors';
import { assertUnlocked } from './node-lock';
import { tidy } from './tags';
import type { NewObject } from './types';

export type StickyFontSize = NonNullable<Sticky['fontSize']>;
export type StickyAlign = NonNullable<Sticky['align']>;

/** A note carries at most this many tags (the same cap as a card). */
export const STICKY_MAX_TAGS = 10;

/** Adds a sticky, keyed so the caller can merge later edits of the same note (drafts). */
export function addSticky(ctx: EditContext, data: Omit<NewObject<'stickies'>, 'id'>): Id {
  const id = ctx.allocate('sticky');
  addObject(ctx, 'stickies', { ...data, id }, `stickies:${id}`);
  return id;
}

/** Deletes a sticky if it still exists (a no-op when removed remotely). Keyed like `addSticky`. */
export function deleteStickyIfPresent(ctx: EditContext, id: Id): void {
  const list = collectionMap(ctx.doc, 'stickies');
  if (!list.has(id)) return;
  ctx.transact(() => {
    list.delete(id);
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
  assertUnlocked(sticky, 'Sticky', id, 'pin it');
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
  assertUnlocked(sticky, 'Sticky', id, 'unpin it');
  const point = stickyCanvasPosition(file, sticky).point;
  updateObject(ctx, 'stickies', id, { anchor: null, position: point });
}

/** Moves a note to a canvas point: an offset when pinned to a node, an absolute point otherwise. */
export function moveSticky(ctx: EditContext, id: Id, point: Point): void {
  const file = toJSON(ctx.doc);
  const sticky = requireSticky(ctx, id);
  assertUnlocked(sticky, 'Sticky', id, 'move it');
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

/**
 * Sets or clears (`null`) a note's size (053), clamped to `STICKY_MIN_SIZE`: the file accepts any
 * positive size, but a note smaller than that cannot hold a tag row. One undo step, merged with an
 * open resize gesture. A locked note is refused.
 */
export function setStickySize(ctx: EditContext, id: Id, size: Size | null): void {
  const map = requireEntry(collectionMap(ctx.doc, 'stickies'), id, 'Sticky');
  assertUnlocked(map, 'Sticky', id, 'resize it');
  const current = readObject('stickies', id, map);
  if (size === null) {
    if (current.size === undefined) return;
    ctx.transact(() => {
      map.delete('size');
    }, `stickies:${id}:size`);
    return;
  }
  const clamped = clampStickySize(size);
  if (jsonEqual(current.size, clamped)) return;
  assertValid(validateObject('stickies', { ...current, size: clamped }));
  ctx.transact(() => {
    writeField(map, 'stickies', 'size', clamped);
  }, `stickies:${id}:size`);
}

/**
 * Sets (`value`) or clears (`undefined`) one key on every listed note in one transaction (one undo
 * step). Unknown ids are skipped (a selection may hold ids a remote edit just deleted), notes
 * already as asked are left alone, and every new value is validated before anything is written.
 */
function setOnStickies(
  ctx: EditContext,
  ids: readonly Id[],
  key: 'fontSize' | 'align' | 'color',
  value: string | number | undefined,
): void {
  const list = collectionMap(ctx.doc, 'stickies');
  const changes: YObject[] = [];
  for (const id of new Set(ids)) {
    const map = list.get(id);
    if (map === undefined) continue;
    const current = readObject('stickies', id, map);
    if (current[key] === value) continue;
    const candidate: Record<string, unknown> =
      value === undefined
        ? Object.fromEntries(Object.entries(current).filter(([k]) => k !== key))
        : { ...current, [key]: value };
    assertValid(validateObject('stickies', candidate));
    changes.push(map);
  }
  if (changes.length === 0) return;
  ctx.transact(() => {
    for (const map of changes) {
      if (value === undefined) map.delete(key);
      else writeField(map, 'stickies', key, value);
    }
  });
}

/** Fixes the text size of every listed note, or `null` for Auto (053). */
export function setStickyFont(
  ctx: EditContext,
  ids: readonly Id[],
  fontSize: StickyFontSize | null,
): void {
  setOnStickies(ctx, ids, 'fontSize', fontSize ?? undefined);
}

/** Aligns the text of every listed note, or `null` for the default (053). */
export function setStickyAlign(
  ctx: EditContext,
  ids: readonly Id[],
  align: StickyAlign | null,
): void {
  setOnStickies(ctx, ids, 'align', align ?? undefined);
}

/** Recolours every listed note (053). */
export function setStickyColour(ctx: EditContext, ids: readonly Id[], colour: StickyColor): void {
  setOnStickies(ctx, ids, 'color', colour);
}

/**
 * Sets a note's tags (053, 033 rules): trimmed and single-spaced, the case kept, repeats dropped
 * ignoring case (first spelling wins), empty ones dropped, at most `STICKY_MAX_TAGS`. An empty
 * result removes the key. A tag is shared with the deck (colour, rename, delete), so nothing here
 * touches `tagColors`.
 */
export function setStickyTags(ctx: EditContext, id: Id, tags: readonly string[]): void {
  const map = requireEntry(collectionMap(ctx.doc, 'stickies'), id, 'Sticky');
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of tags) {
    const text = tidy(raw);
    const key = tagKey(text);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    next.push(text);
    if (next.length === STICKY_MAX_TAGS) break;
  }
  const current = readObject('stickies', id, map);
  if (jsonEqual(current.tags ?? [], next)) return;
  const candidate: Record<string, unknown> = { ...current };
  if (next.length === 0) delete candidate.tags;
  else candidate.tags = next;
  assertValid(validateObject('stickies', candidate));
  ctx.transact(() => {
    if (next.length === 0) map.delete('tags');
    else writeField(map, 'stickies', 'tags', next);
  }, `stickies:${id}:tags`);
}
