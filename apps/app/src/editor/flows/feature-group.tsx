import type { Flow, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Box, GripVertical, Plus } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import type { FlowMatch } from './filter-flows';
import { FeatureMenu } from './feature-menu';
import { indexForMoveWithinFeature } from './flow-order';
import { FlowRow, type SortableRowProps } from './flow-row';
import { RenameField } from './rename-field';
import { useSortableList } from './use-sortable-list';

/**
 * One feature with its flows (FR-001, design 03/47): a header with the name, flow count, menu and
 * grip, the flows (sortable within the feature) and "+ New flow". `featureId` null is the
 * "No feature" group, which has no header actions.
 */
export function FeatureGroup({
  deck,
  featureId,
  title,
  flows,
  matches,
  filtering,
  renamingId,
  setRenamingId,
  onNewFlow,
  sortable,
}: {
  deck: SododeckFile;
  featureId: string | null;
  title: string;
  flows: readonly Flow[];
  matches: ReadonlyMap<string, FlowMatch>;
  filtering: boolean;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  onNewFlow: () => void;
  sortable: SortableRowProps | null;
}) {
  const editor = useEditor();
  const shown = flows.filter((f) => matches.has(f.id));
  const flowSort = useSortableList({
    ids: shown.map((f) => f.id),
    group: `flows:${featureId ?? ''}`,
    onMove: (id, position) => {
      // Positions are within the shown flows; map to the whole feature (the filter may hide some).
      const neighbour = shown.filter((f) => f.id !== id)[position];
      const all = flows.filter((f) => f.id !== id);
      const target = neighbour === undefined ? all.length : all.indexOf(neighbour);
      const index = indexForMoveWithinFeature(
        deck,
        id,
        featureId,
        target === -1 ? all.length : target,
      );
      editor.reorder('flows', id, index);
    },
  });
  const renaming = featureId !== null && renamingId === featureId;
  const count = flows.length;

  return (
    <li
      {...(sortable?.row ?? {})}
      role="group"
      aria-label={title}
      className={cn('group/feature flex flex-col', sortable?.dragging && 'opacity-60')}
    >
      <div className="flex h-9 items-center gap-1 pr-1">
        <span
          {...(sortable?.grip ?? { 'aria-hidden': true })}
          className={cn(
            'flex h-full w-4 shrink-0 items-center justify-center text-ink-muted opacity-0',
            sortable !== null && 'cursor-grab touch-none group-hover/feature:opacity-100',
          )}
        >
          {sortable !== null && (
            <GripVertical strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          )}
        </span>
        <Box
          aria-hidden
          strokeWidth={ICON_STROKE_WIDTH}
          className="size-4 shrink-0 text-ink-secondary"
        />
        {renaming ? (
          <RenameField
            label="Feature name"
            value={title}
            onCommit={(next) => {
              editor.update('features', featureId, { title: next });
            }}
            onDone={() => {
              setRenamingId(null);
            }}
          />
        ) : (
          <h4
            tabIndex={featureId === null ? undefined : 0}
            title={title}
            className={cn(
              'min-w-0 flex-1 truncate rounded-row px-1 text-body font-medium text-ink',
              focusRing,
            )}
            onKeyDown={(event) => {
              if (featureId !== null && event.key === 'F2') {
                event.preventDefault();
                setRenamingId(featureId);
              }
            }}
            onDoubleClick={() => {
              if (featureId !== null) setRenamingId(featureId);
            }}
          >
            {title}
          </h4>
        )}
        <span className="shrink-0 text-caption whitespace-nowrap text-ink-muted">
          {count} {count === 1 ? 'flow' : 'flows'}
        </span>
        {featureId !== null && (
          <FeatureMenu
            featureId={featureId}
            title={title}
            onRename={() => {
              setRenamingId(featureId);
            }}
            onNewFlow={onNewFlow}
          />
        )}
      </div>
      <ul aria-label={`Flows in ${title}`} className="flex flex-col pl-3">
        {shown.map((flow) => (
          <FlowRow
            key={flow.id}
            deck={deck}
            flow={flow}
            match={matches.get(flow.id)}
            renaming={renamingId === flow.id}
            onRename={() => {
              setRenamingId(flow.id);
            }}
            onRenameDone={() => {
              setRenamingId(null);
            }}
            sortable={{
              row: flowSort.rowProps(flow.id),
              grip: flowSort.gripProps(flow.id),
              dragging: flowSort.drag?.id === flow.id,
            }}
          />
        ))}
      </ul>
      {!filtering && (
        <Button variant="ghost" size="sm" className="ml-6 self-start" onClick={onNewFlow}>
          <Plus />
          New flow
        </Button>
      )}
    </li>
  );
}
