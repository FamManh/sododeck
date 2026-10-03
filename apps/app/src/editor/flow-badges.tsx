import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleX } from 'lucide-react';

import type { EdgeBadge } from './flows/flow-overlay';

/**
 * The step number inside a connector's label pill (035 FR-010, FR-011). The pill (size, fill,
 * border) belongs to the label; the number takes its text colour. An error path adds a ⊗ icon and a
 * chain break a Clay chip, so neither relies on colour.
 */
export function StepBadge({ badge }: { badge: EdgeBadge }) {
  return (
    <span
      role="img"
      aria-label={`Step ${badge.label}${badge.errorPath ? ', error path' : ''}${badge.chainBreak ? ', chain break' : ''}`}
      className={cn(
        'inline-flex items-center gap-0.5 leading-none font-semibold',
        badge.chainBreak && 'rounded-full bg-clay-soft px-1 py-0.5 text-clay-ink',
      )}
    >
      {badge.errorPath && (
        <CircleX aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
      )}
      {badge.label}
    </span>
  );
}
