import type { FlowAnalysis } from '@sododeck/model';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { CircleX, GitBranch } from 'lucide-react';
import { useId } from 'react';

import { useEditor } from '../../model/use-editor';
import { switchAlternative } from './flow-mode';
import type { PlayedPath } from './played-path';

interface BranchPickerProps {
  analysis: FlowAnalysis;
  played: PlayedPath;
  forkNumber: string;
}

/**
 * "AT STEP n" + one option per alternative (007 FR-015, design 46). A radiogroup: arrow keys move
 * between alternatives inside it, so the player's ↑ / ↓ skip it. Deck look (035): a number hint on
 * each option and a dashed Clay border with ⊗ on the error path; behaviour is unchanged.
 */
export function BranchPicker({ analysis, played, forkNumber }: BranchPickerProps) {
  const editor = useEditor();
  const labelId = useId();
  const label = `At step ${forkNumber}`;
  return (
    <div className="flex items-center gap-2.5">
      <span
        id={labelId}
        className="text-caption font-medium tracking-wide text-ink-muted uppercase"
      >
        {label}
      </span>
      <SegmentedControl
        aria-labelledby={labelId}
        value={played.alternative?.branch.id ?? ''}
        onValueChange={(value) => {
          switchAlternative(editor, value);
        }}
      >
        {analysis.branches.map(({ branch }, i) => (
          <SegmentedControlItem
            key={branch.id}
            value={branch.id}
            className={
              branch.errorPath === true
                ? 'border border-dashed border-clay-ink text-clay-ink data-[state=checked]:text-clay-ink'
                : undefined
            }
          >
            {/* The position in the list, as frame 117 shows it. Visual only: no key is bound. */}
            <span
              aria-hidden
              data-testid="branch-number-hint"
              className="inline-flex size-4 items-center justify-center rounded-full bg-surface-3 font-mono text-[10px] leading-none font-semibold text-ink-secondary"
            >
              {i + 1}
            </span>
            {branch.errorPath === true ? (
              <CircleX
                aria-hidden
                data-testid="branch-error-icon"
                strokeWidth={ICON_STROKE_WIDTH}
              />
            ) : (
              <GitBranch aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
            )}
            {branch.label}
            {branch.errorPath === true && <span className="sr-only">, error path</span>}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </div>
  );
}
