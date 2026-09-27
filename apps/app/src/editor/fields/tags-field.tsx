import type { SododeckFile } from '@sododeck/schema';
import { TagInput } from '@sododeck/ui/components/tag-input';
import { useMemo } from 'react';

import { useUiStore } from '../../state/ui-store';
import { tagSuggestions } from '../inspector/derive';
import { FieldLabel } from './field-label';

/**
 * TAGS: chips plus an add field with suggestions from the deck (FR-005). Tags are trimmed,
 * lower-cased and unique; an added tag is announced. `onCommit(null)` clears the field.
 */
export function TagsField({
  deck,
  value,
  onCommit,
}: {
  deck: SododeckFile;
  value: readonly string[] | undefined;
  onCommit: (tags: string[] | null) => void;
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
        onValueChange={(next) => {
          const added = next.find((t) => !tags.includes(t));
          onCommit(next.length === 0 ? null : [...next]);
          if (added !== undefined) useUiStore.getState().announce(`${added} added`);
        }}
      />
    </div>
  );
}
