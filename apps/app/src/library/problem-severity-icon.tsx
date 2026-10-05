import type { EntrySeverity } from '@sododeck/model/report-json';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleX, Info, TriangleAlert } from 'lucide-react';

const LOOK: Record<EntrySeverity, { label: string; Icon: typeof Info; tone: string }> = {
  error: { label: 'Error', Icon: CircleX, tone: 'text-clay-ink' },
  warning: { label: 'Warning', Icon: TriangleAlert, tone: 'text-amber-ink' },
  info: { label: 'Info', Icon: Info, tone: 'text-ink-secondary' },
};

/**
 * The severity of a problem entry (062): the same shapes as the problems panel's glyphs (047) plus
 * Info, named for screen readers, so colour is never the only cue. Library-safe (no model import).
 */
export function ProblemSeverityIcon({ severity }: { severity: EntrySeverity }) {
  const { label, Icon, tone } = LOOK[severity];
  return (
    <span role="img" aria-label={label} className={cn('inline-flex shrink-0 pt-0.5', tone)}>
      <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
    </span>
  );
}
