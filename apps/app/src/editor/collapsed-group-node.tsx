import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useEffect } from 'react';

import { useUiStore } from '../state/ui-store';
import type { CollapsedFlowNode } from './deck-to-flow';

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
        aria-label={`${data.title}, collapsed group, ${String(data.nodeCount)} nodes, ${String(data.edgeCount)} edges`}
        aria-expanded="false"
        tabIndex={data.focused ? 0 : -1}
        onMouseDownCapture={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          select({ groups: [data.groupId] });
          focus(id);
        }}
        className={cn(
          'absolute inset-0 flex w-full flex-col items-start justify-center gap-1 rounded-node border border-border bg-surface px-3 text-left shadow-rest',
          focusRing,
          selected && 'border-primary shadow-selection ring-1 ring-primary',
        )}
      >
        <span className="truncate text-body font-medium text-ink">{data.title}</span>
        <span className="text-caption text-ink-secondary">
          {data.nodeCount} nodes · {data.edgeCount} edges
        </span>
      </button>
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
