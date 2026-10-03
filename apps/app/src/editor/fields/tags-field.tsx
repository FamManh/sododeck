import type { SododeckFile } from '@sododeck/schema';
import { TagInput } from '@sododeck/ui/components/tag-input';
import { useMemo } from 'react';

import { useUiStore } from '../../state/ui-store';
import { tagSuggestions } from '../inspector/derive';
import { canonicalTag } from '../tags/deck-tags';
import { FieldLabel } from './field-label';

/**
 * TAGS: chips plus an add field with suggestions from the deck (FR-005). Tags are trimmed, keep
 * their case, and are unique by key ("pic" next to "PIC" is the same tag, 033); an added tag is announced. `onCommit(null)` clears the field.
 */
export function TagsField({
  deck,
  value,
  onCommit,
  max,
}: {
  deck: SododeckFile;
  value: readonly string[] | undefined;
  onCommit: (tags: string[] | null) => void;
  /** E.g. ten on a card (2026-10-03); unlimited by default. */
  max?: number;
}) {
  const suggestions = useMemo(() => tagSuggestions(deck), [deck]);
  const tags = value ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Tags</FieldLabel>
      <TagInput
        label="Add tag"
        placeholder="+ Add tag"
        value={tags}
        suggestions={suggestions}
        {...(max === undefined ? {} : { max })}
        onValueChange={(typed) => {
          // A tag the deck already spells ("PIC") is written in that spelling, never a second one.
          const next = typed.map((t) => (tags.includes(t) ? t : (canonicalTag(deck, t) ?? t)));
          const added = next.find((t) => !tags.includes(t));
          onCommit(next.length === 0 ? null : next);
          if (added !== undefined) useUiStore.getState().announce(`${added} added`);
        }}
      />
    </div>
  );
}
