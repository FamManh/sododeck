import { validateValue } from '@sododeck/model';
import { Input } from '@sododeck/ui/components/input';
import { useId } from 'react';

import { ControlError } from './control-error';
import { describedBy } from './described-by';
import type { ValueControlProps } from './types';
import { useTextDraft } from './use-text-draft';

/** Text: a `textbox`; an empty entry clears the value. */
export function TextControl({
  field,
  labelId,
  value,
  mixed = false,
  onCommit,
  descriptionId,
}: ValueControlProps) {
  const errorId = useId();
  const draft = useTextDraft(typeof value === 'string' ? value : '', (text) => {
    const next = text.trim() === '' ? null : text;
    const message = next === null ? null : validateValue(field, next);
    if (message === null) onCommit(next);
    return message;
  });
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Input
        aria-labelledby={labelId}
        aria-invalid={draft.error !== null || undefined}
        aria-describedby={describedBy(descriptionId, draft.error !== null && errorId)}
        placeholder={mixed ? 'Mixed' : 'Empty'}
        value={draft.value}
        onChange={(event) => {
          draft.onChange(event.target.value);
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
