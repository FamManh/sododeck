import type { Severity } from '@sododeck/model';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleX, TriangleAlert } from 'lucide-react';

import { SEVERITY_LABEL } from './problem-kinds';

/**
 * Error (clay circle-x) or warning (amber triangle) glyph (047). The shape differs as well as the
 * colour, and the accessible name says which, so colour is never the only cue. `label` replaces
 * the default name where the glyph stands for a specific problem (a table row).
 */
export function SeverityIcon({
  severity,
  label = SEVERITY_LABEL[severity],
  className,
}: {
  severity: Severity;
  label?: string;
  className?: string;
}) {
  const Icon = severity === 'error' ? CircleX : TriangleAlert;
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0',
        severity === 'error' ? 'text-clay-ink' : 'text-amber-ink',
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
    </span>
  );
}
