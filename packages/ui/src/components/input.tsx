import { CircleAlert } from 'lucide-react';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

/** Shared field look (DESIGN.md text-input): 36px, 10px radius, orange border on focus. */
const fieldClasses = cn(
  'h-9 w-full min-w-0 rounded-input border border-border bg-surface px-[11px] text-body text-ink transition-colors placeholder:text-ink-muted focus:border-primary disabled:cursor-not-allowed disabled:opacity-50',
  focusRing,
);

/**
 * Single-line text field. `invalid` adds aria-invalid, a clay border and an alert icon,
 * so the error state is never shown by color alone.
 */
function Input({
  className,
  invalid = false,
  ...props
}: React.ComponentProps<'input'> & { invalid?: boolean }) {
  const input = (
    <input
      data-slot="input"
      aria-invalid={invalid || undefined}
      className={cn(
        fieldClasses,
        invalid && 'border-clay-ink pr-8 focus:border-clay-ink',
        className,
      )}
      {...props}
    />
  );
  if (!invalid) return input;
  return (
    <span data-slot="input-wrapper" className="relative flex w-full items-center">
      {input}
      <CircleAlert
        aria-hidden
        strokeWidth={ICON_STROKE_WIDTH}
        className="pointer-events-none absolute right-2.5 size-4 text-clay-ink"
      />
    </span>
  );
}

export { Input };
