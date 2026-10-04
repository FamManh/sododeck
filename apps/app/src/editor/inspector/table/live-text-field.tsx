import { Input } from '@sododeck/ui/components/input';
import { Textarea } from '@sododeck/ui/components/textarea';
import { cn } from '@sododeck/ui/lib/utils';
import { useId } from 'react';

import { FieldError } from '../../field-edit';
import { FieldLabel } from '../../fields/field-label';
import { useLiveField } from '../../fields/use-live-field';

/**
 * A text field of the table drawer that saves while typing (one undo step per focus) and can
 * refuse a draft with `validate` (duplicate names). An empty value clears an optional field.
 * `hideLabel` keeps the name for assistive tech only, for fields inside a row.
 */
export function LiveTextField({
  label,
  value,
  onWrite,
  validate,
  required = false,
  placeholder,
  mono = false,
  multiline = false,
  hideLabel = false,
  disabled = false,
}: {
  label: string;
  value: string;
  /** Receives the trimmed text; `''` means clear. */
  onWrite: (text: string) => void;
  validate?: (text: string) => string | undefined;
  required?: boolean;
  placeholder?: string;
  mono?: boolean;
  multiline?: boolean;
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const field = useLiveField({ label, value, onWrite, required, validate, multiline });
  const message = field.error;
  const shared = {
    id,
    'aria-label': label,
    value: field.value,
    placeholder,
    disabled,
    'aria-invalid': message !== undefined || undefined,
    'aria-describedby': message === undefined ? undefined : `${id}-error`,
    onFocus: field.onFocus,
    onBlur: field.onBlur,
    onKeyDown: field.onKeyDown,
  };
  const className = cn(
    message !== undefined && 'border-clay-ink focus:border-clay-ink',
    mono && 'font-mono',
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {!hideLabel && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      {multiline ? (
        <Textarea
          {...shared}
          className={className}
          onChange={(event) => {
            field.onChange(event.target.value);
          }}
        />
      ) : (
        <Input
          {...shared}
          className={className}
          onChange={(event) => {
            field.onChange(event.target.value);
          }}
        />
      )}
      {message !== undefined && <FieldError id={`${id}-error`}>{message}</FieldError>}
    </div>
  );
}
