/** Option lists of the component inspectors (single and bulk). */
import type { SododeckFile } from '@sododeck/schema';
import type { ComboboxOption } from '@sododeck/ui/components/combobox';
import { COMPONENT_KINDS, KIND_STYLE } from '@sododeck/ui/lib/icons';

export const NO_GROUP = '';

export const KIND_OPTIONS: readonly ComboboxOption[] = COMPONENT_KINDS.map((kind) => ({
  value: kind,
  label: KIND_STYLE[kind].label,
}));

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
