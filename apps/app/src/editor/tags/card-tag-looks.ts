/**
 * The tag pills of a card (033): each tag of the first ten with the colours of its own tag, found
 * by key in the deck's `tagColors`. Pure; `deck-to-flow.ts` caches the result per card.
 */
import { tagKey } from '@sododeck/model';
import type { ColorRef, SododeckFile } from '@sododeck/schema';

import { cardTags } from '../card-tags';
import { tagColours, type TagLook } from './tag-colours';

/** Tag key → colour; one per `tagColors` object, so a change of colours is a change of identity. */
export type TagColourMap = ReadonlyMap<string, ColorRef>;

const NONE: TagColourMap = new Map();
const NO_LOOKS: readonly TagLook[] = [];
const mapCache = new WeakMap<object, TagColourMap>();

/** The lookup for a deck's `tagColors`, built once per object (a shared empty map for none). */
export function tagColourMap(tagColors: SododeckFile['tagColors']): TagColourMap {
  if (tagColors === undefined) return NONE;
  let map = mapCache.get(tagColors);
  if (map === undefined) {
    map = new Map(Object.entries(tagColors).map(([tag, colour]) => [tagKey(tag), colour]));
    mapCache.set(tagColors, map);
  }
  return map;
}

/** A card's pills: the first ten tags as stored, each with its tag's colours, slate when none. */
export function cardTagLooks(
  tags: readonly string[] | undefined,
  colours: TagColourMap,
): readonly TagLook[] {
  const shown = cardTags(tags);
  if (shown.length === 0) return NO_LOOKS;
  return shown.map((text) => ({ text, ...tagColours(colours.get(tagKey(text))) }));
}

/** Same pills, same colours, in the same order. */
export function sameTagLooks(a: readonly TagLook[], b: readonly TagLook[]): boolean {
  if (a === b) return true;
  return (
    a.length === b.length &&
    a.every((look, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        look.text === other.text &&
        look.chip === other.chip &&
        look.ink === other.ink &&
        look.dot === other.dot
      );
    })
  );
}
