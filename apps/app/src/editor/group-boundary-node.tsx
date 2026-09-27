import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';

import type { GroupFlowNode } from './deck-to-flow';

/**
 * Dashed group boundary with a micro label "TITLE n" (DESIGN.md group-boundary, design 02).
 * Derived from its members' positions, never stored; it lets pointer events through to the canvas.
 */
export const GroupBoundaryNode = memo(function GroupBoundaryNode({
  id,
  data,
  width,
  height,
}: NodeProps<GroupFlowNode>) {
  return (
    <div
      data-testid="group-boundary"
      style={{ width, height }}
      className="pointer-events-none rounded-group border border-dashed border-border bg-group"
    >
      <span
        data-node-id={id}
        tabIndex={data.focused ? 0 : -1}
        className={cn(
          'pointer-events-auto absolute top-2 left-3 flex gap-1.5 text-micro text-ink-muted uppercase',
          focusRing,
        )}
      >
        <span>{data.title}</span>
        <span>{data.count}</span>
      </span>
    </div>
  );
});
