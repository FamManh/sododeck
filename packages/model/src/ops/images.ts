/**
 * Image ops (055, ADR 0037). An image is a canvas object with its own collection; the picture it
 * shows is named by `asset` and described in `meta.assets`. The bytes are not here: the app writes
 * them to its blob store before calling `addImages`, so a document never names a picture the store
 * lacks (another tab can show it at once).
 */
import type { Id, Size } from '@sododeck/schema';

import { type AssetId, type AssetMeta, metaOf } from '../assets';
import { jsonEqual, toY, type YObject, type YValue } from '../convert';
import { DeckEditError } from '../errors';
import { clampImageSize, type Point } from '../geometry';
import { appendAll, assetsMap, collectionMap, metaMap, type DeckDoc } from '../layout';
import { readObject } from '../read';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import { createObject, writeField } from '../write';
import * as Y from 'yjs';
import { anchorableIds } from '../ids';
import { requireEntry, type EditContext } from './context';
import { assertUnlocked } from './node-lock';
import { topRankOf } from './stacking';

/**
 * Writes what the document stores about a picture into `meta.assets` (created on first use),
 * unless that picture id is already there. Call inside a transaction.
 */
export function writeAssetMeta(doc: DeckDoc, id: AssetId, meta: AssetMeta): void {
  let assets = assetsMap(doc);
  if (assets === undefined) {
    assets = new Y.Map<YObject>();
    metaMap(doc).set('assets', assets as unknown as YValue);
  }
  if (!assets.has(id)) assets.set(id, toY(metaOf(meta)) as YObject);
}

/** One image to add: where it goes, how big, which picture, and what is known about it. */
export interface NewImage {
  /** Picture id: the lowercase SHA-256 of the stored bytes (`assetId`). */
  asset: AssetId;
  /** Stored about the picture; written to `meta.assets` when that picture is not there yet. */
  meta: AssetMeta;
  position: Point;
  /** Written as given; below 32 px on a side it is refused (`invalid`). */
  size: Size;
  alt?: string;
  caption?: string;
  group?: Id;
}

/** Text of a picture's alt and caption: absent, blank and empty all clear the key. */
export interface ImageText {
  alt?: string | null;
  caption?: string | null;
}

/**
 * Adds images on top of the stacking order, in the given order, in one transaction (one undo
 * step). A picture id the deck does not know yet gets its `meta.assets` entry once, however many
 * images use it. Validates everything before writing. Returns the new ids.
 */
export function addImages(ctx: EditContext, items: readonly NewImage[]): Id[] {
  if (items.length === 0) return [];
  const { doc } = ctx;
  const ids = items.map(() => ctx.allocate('img'));
  const known = assetsMap(doc);
  const metas = new Map<AssetId, AssetMeta>();
  const objects = items.map((item, i) => {
    const { meta, ...rest } = item;
    // The stored meta of a known picture wins: the same bytes always describe the same picture.
    if (!known?.has(item.asset) && !metas.has(item.asset)) metas.set(item.asset, metaOf(meta));
    return { id: ids[i], ...rest };
  });

  // Always ranked: an image takes part in the shared stack from its first moment, above the cards.
  const rank = topRankOf(doc);
  const issues = [
    ...[...metas.entries()].flatMap(([id, meta]) =>
      validateObject('asset', { ...meta, data: 'AA==' }).map((issue) => ({
        ...issue,
        path: `assets.${id}.${issue.path}`,
      })),
    ),
    ...objects.flatMap((object, i) =>
      validateObject('images', object).map((issue) => ({
        ...issue,
        path: `${String(i)}.${issue.path}`,
      })),
    ),
  ];
  assertValid(issues);
  assertRefsExist(
    doc,
    objects.flatMap((object) =>
      typeof object.group === 'string'
        ? [{ path: 'group', id: object.group, target: 'groups' as const }]
        : [],
    ),
    () => anchorableIds(doc),
  );
  // The pictures a new image names are either known already or come with their meta.
  for (const item of items) {
    if (!known?.has(item.asset) && !metas.has(item.asset)) {
      throw new DeckEditError('missing-reference', [
        { path: 'asset', message: `Picture "${item.asset}" is unknown.` },
      ]);
    }
  }

  ctx.transact(() => {
    for (const [id, entry] of metas) writeAssetMeta(doc, id, entry);
    appendAll(
      collectionMap(doc, 'images'),
      objects.map((object, i): [Id, YObject] => [
        object.id as Id,
        createObject('images', { ...object, z: rank + i }, ''),
      ]),
    );
  });
  ctx.reserve(ids);
  return ids;
}

/** Moves an image to a canvas point. A locked image is refused (`locked`). Merges in a gesture. */
export function moveImage(ctx: EditContext, id: Id, point: Point): void {
  const map = requireEntry(collectionMap(ctx.doc, 'images'), id, 'Image');
  assertUnlocked(map, 'Image', id, 'move it');
  const current = readObject('images', id, map);
  if (jsonEqual(current.position, point)) return;
  ctx.transact(() => {
    writeField(map, 'images', 'position', { x: point.x, y: point.y });
  }, `images:${id}:position`);
}

/**
 * Sets an image's on-canvas size, clamped to 32 px a side. A locked image is refused. One undo
 * step, merged with an open resize gesture.
 */
export function setImageSize(ctx: EditContext, id: Id, size: Size): void {
  const map = requireEntry(collectionMap(ctx.doc, 'images'), id, 'Image');
  assertUnlocked(map, 'Image', id, 'resize it');
  const clamped = clampImageSize(size);
  const current = readObject('images', id, map);
  if (jsonEqual(current.size, clamped)) return;
  assertValid(validateObject('images', { ...current, size: clamped }));
  ctx.transact(() => {
    writeField(map, 'images', 'size', clamped);
  }, `images:${id}:size`);
}

/**
 * Sets an image's alt text and caption (plain text). `null` and the empty string remove the key.
 * Alt and caption stay editable on a locked image, as a note's text does. A typing burst on one
 * image is one undo step.
 */
export function setImageText(ctx: EditContext, id: Id, text: ImageText): void {
  const map = requireEntry(collectionMap(ctx.doc, 'images'), id, 'Image');
  const current = readObject('images', id, map);
  const changes: [string, string | undefined][] = [];
  for (const key of ['alt', 'caption'] as const) {
    const given = text[key];
    if (given === undefined) continue;
    const next = given === null || given === '' ? undefined : given;
    if (current[key] !== next) changes.push([key, next]);
  }
  if (changes.length === 0) return;
  ctx.transact(() => {
    for (const [key, value] of changes) {
      if (value === undefined) map.delete(key);
      else writeField(map, 'images', key, value);
    }
  }, `images:${id}:text`);
}

/**
 * Puts an image in a group, or takes it out (`null`): one undo step. The group must exist
 * (`missing-reference`); a locked image is refused (`locked`).
 */
export function setImageGroup(ctx: EditContext, id: Id, group: Id | null): void {
  const { doc } = ctx;
  const map = requireEntry(collectionMap(doc, 'images'), id, 'Image');
  assertUnlocked(map, 'Image', id, 'move it to another group');
  if (group !== null) {
    assertRefsExist(doc, [{ path: 'group', id: group, target: 'groups' }], () =>
      anchorableIds(doc),
    );
  }
  const current = map.get('group');
  if ((current ?? null) === group) return;
  ctx.transact(() => {
    if (group === null) map.delete('group');
    else writeField(map, 'images', 'group', group);
  });
}
