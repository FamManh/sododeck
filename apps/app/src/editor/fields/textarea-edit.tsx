import { Textarea } from '@sododeck/ui/components/textarea';
import { useId } from 'react';

import { useLiveField } from './use-live-field';

/**
 * Labelled markdown field that saves as the user types, like `FieldEdit` (`useLiveField`): one
 * focus session is one undo step, ⌘↵ ends it, Esc reverts. An empty value clears the field.
 * `hideLabel` drops the visible label when a surrounding field (Write / Preview) shows it.
 */
export function TextareaEdit({
  label,
  value,
  onCommit,
  placeholder,
  hideLabel = false,
  id: textareaId,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  hideLabel?: boolean;
  id?: string;
}) {
  const ownId = useId();
  const id = textareaId ?? ownId;
  const field = useLiveField({ label, value, onWrite: onCommit, multiline: true });

  return (
    <div className="flex flex-col gap-1.5">
      {!hideLabel && (
        <label htmlFor={id} className="text-micro text-ink-muted uppercase">
          {label} · Markdown
        </label>
      )}
      <Textarea
        id={id}
        aria-label={label}
        value={field.value}
        placeholder={placeholder}
        onChange={(event) => {
          field.onChange(event.target.value);
        }}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
      />
    </div>
  );
}
