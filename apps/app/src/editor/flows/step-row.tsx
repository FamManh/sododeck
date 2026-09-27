import type { PathStep } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleAlert, GitBranch, GripVertical, X } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import type { SortableRowProps } from './flow-row';
import { startBranch } from './flow-session';
import { stepRoute } from './session-path';
import { removeSessionStep, stepRowKeyDown } from './use-flow-shortcuts';

/**
 * One step (FR-019a): main line = title or "<from> → <to>", second line = connection label, then
 * condition. A broken step shows "Connection deleted", a chain break a dashed clay dot, an icon
 * and "Doesn't start where step n ended" (FR-021, FR-032). In a session it also has a grip, a
 * remove button and the keys ⌫, B, ⌥↑ / ⌥↓.
 */
export function StepRow({
  deck,
  flowId,
  step,
  previousNumber,
  errorPath,
  editing,
  canBranch,
  sortable,
}: {
  deck: SododeckFile;
  flowId: string;
  step: PathStep;
  /** Number of the step before this one on its path, for the chain-break text. */
  previousNumber: string | null;
  errorPath: boolean;
  /** A session is running: structure can change. */
  editing: boolean;
  canBranch: boolean;
  sortable: SortableRowProps | null;
}) {
  const editor = useEditor();
  const active = useUiStore((s) => s.activeFlow?.stepId === step.step.id);
  const edge = deck.edges.find((e) => e.id === step.step.edge);
  const main = step.step.title ?? stepRoute(deck, step);
  const second = [edge?.label, step.step.condition].filter(
    (part): part is string => part !== undefined && part !== '',
  );

  return (
    <li
      {...(sortable?.row ?? {})}
      className={cn(
        'group/row flex items-start gap-1 rounded-row py-1 pr-1',
        active ? 'bg-primary-soft' : 'hover:bg-surface-2',
        sortable?.dragging === true && 'opacity-60 outline-1 outline-primary outline-dashed',
      )}
    >
      {sortable !== null && (
        <span
          {...sortable.grip}
          className="mt-1.5 flex w-4 shrink-0 cursor-grab touch-none justify-center text-ink-muted opacity-0 group-hover/row:opacity-100"
        >
          <GripVertical strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
        </span>
      )}
      <button
        type="button"
        aria-current={active ? 'step' : undefined}
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-row text-left',
          focusRing,
        )}
        onClick={() => {
          useUiStore.getState().setActiveStep(step.step.id);
        }}
        onKeyDown={(event) => {
          if (editing) stepRowKeyDown(event, editor, flowId, step.step.id);
        }}
      >
        <span
          className={cn(
            'mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center gap-0.5 rounded-full px-1 font-mono text-caption',
            step.chainBreak
              ? 'border border-dashed border-clay-ink text-clay-ink'
              : errorPath
                ? 'bg-clay-soft text-clay-ink'
                : active
                  ? 'bg-primary text-on-primary'
                  : 'bg-primary-soft text-primary-ink',
          )}
        >
          {errorPath && (
            <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
          )}
          <span className="sr-only">Step </span>
          {step.number}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body text-ink" title={main}>
            {main}
          </span>
          {step.broken ? (
            <span className="flex items-center gap-1 text-caption text-clay-ink">
              <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
              Connection deleted
            </span>
          ) : (
            second.length > 0 && (
              <span className="truncate font-mono text-caption text-ink-secondary">
                {second.join(' · ')}
              </span>
            )
          )}
          {step.chainBreak && (
            <span className="flex items-center gap-1 text-caption text-clay-ink">
              <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
              {previousNumber === null
                ? "Doesn't start where the branch starts"
                : `Doesn't start where step ${previousNumber} ended`}
            </span>
          )}
        </span>
      </button>
      {editing && canBranch && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Add branch after step ${step.number}`}
          className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
          onClick={() => {
            startBranch(editor, step.step.id);
          }}
        >
          <GitBranch />
        </Button>
      )}
      {editing && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove step ${step.number}`}
          className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
          onClick={() => {
            removeSessionStep(editor, flowId, step.step.id);
          }}
        >
          <X />
        </Button>
      )}
    </li>
  );
}
