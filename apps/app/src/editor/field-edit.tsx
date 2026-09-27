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
  /** Id of a `<datalist>` of suggestions. */
  list?: string;
  /** Monospace value (conditions, SLA). */
  mono?: boolean;
  /** Id of the input, so callers can focus it. */
  id?: string;
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
  list,
  mono = false,
  id: inputId,
}: FieldEditProps) {
  const ownId = useId();
  const id = inputId ?? ownId;
  const field = useLiveField({ label, value, onWrite: onCommit, required: !allowEmpty });
  const message = field.error ?? error;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-micro text-ink-muted uppercase">
        {label}
      </label>
      <Input
        id={id}
        aria-label={label}
        value={field.value}
        placeholder={placeholder}
        list={list}
        // Not Input's `invalid` prop: it changes the DOM shape, which would drop focus mid-edit.
        aria-invalid={message !== undefined || undefined}
        className={cn(
          message !== undefined && 'border-clay-ink focus:border-clay-ink',
          mono && 'font-mono',
        )}
        aria-describedby={message === undefined ? undefined : `${id}-error`}
        onChange={(event) => {
          field.onChange(event.target.value);
        }}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
      />
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
