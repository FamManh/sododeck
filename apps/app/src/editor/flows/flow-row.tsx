import { analyzeFlow } from '@sododeck/model';
import type { Flow, SododeckFile } from '@sododeck/schema';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleAlert, GripVertical, Route } from 'lucide-react';
import { useId, type KeyboardEvent, type PointerEvent } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import type { FlowMatch } from './filter-flows';
import { FlowMenu } from './flow-menu';
import { Highlight } from './highlight';
import { RenameField } from './rename-field';

export interface SortableRowProps {
  row: Record<string, unknown> & { onKeyDown: (event: KeyboardEvent) => void };
  grip: Record<string, unknown> & { onPointerDown: (event: PointerEvent<HTMLElement>) => void };
  dragging: boolean;
}

/**
 * A flow in the list (FR-001, FR-032): its name, step count, a "Has problems" marker for broken
 * or chain-break steps, a menu, and a grip. Enter opens it, F2 renames, ⌥↑ / ⌥↓ reorder.
 */
export function FlowRow({
  deck,
  flow,
  match,
  renaming,
  onRename,
  onRenameDone,
  sortable,
}: {
  deck: SododeckFile;
  flow: Flow;
  match: FlowMatch | undefined;
  renaming: boolean;
  onRename: () => void;
  onRenameDone: () => void;
  sortable: SortableRowProps;
}) {
  const editor = useEditor();
  const active = useUiStore((s) => s.activeFlow?.flowId === flow.id);
  const countId = useId();
  const problems = analyzeFlow(flow, deck.edges).problems.some(
    (p) => p.kind === 'broken-step' || p.kind === 'chain-break',
  );
  const count = flow.steps.length;

  return (
    <li
      {...sortable.row}
      className={cn(
        'group/row flex h-9 items-center gap-1 rounded-row pr-1 text-body',
        active ? 'bg-primary-soft text-primary-ink' : 'text-ink hover:bg-surface-2',
        sortable.dragging && 'opacity-60 outline-1 outline-primary outline-dashed',
      )}
    >
      <span
        {...sortable.grip}
        className="flex h-full w-4 shrink-0 cursor-grab touch-none items-center justify-center text-ink-muted opacity-0 group-hover/row:opacity-100"
      >
        <GripVertical strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
      </span>
      {renaming ? (
        <RenameField
          label="Flow name"
          value={flow.title}
          onCommit={(title) => {
            editor.update('flows', flow.id, { title });
          }}
          onDone={onRenameDone}
        />
      ) : (
        <button
          type="button"
          aria-describedby={countId}
          aria-current={active ? 'true' : undefined}
          title={flow.title}
          className={cn(
            'flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-row text-left',
            focusRing,
          )}
          onClick={() => {
            useUiStore.getState().setActiveFlow(flow.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'F2') {
              event.preventDefault();
              onRename();
            }
          }}
        >
          <Route
            aria-hidden
            strokeWidth={ICON_STROKE_WIDTH}
            className="size-4 shrink-0 text-primary-ink"
          />
          <span className="truncate">
            <Highlight text={flow.title} ranges={match?.title ?? []} />
          </span>
        </button>
      )}
      {problems && (
        <span className="flex shrink-0 items-center text-clay-ink" title="Has problems">
          <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          <span className="sr-only">Has problems</span>
        </span>
      )}
      <span id={countId} className="shrink-0 text-caption whitespace-nowrap text-ink-muted">
        {count} {count === 1 ? 'step' : 'steps'}
      </span>
      <FlowMenu deck={deck} flowId={flow.id} title={flow.title} onRename={onRename} />
    </li>
  );
}
