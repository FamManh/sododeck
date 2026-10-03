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
  /** A tag's colour (033): CSS values, tokens or a hex. Absent keeps the neutral Surface 2 chip. */
  colour?: { chip: string; ink: string };
  /** `deck` is the 21 px chip of the drawer tag row (DESIGN.md `tag-chip`); default is 26 px. */
  size?: 'default' | 'deck';
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
  colour,
  size = 'default',
  style,
  className,
  ...props
}: TagChipProps) {
  const text = (
    <>
      <span className="truncate" title={label}>
        {label}
      </span>
      {count !== undefined && <span className="shrink-0 text-caption">{count}</span>}
    </>
  );
  return (
    <span
      data-slot="tag-chip"
      style={
        colour === undefined
          ? style
          : ({
              '--tag-chip': colour.chip,
              '--tag-ink': colour.ink,
              ...style,
            } as React.CSSProperties)
      }
      className={cn(
        'inline-flex max-w-48 items-center gap-1 rounded-full border border-transparent pr-1 pl-2.5',
        size === 'deck' ? 'h-[21px] text-[10.5px] leading-none font-medium' : 'h-6.5 text-body-sm',
        colour === undefined
          ? 'bg-surface-2 text-ink-secondary'
          : 'bg-(--tag-chip) text-(--tag-ink)',
        // Dashed means "on some"; the border follows the ink so it reads on the tint, and the
        // fill stays so a coloured tag keeps its colour.
        partial &&
          (colour === undefined
            ? 'border-dashed border-ink-muted bg-transparent'
            : 'border-dashed border-(--tag-ink)'),
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
