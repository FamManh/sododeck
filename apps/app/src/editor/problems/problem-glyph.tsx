import type { Problem } from '@sododeck/model';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { TriangleAlert } from 'lucide-react';

import { problemCountLabel } from './problem-kinds';

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
