import { validateValue } from '@sododeck/model';
import { Input } from '@sododeck/ui/components/input';
import { useId, useState } from 'react';

import { ControlError } from './control-error';
import { parseNumber } from './parse-number';
import { describedBy } from './described-by';
import type { ValueControlProps } from './types';
import { useTextDraft } from './use-text-draft';

/**
 * Progress: a 0–100 `slider` and a number box beside it. The slider writes when released (one
 * undo step per drag); typing is checked (140 is refused with a message, edge cases spec).
 */
export function ProgressControl({
  field,
  labelId,
  value,
  mixed = false,
  onCommit,
  descriptionId,
}: ValueControlProps) {
  const errorId = useId();
  const numberId = useId();
  const stored = typeof value === 'number' ? Math.min(100, Math.max(0, value)) : 0;
  const [sliding, setSliding] = useState<number | null>(null);
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
  const release = () => {
    if (sliding !== null && sliding !== value) onCommit(sliding);
    setSliding(null);
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          aria-valuetext={mixed ? 'Mixed' : `${String(sliding ?? stored)} %`}
          value={sliding ?? stored}
          onChange={(event) => {
            setSliding(Number(event.target.value));
          }}
          onPointerUp={release}
          onKeyUp={release}
          onBlur={release}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-(--color-primary)"
        />
        <Input
          id={numberId}
          role="spinbutton"
          inputMode="numeric"
          aria-label={`${field.name} percent`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-invalid={draft.error !== null || undefined}
          aria-describedby={describedBy(descriptionId, draft.error !== null && errorId)}
          placeholder={mixed ? 'Mixed' : '—'}
          value={sliding === null ? draft.value : String(sliding)}
          onChange={(event) => {
            draft.onChange(event.target.value);
          }}
          onFocus={draft.onFocus}
          onBlur={draft.onBlur}
          onKeyDown={draft.onKeyDown}
          className="h-8 w-16 shrink-0 font-mono"
        />
        <span className="shrink-0 font-mono text-body-sm text-ink-secondary">%</span>
      </div>
      <ControlError id={errorId} message={draft.error} />
    </div>
  );
}
