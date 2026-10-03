import { isDateString, validateValue } from '@sododeck/model';
import { Input } from '@sododeck/ui/components/input';
import { useId, useState } from 'react';

import { ControlError } from './control-error';
import { describedBy } from './described-by';
import type { ValueControlProps } from './types';

function rangeOf(value: unknown): { from: string; to: string } {
  if (value !== null && typeof value === 'object' && 'from' in value && 'to' in value) {
    const { from, to } = value;
    return { from: isDateString(from) ? from : '', to: isDateString(to) ? to : '' };
  }
  return { from: '', to: '' };
}

/**
 * Date range: a `group` named by the field with "From" and "To" date inputs. Writes once both
 * ends are set; an end before the start is refused with a message (FR-015).
 */
export function DateRangeControl({
  field,
  labelId,
  value,
  onCommit,
  descriptionId,
}: ValueControlProps) {
  const errorId = useId();
  const stored = rangeOf(value);
  const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = draft ?? stored;
  const change = (patch: Partial<{ from: string; to: string }>) => {
    const next = { ...shown, ...patch };
    if (next.from === '' && next.to === '') {
      setDraft(null);
      setError(null);
      onCommit(null);
      return;
    }
    if (next.from === '' || next.to === '') {
      setDraft(next);
      setError(null);
      return;
    }
    const message = validateValue(field, next);
    setError(message);
    if (message === null) {
      setDraft(null);
      onCommit(next);
    } else {
      setDraft(next);
    }
  };
  return (
    <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-1">
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <Input
          type="date"
          aria-label="From"
          value={shown.from}
          aria-invalid={error !== null || undefined}
          aria-describedby={describedBy(descriptionId, error !== null && errorId)}
          onChange={(event) => {
            change({ from: event.target.value });
          }}
          className="h-8 font-mono"
        />
        <Input
          type="date"
          aria-label="To"
          value={shown.to}
          aria-invalid={error !== null || undefined}
          aria-describedby={describedBy(descriptionId, error !== null && errorId)}
          onChange={(event) => {
            change({ to: event.target.value });
          }}
          className="h-8 font-mono"
        />
      </div>
      <ControlError id={errorId} message={error} />
    </div>
  );
}
