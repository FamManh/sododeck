import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleAlert } from 'lucide-react';

import type { EdgeBadge } from './flows/flow-overlay';

export function StepBadge({ badge }: { badge: EdgeBadge }) {
  const error = badge.errorPath || badge.chainBreak;
  return (
    <span
      role="img"
      aria-label={`Step ${badge.label}${badge.errorPath ? ', error path' : ''}${badge.chainBreak ? ', chain break' : ''}`}
      className={cn(
        'flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full px-1 font-mono text-[10px] leading-none font-medium',
        error ? 'bg-clay-ink text-on-primary' : 'bg-primary text-on-primary',
        badge.current && 'ring-2 ring-primary ring-offset-1 ring-offset-surface',
      )}
    >
      {badge.errorPath && (
        <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-2.5" />
      )}
      {badge.label}
    </span>
  );
}
