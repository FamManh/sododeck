import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { Boxes } from 'lucide-react';
import { memo, useEffect, type CSSProperties } from 'react';

import { isFlowMode, useUiStore } from '../state/ui-store';
import type { CollapsedFlowNode } from './deck-to-flow';
import { CardTitleInput } from './quick-edit/card-title-input';
import { describeChannel } from './style/card-style';

const countLabel = (n: number, noun: string) => `${String(n)} ${noun}${n === 1 ? '' : 's'}`;

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

  // Colour (020 US5): the front plate only, mirroring DeckNode's rule (R5).
  const look = data.look;
  const showFill = look?.fill !== undefined;
  const showStroke = look?.stroke !== undefined;
  const customText = look !== undefined && look.text !== 'default' ? look.text : undefined;
  const textRoleClass =
    customText === 'light'
      ? 'text-card-text-light'
      : customText === 'dark'
        ? 'text-card-text-dark'
        : null;
  const colourDescription = [
    look?.fillRef !== undefined ? describeChannel('fill', look.fillRef) : null,
    look?.strokeRef !== undefined ? describeChannel('stroke', look.strokeRef) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  return (
    <div style={{ width, height }} className="group/collapsed relative">
      {/* The stack peeks out down and right (design 69), so a collapsed group never reads as a
          plain card; the layers sat fully behind the card before. */}
      <div
        aria-hidden
        className="absolute inset-0 translate-x-2 translate-y-2 rounded-node border border-border bg-surface-2"
      />
      <div
        aria-hidden
        className="absolute inset-0 translate-x-1 translate-y-1 rounded-node border border-border bg-surface-2"
      />
      <button
        type="button"
        data-testid="collapsed-group-node"
        data-node-id={id}
        aria-label={`${data.title}, collapsed group, ${String(data.nodeCount)} nodes, ${String(data.edgeCount)} edges${hasFlowInside ? ', flow step inside' : ''}`}
        aria-description={colourDescription === '' ? undefined : colourDescription}
        aria-expanded="false"
        {...(data.dimmed ? { 'aria-hidden': true, inert: true } : {})}
        {...(showStroke ? { 'data-stroke': '' } : {})}
        {...(customText === undefined ? {} : { 'data-text': customText })}
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
        style={
          {
            ...(look?.fill === undefined ? {} : { '--card-fill': look.fill }),
            ...(look?.stroke === undefined ? {} : { '--card-stroke': look.stroke }),
          } as CSSProperties
        }
        className={cn(
          'absolute inset-0 flex w-full items-center gap-[9px] rounded-node border border-border bg-surface px-2.5 text-left shadow-rest',
          focusRing,
          hasFlowInside && 'ring-1 ring-primary ring-offset-2 ring-offset-canvas',
          selected && 'border-primary shadow-selection ring-1 ring-primary',
          showFill && 'bg-(--card-fill)',
          showStroke && 'border-[1.5px] border-(--card-stroke)',
        )}
      >
        {hasFlowInside && <span data-testid="collapsed-flow-ring" className="sr-only" />}
        {currentFlowInside && <FlowInsideDot />}
        <span
          aria-hidden
          className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-ink-secondary"
        >
          <Boxes strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              'truncate text-body font-medium',
              textRoleClass ?? 'text-ink',
              titleEdit !== null && 'invisible',
            )}
          >
            {data.title}
          </span>
          <span className={cn('text-caption', textRoleClass ?? 'text-ink-secondary')}>
            {countLabel(data.nodeCount, 'node')} · {countLabel(data.edgeCount, 'edge')}
          </span>
        </span>
      </button>
      {titleEdit !== null && (
        // Over the title line; a field can't sit inside the card's button.
        <div className="absolute top-1/2 right-2.5 left-[49px] -translate-y-full">
          <CardTitleInput
            edit={titleEdit}
            title={data.title}
            className={cn('text-body font-medium', textRoleClass ?? 'text-ink')}
          />
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
