import { Input } from '@sododeck/ui/components/input';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleAlert } from 'lucide-react';
import { useId } from 'react';

import { useLiveField } from './fields/use-live-field';

interface FieldEditProps {
  label: string;
  /** The committed value, owned by the document. */
  value: string;
  /** Writes the trimmed text while typing; an empty value only when `allowEmpty`. */
  onCommit: (value: string) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  /** An error from outside (e.g. Done with an empty branch field), shown with an icon. */
  error?: string;
  /** Monospace value (conditions, SLA). */
  mono?: boolean;
  /** Id of the input, so callers can focus it. */
  id?: string;
  /** Bulk edit: the values differ; shows an italic "Mixed" and writes nothing until typing. */
  mixed?: boolean;
  /** Secondary line under the field, e.g. "Same on all 3". */
  hint?: string;
}

/**
 * Labelled text field that saves as the user types (FR-002, `useLiveField`): one focus session
 * is one undo step. Escape reverts to the value from before focus. A required field never writes
 * an empty value; on Enter or blur it shows the error and keeps the old value in the document.
 */
export function FieldEdit({
  label,
  value,
  onCommit,
  allowEmpty = false,
  placeholder,
  error,
  mono = false,
  id: inputId,
  mixed = false,
  hint,
}: FieldEditProps) {
  const ownId = useId();
  const id = inputId ?? ownId;
  const field = useLiveField({ label, value, onWrite: onCommit, required: !allowEmpty });
  const message = field.error ?? error;
  const describedBy = [
    mixed ? `${id}-mixed` : null,
    hint === undefined ? null : `${id}-hint`,
    message === undefined ? null : `${id}-error`,
  ]
    .filter((x) => x !== null)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-micro text-ink-muted uppercase">
        {label}
      </label>
      <Input
        id={id}
        aria-label={label}
        value={field.value}
        placeholder={mixed ? 'Mixed' : placeholder}
        // Not Input's `invalid` prop: it changes the DOM shape, which would drop focus mid-edit.
        aria-invalid={message !== undefined || undefined}
        className={cn(
          message !== undefined && 'border-clay-ink focus:border-clay-ink',
          mono && 'font-mono',
          mixed && 'placeholder:italic',
        )}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={(event) => {
          field.onChange(event.target.value);
        }}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
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
      {message !== undefined && <FieldError id={`${id}-error`}>{message}</FieldError>}
    </div>
  );
}

/** Inline error: icon + text (never color alone). */
export function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <span id={id} className="flex items-center gap-1 text-caption text-clay-ink">
      <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}
