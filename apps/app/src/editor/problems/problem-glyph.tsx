import type { Problem, ProblemKind } from '@sododeck/model';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Copy,
  Link2Off,
  Split,
  Table2,
  TriangleAlert,
  Unlink,
  Unplug,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export const problemCountLabel = (count: number) =>
  count === 1 ? '1 problem' : `${String(count)} problems`;

/** Icon of a problem row, by kind (design 60). */
export const PROBLEM_ICONS: Record<ProblemKind, LucideIcon> = {
  orphan: Unlink,
  'duplicate-connection': Copy,
  'step-without-connection': Unplug,
  'broken-chain': Workflow,
  'incomplete-flow': Workflow,
  'overlapping-conditions': Split,
  'missing-rule': Table2,
  'rule-without-catch-all': Table2,
  'invalid-rule-cells': Table2,
  'broken-reference': Link2Off,
};

/**
 * Amber warning glyph on objects with problems (015 FR-022/023/025). Its accessible name carries
 * the count and its tooltip names the problems, so colour is never the only cue.
 */
export function ProblemGlyph({
  problems,
  className,
}: {
  problems: readonly Problem[];
  className?: string;
}) {
  if (problems.length === 0) return null;
  const titles = problems.map((p) => p.title).join(', ');
  return (
    <span
      role="img"
      aria-label={problemCountLabel(problems.length)}
      title={titles}
      className={cn('inline-flex shrink-0 text-amber-ink', className)}
    >
      <TriangleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
    </span>
  );
}
