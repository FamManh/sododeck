/** Option lists of the component inspectors (single and bulk). */
import { CATEGORIES, cardType, deckPacks, typesOfPacks } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import type { ComboboxOption } from '@sododeck/ui/components/combobox';

export const NO_GROUP = '';

/** Heading for a type id this version does not know. */
const OTHER_GROUP = 'Other';

/**
 * Options of the Type pickers (030): the types of the packs that are on, in registry order and
 * grouped by category, plus each selected card's current type even when its pack is off or the
 * id is unknown (so the picker never hides what a card is).
 */
export function typeOptions(
  deck: SododeckFile,
  currentIds: readonly string[] = [],
): ComboboxOption[] {
  const categoryName = new Map(CATEGORIES.map((c) => [c.id, c.name]));
  const listed = typesOfPacks(deckPacks(deck));
  const extra = [...new Set(currentIds)].filter((id) => !listed.some((t) => t.id === id));
  const options = listed.map((t) => ({
    value: t.id,
    label: t.name,
    group: categoryName.get(t.category) ?? OTHER_GROUP,
  }));
  for (const id of extra) {
    const known = cardType(id);
    options.push({
      value: id,
      label: known?.name ?? id,
      group: (known && categoryName.get(known.category)) ?? OTHER_GROUP,
    });
  }
  // Keep each heading's options together, headings in category order, "Other" last.
  const order = [...CATEGORIES.map((c) => c.name), OTHER_GROUP];
  return options.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

/** Existing groups, then "No group" (groups are created in 010). */
export function groupOptions(deck: SododeckFile): ComboboxOption[] {
  return [
    ...deck.groups.map((g) => ({ value: g.id, label: g.title })),
    { value: NO_GROUP, label: 'No group' },
  ];
}

export function groupName(deck: SododeckFile, groupId: string | undefined): string {
  return deck.groups.find((g) => g.id === groupId)?.title ?? 'No group';
}
