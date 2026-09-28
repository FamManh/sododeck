import { Toolbar as ToolbarPrimitive } from 'radix-ui';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

/**
 * A floating row of icon buttons (DESIGN.md selection toolbar, design 98–104): 44 tall, one Tab
 * stop, ← / → / Home / End move between buttons (Radix roving focus). Name it with `aria-label`.
 */
function Toolbar({ className, ...props }: React.ComponentProps<typeof ToolbarPrimitive.Root>) {
  return (
    <ToolbarPrimitive.Root
      data-slot="toolbar"
      orientation="horizontal"
      className={cn(
        'flex h-11 items-center gap-0.5 rounded-card border border-hairline bg-surface p-1 text-ink shadow-hover',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A 34 px toolbar button. `data-state="open"` (a popover or menu trigger with `asChild`) shows
 * the open state in Orange Soft, together with `aria-expanded`.
 */
function ToolbarButton({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Button>) {
  return (
    <ToolbarPrimitive.Button
      data-slot="toolbar-button"
      className={cn(
        'inline-flex h-[34px] min-w-[34px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-button px-2 text-body-sm text-ink transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-primary-soft data-[state=open]:text-primary-ink [&_svg]:size-4 [&_svg]:shrink-0',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

/** A 1×20 divider between groups of buttons. */
function ToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Separator>) {
  return (
    <ToolbarPrimitive.Separator
      data-slot="toolbar-separator"
      className={cn('mx-1 h-5 w-px shrink-0 bg-hairline', className)}
      {...props}
    />
  );
}

/** Plain text in the toolbar, e.g. "3 selected"; not focusable. */
function ToolbarText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="toolbar-text"
      className={cn('px-2 text-body-sm whitespace-nowrap text-ink-secondary', className)}
      {...props}
    />
  );
}

export { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarText };
