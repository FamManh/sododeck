import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { ChevronDown } from 'lucide-react';

import { isFlowMode, useUiStore } from '../state/ui-store';
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
  const focus = useUiStore((state) => state.focus);
  const select = useUiStore((state) => state.select);
  const toggleCollapsed = useUiStore((state) => state.toggleCollapsed);
  const announce = useUiStore((state) => state.announce);
  const flowMode = useUiStore((state) => isFlowMode(state));
  const groupId = id.startsWith('group:') ? id.slice('group:'.length) : id;

  return (
    <div
      data-testid="group-boundary"
      data-level={data.level}
      style={{ width, height }}
      className={cn(
        'group pointer-events-none rounded-group border border-dashed border-border bg-group',
        data.level === 'landscape' && 'border-solid bg-surface-2/80',
      )}
    >
      <button
        type="button"
        data-node-id={id}
        aria-label={`${data.title} group, ${String(data.count)} nodes`}
        aria-expanded="true"
        tabIndex={data.focused ? 0 : -1}
        title="Double-click or ↵ to open"
        onMouseDownCapture={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          if (flowMode) return;
          event.stopPropagation();
          select({ groups: [groupId] });
          focus(id);
        }}
        className={cn(
          'pointer-events-auto absolute top-2 left-3 flex gap-1.5 rounded-full px-1 text-micro text-ink-muted uppercase',
          data.level === 'landscape' &&
            'top-4 left-4 bg-surface px-2 py-1 text-body font-medium normal-case text-ink',
          focusRing,
        )}
      >
        <span>{data.title}</span>
        <span>{data.count}</span>
      </button>
      <button
        type="button"
        aria-label={`Collapse ${data.title}`}
        onMouseDownCapture={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          toggleCollapsed(groupId);
          if (!flowMode) select({ groups: [groupId] });
          focus(`collapsed:${groupId}`);
          announce(`${data.title} collapsed`);
        }}
        className={cn(
          'pointer-events-auto absolute top-2 right-3 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100',
          focusRing,
        )}
      >
        <ChevronDown className="size-4" />
      </button>
    </div>
  );
});
