import { Combobox, type ComboboxOption } from '@sododeck/ui/components/combobox';
import { cn } from '@sododeck/ui/lib/utils';
import { useId } from 'react';

import { FieldError } from '../field-edit';
import { FieldLabel } from './field-label';

/**
 * A choice among existing values (kind, group, a connection's ends), as a pick-mode combobox:
 * typing filters, free text is refused. `mixed` shows "Mixed" until a value is picked.
 */
export function PickField({
  label,
  listLabel,
  value,
  options,
  onPick,
  mixed = false,
  hint,
  error,
}: {
  label: string;
  listLabel: string;
  value: string;
  options: readonly ComboboxOption[];
  onPick: (value: string) => void;
  mixed?: boolean;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const describedBy = [
    mixed ? `${id}-mixed` : null,
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ]
    .filter((x) => x !== null)
    .join(' ');
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        id={id}
        mode="pick"
        label={label}
        listLabel={listLabel}
        value={mixed ? '' : value}
        options={options}
        onValueChange={onPick}
        placeholder={mixed ? 'Mixed' : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        aria-invalid={error !== undefined || undefined}
        className={cn(mixed && 'placeholder:italic')}
      />
      {mixed && (
        <span id={`${id}-mixed`} className="sr-only">
          Mixed values
        </span>
      )}
      {hint !== undefined && (
        <span id={`${id}-hint`} className="text-caption text-ink-secondary">
          {hint}
        </span>
      )}
      {error !== undefined && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}
