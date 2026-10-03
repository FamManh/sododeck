import { validateValue } from '@sododeck/model';
import { Input } from '@sododeck/ui/components/input';
import { useId } from 'react';

import { ControlError } from './control-error';
import { parseNumber } from './parse-number';
import { describedBy } from './described-by';
import type { ValueControlProps } from './types';
import { useTextDraft } from './use-text-draft';

/** Number: a `spinbutton` with the unit after it; letters are refused with a message. */
export function NumberControl({
  field,
  labelId,
  value,
  mixed = false,
  onCommit,
  descriptionId,
}: ValueControlProps) {
  const errorId = useId();
  const unitId = useId();
  const draft = useTextDraft(typeof value === 'number' ? String(value) : '', (text) => {
    if (text.trim() === '') {
      onCommit(null);
      return null;
    }
    const next = parseNumber(text);
    const message = validateValue(field, next);
    if (message === null) onCommit(next);
    return message;
  });
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <Input
          role="spinbutton"
          inputMode="decimal"
          aria-labelledby={field.unit === undefined ? labelId : `${labelId} ${unitId}`}
          aria-valuenow={typeof value === 'number' ? value : undefined}
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
          className="h-8 font-mono"
        />
        {field.unit !== undefined && (
          <span id={unitId} className="shrink-0 font-mono text-body-sm text-ink-secondary">
            {field.unit}
          </span>
        )}
      </div>
      <ControlError id={errorId} message={draft.error} />
    </div>
  );
}
