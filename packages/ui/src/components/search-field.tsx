import { Search } from 'lucide-react';
import type * as React from 'react';

import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

type SearchFieldProps = Omit<React.ComponentProps<'input'>, 'type' | 'aria-label'> & {
  /** Accessible name. */
  label: string;
  /** Keyboard hint shown at the trailing edge, e.g. "⌘K". Decorative. */
  shortcut?: string;
  /** Called on Escape. */
  onClear?: () => void;
};

/**
 * Recessed search field (surface-2, leading icon, optional kbd hint). Text on surface-2 uses
 * ink-secondary: ink-muted is 4.40:1 there in light, below AA (research.md R5).
 * The focus outline sits on the wrapper so it surrounds the icon and hint too.
 */
function SearchField({
  label,
  shortcut,
  onClear,
  className,
  onKeyDown,
  ...props
}: SearchFieldProps) {
  return (
    <span
      data-slot="search-field"
      className={cn(
        'flex h-9 w-full min-w-0 items-center gap-2 rounded-input bg-surface-2 px-2.5 text-ink-secondary focus-within:outline-2 focus-within:outline-solid focus-within:outline-offset-2 focus-within:outline-primary',
        className,
      )}
    >
      <Search aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4 shrink-0" />
      <input
        type="search"
        aria-label={label}
        className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-secondary [&::-webkit-search-cancel-button]:hidden"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.key === 'Escape') onClear?.();
        }}
        {...props}
      />
      {shortcut && (
        <kbd
          aria-hidden="true"
          className="rounded-segment border border-border bg-surface px-1.5 font-sans text-caption text-ink-secondary"
        >
          {shortcut}
        </kbd>
      )}
    </span>
  );
}

export { SearchField };
