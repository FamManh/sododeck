import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useEffect } from 'react';

import { isFlowMode, useUiStore } from '../state/ui-store';
import type { CollapsedFlowNode } from './deck-to-flow';
import { CardTitleInput } from './quick-edit/card-title-input';

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

export const CollapsedGroupNode = memo(function CollapsedGroupNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<CollapsedFlowNode>) {
  const focus = useUiStore((state) => state.focus);
  const select = useUiStore((state) => state.select);
  const updateNodeInternals = useUpdateNodeInternals();
  const flowMode = useUiStore((state) => isFlowMode(state));
  const hasFlowInside = data.flowInside !== undefined;
  const currentFlowInside = data.flowInside === 'current';
  const titleEdit = useUiStore((state) =>
    state.titleEdit?.target === 'group' && state.titleEdit.id === data.groupId
      ? state.titleEdit
      : null,
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  return (
    <div style={{ width, height }} className="group/collapsed relative">
      <div className="absolute inset-x-3 top-2 bottom-0 rounded-node border border-hairline bg-surface-2" />
      <div className="absolute inset-x-1.5 top-1 bottom-0 rounded-node border border-hairline bg-surface-2" />
      <button
        type="button"
        data-testid="collapsed-group-node"
        data-node-id={id}
        aria-label={`${data.title}, collapsed group, ${String(data.nodeCount)} nodes, ${String(data.edgeCount)} edges${hasFlowInside ? ', flow step inside' : ''}`}
        aria-expanded="false"
        {...(data.dimmed ? { 'aria-hidden': true, inert: true } : {})}
        tabIndex={data.focused ? 0 : -1}
        onMouseDownCapture={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          if (flowMode) return;
          event.stopPropagation();
          select({ groups: [data.groupId] });
          focus(id);
        }}
        className={cn(
          'absolute inset-0 flex w-full flex-col items-start justify-center gap-1 rounded-node border border-border bg-surface px-3 text-left shadow-rest',
          focusRing,
          hasFlowInside && 'ring-1 ring-primary ring-offset-2 ring-offset-canvas',
          selected && 'border-primary shadow-selection ring-1 ring-primary',
        )}
      >
        {hasFlowInside && <span data-testid="collapsed-flow-ring" className="sr-only" />}
        {currentFlowInside && <FlowInsideDot />}
        <span
          className={cn(
            'truncate text-body font-medium text-ink',
            titleEdit !== null && 'invisible',
          )}
        >
          {data.title}
        </span>
        <span className="text-caption text-ink-secondary">
          {data.nodeCount} nodes · {data.edgeCount} edges
        </span>
      </button>
      {titleEdit !== null && (
        // Over the title line; a field can't sit inside the card's button.
        <div className="absolute inset-x-2 top-1/2 -translate-y-full">
          <CardTitleInput edit={titleEdit} title={data.title} className="bg-surface text-body" />
        </div>
      )}
      {SIDES.map(({ id: side, position }) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={position}
          aria-hidden
          className="sd-handle"
        />
      ))}
    </div>
  );
});

function FlowInsideDot() {
  const reducedMotion = useReducedMotion();

  return (
    <span
      data-testid="collapsed-flow-dot"
      aria-hidden
      className={cn(
        'absolute top-2 right-2 size-2.5 rounded-full bg-primary shadow-rest',
        !reducedMotion && 'sd-flow-inside-dot',
      )}
    />
  );
}
