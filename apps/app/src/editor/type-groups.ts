import { CATEGORIES, cardType, deckPacks, typeName, typesOfPacks } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

export interface TypeGroup {
  /** Category heading ("Process"); "Other" for ids this version does not know. */
  name: string;
  types: readonly { id: string; name: string }[];
}

const OTHER = 'Other';

/**
 * Card types grouped by category, in registry order (030): the types of the packs that are on,
 * the types the deck's cards use, and any already chosen ids. A type whose pack is off stays
 * listed while a card or a saved view still uses it, so it can always be unticked.
 */
export function typeGroups(deck: SododeckFile, chosen: readonly string[] = []): TypeGroup[] {
  const ids = new Set<string>([
    ...typesOfPacks(deckPacks(deck)).map((t) => t.id),
    ...deck.nodes.map((n) => n.type),
    ...chosen,
  ]);
  const known = [...ids]
    .map((id) => cardType(id))
    .filter((t) => t !== undefined)
    .sort((a, b) => a.order - b.order);
  const unknown = [...ids].filter((id) => cardType(id) === undefined).sort();
  const groups: TypeGroup[] = CATEGORIES.map((category) => ({
    name: category.name,
    types: known.filter((t) => t.category === category.id).map((t) => ({ id: t.id, name: t.name })),
  })).filter((group) => group.types.length > 0);
  if (unknown.length > 0) {
    groups.push({ name: OTHER, types: unknown.map((id) => ({ id, name: typeName(id) })) });
  }
  return groups;
}
