import { RadioGroup } from 'radix-ui';
import type * as React from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

/**
 * 2–3 mutually exclusive options on a surface-2 track (DESIGN.md segmented control).
 * Built on Radix RadioGroup: arrow keys move the selection (radio semantics) and the value can
 * never be cleared. The active item is raised and heavier, so the state is not color-only.
 */
function SegmentedControl({ className, ...props }: React.ComponentProps<typeof RadioGroup.Root>) {
  return (
    <RadioGroup.Root
      data-slot="segmented-control"
      orientation="horizontal"
      className={cn(
        'inline-flex h-8 items-center gap-0.5 rounded-button bg-surface-2 p-0.5',
        className,
      )}
      {...props}
    />
  );
}

function SegmentedControlItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroup.Item>) {
  return (
    <RadioGroup.Item
      data-slot="segmented-control-item"
      className={cn(
        'inline-flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-segment px-3 text-body-sm text-ink-secondary transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:bg-surface data-[state=checked]:font-medium data-[state=checked]:text-ink data-[state=checked]:shadow-rest [&_svg]:size-4',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
