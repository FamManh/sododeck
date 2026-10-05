/**
 * Image ops (055, ADR 0037). An image is a canvas object with its own collection; the picture it
 * shows is named by `asset` and described in `meta.assets`. The bytes are not here: the app writes
 * them to its blob store before calling `addImages`, so a document never names a picture the store
 * lacks (another tab can show it at once).
 */
import type { Id, Image, Size } from '@sododeck/schema';

import { type AssetId, type AssetMeta, metaOf } from '../assets';
import { jsonEqual, toY, type YObject, type YValue } from '../convert';
import { DeckEditError } from '../errors';
import {
  clampImageSize,
  cropFrame,
  cropOverflows,
  imageBox,
  isWholeCrop,
  minCropFraction,
  roundCrop,
  type CropRect,
  type Point,
} from '../geometry';
import { appendAll, assetsMap, collectionMap, metaMap, type DeckDoc } from '../layout';
import { readObject } from '../read';
import { assertRefsExist, assertValid, validateObject } from '../validate';
import { createObject, writeField } from '../write';
import * as Y from 'yjs';
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
    assertRefsExist(doc, [{ path: 'group', id: group, target: 'groups' }]);
  }
  const current = map.get('group');
  if ((current ?? null) === group) return;
  ctx.transact(() => {
    if (group === null) map.delete('group');
    else writeField(map, 'images', 'group', group);
  });
}

/** Slack for comparing crop fractions with the minimum (they are written with 6 decimals). */
const CROP_SLACK = 1e-6;

function invalidCrop(message: string): DeckEditError {
  return new DeckEditError('invalid', [{ path: 'crop', message }]);
}

/**
 * Crops an image to `crop` (fractions of the picture, unflipped), or shows the whole picture
 * again with `null` (057). Writes `crop`, `size` and `position` in one transaction (one undo
 * step, never merged): the picture keeps its on-canvas scale and the part that stays visible does
 * not move (`cropFrame`). A crop equal to the whole picture is stored as no crop; values are
 * rounded to 6 decimals; an unchanged crop writes nothing. `locked` for a locked image (an image
 * in a locked group is itself locked, 054); `invalid` for a crop past the picture or under 32
 * canvas px a side at the current scale; `missing-reference` when the picture's facts are absent.
 */
export function setImageCrop(ctx: EditContext, id: Id, crop: CropRect | null): void {
  const { doc } = ctx;
  const map = requireEntry(collectionMap(doc, 'images'), id, 'Image');
  assertUnlocked(map, 'Image', id, 'crop it');
  const current = readObject('images', id, map) as unknown as Image;
  const facts = assetsMap(doc)?.get(current.asset);
  const width = facts?.get('width');
  const height = facts?.get('height');
  if (typeof width !== 'number' || typeof height !== 'number') {
    throw new DeckEditError('missing-reference', [
      { path: 'asset', message: `Picture "${current.asset}" has no stored size to crop by.` },
    ]);
  }
  const natural = { width, height };
  const next = crop === null || isWholeCrop(crop) ? undefined : roundCrop(crop);
  if (next !== undefined) {
    if (next.x < 0 || next.y < 0 || next.width <= 0 || next.height <= 0 || cropOverflows(next)) {
      throw invalidCrop('The crop must lie inside the picture.');
    }
    const min = minCropFraction(imageBox(current), natural, current.crop);
    if (next.width < min.width - CROP_SLACK || next.height < min.height - CROP_SLACK) {
      throw invalidCrop('The crop must stay at least 32 px a side on the canvas.');
    }
  }
  if (jsonEqual(current.crop, next)) return;
  const box = cropFrame(imageBox(current), natural, current.crop, next, current);
  const size = { width: box.width, height: box.height };
  const position = { x: box.x, y: box.y };
  const { crop: _old, ...rest } = current;
  assertValid(
    validateObject('images', { ...rest, size, position, ...(next ? { crop: next } : {}) }),
  );
  ctx.transact(() => {
    if (next === undefined) map.delete('crop');
    else writeField(map, 'images', 'crop', next);
    writeField(map, 'images', 'size', size);
    writeField(map, 'images', 'position', position);
  });
}

/**
 * Mirrors every listed image on one axis (`on`) or puts it back (057), in one transaction (one
 * undo step). Unflipping removes the key, as unlocking does. Images already as asked are left
 * alone; nothing changing writes nothing. `not-found` for an unknown id and `locked` for any
 * locked image, before anything is written: the app passes only the unlocked ones.
 */
export function setImageFlip(
  ctx: EditContext,
  ids: readonly Id[],
  axis: 'x' | 'y',
  on: boolean,
): void {
  const key = axis === 'x' ? 'flipX' : 'flipY';
  const list = collectionMap(ctx.doc, 'images');
  const maps = [...new Set(ids)].map((id) => {
    const map = requireEntry(list, id, 'Image');
    assertUnlocked(map, 'Image', id, 'flip it');
    return map;
  });
  const changing = maps.filter((map) => (map.get(key) === true) !== on);
  if (changing.length === 0) return;
  ctx.transact(() => {
    for (const map of changing) {
      if (on) writeField(map, 'images', key, true);
      else map.delete(key);
    }
  });
}
