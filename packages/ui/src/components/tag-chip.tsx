import { X } from 'lucide-react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

type TagChipProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  label: string;
  /** Shows a remove button; Backspace/Delete on that button also removes. */
  onRemove?: () => void;
  /** Accessible name of the remove button. Default "Remove tag <label>". */
  removeLabel?: string;
  /** Ref to the remove button, so a TagInput can move focus between chips. */
  removeRef?: React.Ref<HTMLButtonElement>;
  /** On only some of the selected objects (bulk edit): dashed border, not color alone. */
  partial?: boolean;
  /** Secondary text after the label, e.g. "2/3". */
  count?: string;
  /** Makes the label a button (e.g. "Add <tag> to all"); needs `activateLabel`. */
  onActivate?: () => void;
  activateLabel?: string;
};

/** Pill with a label and an optional remove button (DESIGN.md tag chip). */
function TagChip({
  label,
  onRemove,
  removeLabel,
  removeRef,
  partial = false,
  count,
  onActivate,
  activateLabel,
  className,
  ...props
}: TagChipProps) {
  const text = (
    <>
      <span className="truncate" title={label}>
        {label}
      </span>
      {count !== undefined && (
        <span className="shrink-0 text-caption text-ink-secondary">{count}</span>
      )}
    </>
  );
  return (
    <span
      data-slot="tag-chip"
      className={cn(
        'inline-flex h-6.5 max-w-48 items-center gap-1 rounded-full border border-transparent bg-surface-2 pr-1 pl-2.5 text-body-sm text-ink-secondary',
        partial && 'border-dashed border-ink-muted bg-transparent',
        !onRemove && 'pr-2.5',
        className,
      )}
      {...props}
    >
      {onActivate ? (
        <button
          type="button"
          aria-label={activateLabel}
          onClick={onActivate}
          className={cn(
            'inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-full hover:text-ink',
            focusRing,
          )}
        >
          {text}
        </button>
      ) : (
        text
      )}
      {onRemove && (
        <button
          ref={removeRef}
          type="button"
          aria-label={removeLabel ?? `Remove tag ${label}`}
          onClick={onRemove}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' || event.key === 'Delete') {
              event.preventDefault();
              onRemove();
            }
          }}
          className={cn(
            'inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-surface-3 hover:text-ink',
            focusRing,
          )}
        >
          <X aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
        </button>
      )}
    </span>
  );
}

export { TagChip };
