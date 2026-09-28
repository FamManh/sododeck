import { useEffect, useRef, useState } from 'react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

type InlineEditProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'onKeyDown'
> & {
  /** The committed value, owned by the caller (e.g. the Yjs document). */
  value: string;
  /** Called with the draft on Enter or blur, only when it differs from `value`. */
  onCommit: (value: string) => void;
  /** Accessible name; inline edits have no visible label. `aria-label` overrides it. */
  label: string;
  /** Focuses the field and selects all of its text on mount. */
  autoFocus?: boolean;
  /** The draft starts as `''` instead of `value` (a new object being named, 019). */
  startEmpty?: boolean;
  /** Called on Escape, after the draft was thrown away. */
  onCancel?: () => void;
  /**
   * Runs before the built-in keys, with the current draft. `preventDefault()` here skips the
   * built-in Enter (commit) and Escape (revert).
   */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>, draft: string) => void;
};

/**
 * Text that reads as plain text until hovered or focused (DESIGN.md inline-edit).
 * Holds only the in-progress draft; Escape throws the draft away.
 */
function InlineEdit({
  value,
  onCommit,
  label,
  autoFocus = false,
  startEmpty = false,
  onCancel,
  className,
  onKeyDown,
  onBlur,
  'aria-label': ariaLabel,
  ...props
}: InlineEditProps) {
  const [draft, setDraft] = useState<string | null>(startEmpty ? '' : null);
  // Escape blurs the field; the blur must not commit the draft that was just thrown away.
  const cancelled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const shown = draft ?? value;

  useEffect(() => {
    if (!autoFocus) return;
    input.current?.focus();
    input.current?.select();
    // Only on mount: a later value change must not steal the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit() {
    if (!cancelled.current && draft !== null && draft !== value) onCommit(draft);
    cancelled.current = false;
    setDraft(null);
  }

  return (
    <input
      ref={input}
      data-slot="inline-edit"
      aria-label={ariaLabel ?? label}
      value={shown}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event, shown);
        if (event.defaultPrevented) return;
        if (event.key === 'Enter') {
          commit();
        } else if (event.key === 'Escape') {
          cancelled.current = true;
          setDraft(null);
          event.currentTarget.blur();
          onCancel?.();
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
