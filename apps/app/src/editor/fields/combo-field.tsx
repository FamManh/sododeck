import { Combobox } from '@sododeck/ui/components/combobox';
import { cn } from '@sododeck/ui/lib/utils';
import { useId } from 'react';

import { FieldError } from '../field-edit';
import { FieldLabel } from './field-label';
import { useLiveField } from './use-live-field';

/**
 * A free-text field with suggestions that saves as the user types (owner, §g-10, §g-26). With
 * `mixed` it shows the "Mixed" placeholder (italic, accessible description "Mixed values") and
 * changes nothing until the user types (FR-014); `hint` shows e.g. "Same on all 3".
 */
export function ComboField({
  label,
  listLabel,
  value,
  options,
  onCommit,
  placeholder,
  mixed = false,
  hint,
}: {
  label: string;
  listLabel: string;
  value: string;
  options: readonly string[];
  /** Receives the trimmed text; `''` means clear. */
  onCommit: (value: string) => void;
  placeholder?: string;
  mixed?: boolean;
  hint?: string;
}) {
  const id = useId();
  const field = useLiveField({ label, value, onWrite: onCommit });
  const describedBy = [mixed ? `${id}-mixed` : null, hint === undefined ? null : `${id}-hint`]
    .filter((x) => x !== null)
    .join(' ');
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        id={id}
        mode="free"
        label={label}
        listLabel={listLabel}
        value={field.value}
        onValueChange={field.onChange}
        options={options}
        placeholder={mixed ? 'Mixed' : placeholder}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
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
      {field.error !== undefined && <FieldError id={`${id}-error`}>{field.error}</FieldError>}
    </div>
  );
}
