import { useRef, useState } from 'react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

type InlineEditProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'aria-label'
> & {
  /** The committed value, owned by the caller (e.g. the Yjs document). */
  value: string;
  /** Called with the new value on Enter or blur, only when it changed. */
  onCommit: (value: string) => void;
  /** Accessible name; inline edits have no visible label. */
  label: string;
};

/**
 * Text that reads as plain text until hovered or focused (DESIGN.md inline-edit).
 * Holds only the in-progress draft; Escape throws the draft away.
 */
function InlineEdit({
  value,
  onCommit,
  label,
  className,
  onKeyDown,
  onBlur,
  ...props
}: InlineEditProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs the field; the blur must not commit the draft that was just thrown away.
  const cancelled = useRef(false);
  const shown = draft ?? value;

  function commit() {
    if (!cancelled.current && draft !== null && draft !== value) onCommit(draft);
    cancelled.current = false;
    setDraft(null);
  }

  return (
    <input
      data-slot="inline-edit"
      aria-label={label}
      value={shown}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === 'Enter') {
          commit();
        } else if (event.key === 'Escape') {
          cancelled.current = true;
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
      onBlur={(event) => {
        onBlur?.(event);
        commit();
      }}
      className={cn(
        'h-8 min-w-0 rounded-input border border-transparent bg-transparent px-1.5 text-ink transition-colors hover:border-border focus:border-primary',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export { InlineEdit };
