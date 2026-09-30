/**
 * Deck-level custom colour swatches (020, research R3, ADR 0018). Stored as a `Y.Array<string>`
 * meta field like `tags`, but with its own cap and dedupe rules, so it gets its own ops rather
 * than going through the generic `updateMeta` patch.
 */
import * as Y from 'yjs';

import type { YValue } from '../convert';
import { metaMap, swatchesArray } from '../layout';
import { DeckEditError } from '../errors';
import type { EditContext } from './context';

/** A deck can hold at most this many custom colours (data-model.md). */
export const MAX_SWATCHES = 12;

// Must match $defs.HexColor.pattern in schema/v1.json.
const HEX_PATTERN = /^#[0-9a-f]{6}$/;

function normalizeHex(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_PATTERN.test(withHash) ? withHash : null;
}

/** The array attached to the document, creating it if a doc predates it (`fromJSON` already does). */
function attachedSwatches(ctx: EditContext): Y.Array<YValue> {
  const meta = metaMap(ctx.doc);
  const existing = meta.get('swatches');
  if (existing instanceof Y.Array) return existing;
  const array = new Y.Array<YValue>();
  meta.set('swatches', array);
  return array;
}

/**
 * Adds a custom hex colour to the deck's swatches: normalizes to lowercase `#rrggbb`, is a no-op
 * on a duplicate, and throws `DeckEditError('invalid')` at the {@link MAX_SWATCHES} cap (a file
 * loaded with more swatches than the cap is left as is).
 */
export function addSwatch(ctx: EditContext, hex: string): void {
  const normalized = normalizeHex(hex);
  if (normalized === null) {
    throw new DeckEditError('invalid', [
      { path: 'swatches', message: `"${hex}" is not a 6-digit hex colour.` },
    ]);
  }
  const current = swatchesArray(ctx.doc).toArray() as string[];
  if (current.includes(normalized)) return;
  if (current.length >= MAX_SWATCHES) {
    throw new DeckEditError('invalid', [
      {
        path: 'swatches',
        message: `A deck can have at most ${String(MAX_SWATCHES)} custom colours.`,
      },
    ]);
  }
  ctx.transact(() => {
    attachedSwatches(ctx).push([normalized]);
  });
}

/**
 * Removes a custom hex colour from the deck's swatches. Does nothing when the colour is absent.
 * Never touches any node or group's `style` — a card keeps its stored colour even after its
 * swatch is removed (data-model.md).
 */
export function removeSwatch(ctx: EditContext, hex: string): void {
  const normalized = normalizeHex(hex) ?? hex.trim().toLowerCase();
  const current = swatchesArray(ctx.doc).toArray() as string[];
  if (!current.includes(normalized)) return;
  ctx.transact(() => {
    const array = attachedSwatches(ctx);
    for (let i = array.length - 1; i >= 0; i--) {
      if (array.get(i) === normalized) array.delete(i, 1);
    }
  });
}
