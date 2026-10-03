/**
 * Deck-wide tag operations (033, ADR 0022). A tag is its text, matched by `tagKey`; its colour
 * lives in `meta.tagColors` (tag → colour). Each op is one transaction and one undo step.
 */
import type { ColorRef } from '@sododeck/schema';
import * as Y from 'yjs';

import type { YValue } from '../convert';
import { DeckEditError } from '../errors';
import { metaMap, tagColorsMap } from '../layout';
import { tagKey } from '../tags';
import { assertValid, validateObject } from '../validate';
import type { EditContext } from './context';

/** The tag text as stored: trimmed and single-spaced, in the case it was given. */
function tidy(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** The map attached to the document, creating it if a stored document predates it. */
function attachedTagColors(ctx: EditContext): Y.Map<string> {
  const meta = metaMap(ctx.doc);
  if (!(meta.get('tagColors') instanceof Y.Map)) meta.set('tagColors', new Y.Map<YValue>());
  return tagColorsMap(ctx.doc);
}

/** The spelling a tag's colour is stored under, if it has one. */
function storedSpelling(ctx: EditContext, key: string): string | undefined {
  for (const spelling of tagColorsMap(ctx.doc).keys()) {
    if (tagKey(spelling) === key) return spelling;
  }
  return undefined;
}

/**
 * Sets (`color`) or clears (`null`) a tag's colour. The entry keeps the spelling it already has,
 * so "pic" colours "PIC" when that is the stored key. Does nothing, and writes no transaction,
 * when the colour is already as asked. `invalid` for an empty tag or a colour that is not a card
 * colour name or `#rrggbb`.
 */
export function setTagColor(ctx: EditContext, tag: string, color: ColorRef | null): void {
  const key = tagKey(tag);
  const existing = key === '' ? undefined : storedSpelling(ctx, key);

  if (color === null) {
    if (existing === undefined) return;
    ctx.transact(() => {
      tagColorsMap(ctx.doc).delete(existing);
    });
    return;
  }

  if (key === '') {
    throw new DeckEditError('invalid', [{ path: 'tagColors', message: 'A tag cannot be empty.' }]);
  }
  const spelling = existing ?? tidy(tag);
  assertValid(validateObject('meta', { tagColors: { [spelling]: color } }));
  if (tagColorsMap(ctx.doc).get(spelling) === color) return;
  ctx.transact(() => {
    attachedTagColors(ctx).set(spelling, color);
  });
}
