import { X } from 'lucide-react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

type TagChipProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  label: string;
  /** Shows a remove button; Backspace/Delete on that button also removes. */
  onRemove?: () => void;
  /** Ref to the remove button, so a TagInput can move focus between chips. */
  removeRef?: React.Ref<HTMLButtonElement>;
};

/** Pill with a label and an optional remove button (DESIGN.md tag chip). */
function TagChip({ label, onRemove, removeRef, className, ...props }: TagChipProps) {
  return (
    <span
      data-slot="tag-chip"
      className={cn(
        'inline-flex h-6.5 max-w-48 items-center gap-1 rounded-full bg-surface-2 pr-1 pl-2.5 text-body-sm text-ink-secondary',
        !onRemove && 'pr-2.5',
        className,
      )}
      {...props}
    >
      <span className="truncate" title={label}>
        {label}
      </span>
      {onRemove && (
        <button
          ref={removeRef}
          type="button"
          aria-label={`Remove tag ${label}`}
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
