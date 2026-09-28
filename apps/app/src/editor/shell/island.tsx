import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import type { ComponentProps } from 'react';

import type { RegionId } from './regions';

/**
 * A floating island of the canvas-first shell (018, DESIGN.md "Islands"): a named toolbar and an
 * F6 region. It takes pointer events back from the overlay layer; its position comes from
 * `className` (12 px from the viewport edges).
 */
export function Island({
  region,
  label,
  orientation = 'horizontal',
  className,
  children,
  ...props
}: Omit<ComponentProps<'div'>, 'role'> & {
  region: RegionId;
  label: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      data-region={region}
      tabIndex={-1}
      className={cn(
        'pointer-events-auto absolute flex gap-0.5 rounded-card border border-hairline bg-surface p-1 shadow-rest',
        orientation === 'horizontal' ? 'h-11 items-center' : 'w-12 flex-col items-center',
        // F6 lands on the island itself: the whole island shows the focus ring (FR-036).
        focusRing,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A 1 px divider between island groups. */
export function IslandDivider({ vertical = true }: { vertical?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn('shrink-0 bg-hairline', vertical ? 'mx-1 h-5 w-px' : 'my-1 h-px w-5.5')}
    />
  );
}
