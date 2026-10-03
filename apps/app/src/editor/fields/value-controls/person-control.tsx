import { Combobox } from '@sododeck/ui/components/combobox';
import { useId } from 'react';

import { ControlError } from './control-error';
import { describedBy } from './described-by';
import type { ValueControlProps } from './types';
import { useTextDraft } from './use-text-draft';

/**
 * Person (and Owner): free text with the deck's names as suggestions (FR-014b). The model writes
 * the deck's existing spelling of a name typed in another case; there is no people list.
 */
export function PersonControl({
  field,
  labelId,
  value,
  mixed = false,
  onCommit,
  people = [],
  descriptionId,
}: ValueControlProps) {
  const errorId = useId();
  const draft = useTextDraft(typeof value === 'string' ? value : '', (text) => {
    onCommit(text.trim() === '' ? null : text.trim());
    return null;
  });
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Combobox
        mode="free"
        aria-labelledby={labelId}
        listLabel={`${field.name} suggestions`}
        aria-describedby={describedBy(descriptionId, draft.error !== null && errorId)}
        value={draft.value}
        options={people}
        chevron={false}
        placeholder={mixed ? 'Mixed' : 'Add a name'}
        onValueChange={draft.onChange}
        onOptionSelect={(name) => {
          draft.onChange(name);
          onCommit(name);
        }}
        onFocus={draft.onFocus}
        onBlur={draft.onBlur}
        onKeyDown={draft.onKeyDown}
        className="h-8"
      />
      <ControlError id={errorId} message={draft.error} />
    </div>
  );
}
