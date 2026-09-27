import type { BranchPath } from '@sododeck/model';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleAlert, GitBranch } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';

/**
 * "◇ <label>" above a branch's steps (FR-025). An error path adds an alert icon and the text
 * "error path" (FR-026). Selecting it shows the branch in the inspector.
 */
export function BranchHeader({ path, isNew }: { path: BranchPath; isNew: boolean }) {
  const active = useUiStore((s) => s.activeFlow?.branchId === path.branch.id);
  const error = path.branch.errorPath === true;
  const label = path.branch.label.trim() === '' ? 'no label yet' : path.branch.label;

  return (
    <li className="pt-1">
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        aria-label={`Branch ${path.letter}: ${label}${error ? ', error path' : ''}`}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1.5 rounded-row px-1 py-1 text-left font-mono text-body-sm',
          error ? 'text-clay-ink' : 'text-ink-secondary',
          active ? 'bg-primary-soft' : 'hover:bg-surface-2',
          focusRing,
        )}
        onClick={() => {
          useUiStore.getState().setActiveBranch(path.branch.id);
        }}
      >
        {error ? (
          <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5 shrink-0" />
        ) : (
          <GitBranch aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5 shrink-0" />
        )}
        <span aria-hidden>◇</span>
        <span
          className={cn('min-w-0 flex-1 truncate', path.branch.label.trim() === '' && 'italic')}
        >
          {label}
        </span>
        {error && <span className="shrink-0 font-sans text-caption">error path</span>}
        {isNew && !error && <span className="shrink-0 font-sans text-caption">new</span>}
      </button>
    </li>
  );
}
