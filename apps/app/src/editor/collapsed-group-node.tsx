import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { focusRing } from '@sododeck/ui/lib/focus';
import {
  ICON_STROKE_WIDTH,
  KIND_FALLBACK,
  KIND_STYLE,
  toComponentKind,
} from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { memo, useEffect, type CSSProperties } from 'react';

import { isFlowMode, useUiStore } from '../state/ui-store';
import type { CollapsedFlowNode } from './deck-to-flow';
import { CardTitleInput } from './quick-edit/card-title-input';
import { describeChannel } from './style/card-style';

/** Member tiles per hand, the last slot becoming "+n" when there are more. */
const MAX_TILES = 5;

function MemberTile({ kind }: { kind: string }) {
  const resolved = toComponentKind(kind);
  const Icon = resolved === null ? KIND_FALLBACK.icon : KIND_STYLE[resolved].icon;
  return (
    <span
      data-testid="member-tile"
      className="flex size-[22px] items-center justify-center rounded-[7px] border-[1.5px] border-border-strong text-ink-secondary"
    >
      <Icon strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
    </span>
  );
}

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

  const lookVars = {
    ...(look?.fill === undefined ? {} : { '--card-fill': look.fill }),
    ...(look?.stroke === undefined ? {} : { '--card-stroke': look.stroke }),
    ...(look === undefined ? {} : { '--card-chip': look.chip, '--card-ink': look.ink }),
  } as CSSProperties;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  const kinds = data.memberKinds;
  // 22 px tiles with a 4 px gap across the 160 px text area: five fit; past that the last slot
  // reads "+n" (frame 119).
  const shown = kinds.length > MAX_TILES ? kinds.slice(0, MAX_TILES - 1) : kinds;
  const extra = kinds.length - shown.length;
  // Paint-only sheets: rotated around the bottom centre, never on the node wrapper (§g-74).
  const sheetClass =
    'pointer-events-none absolute inset-0 origin-bottom rounded-card border-[1.5px] border-(--card-stroke,var(--color-border-strong)) bg-(--card-fill,var(--color-surface-2)) shadow-[0_var(--sd-deck-lip)_0_0_var(--card-stroke,var(--color-border-strong))]';

  return (
    <div style={{ width, height }} className="group/collapsed relative">
      {/* The fanned hand (DESIGN.md "Groups", frame 119): two sheets of the group's colour behind
          the front card, so a collapsed group never reads as a plain card. */}
      <div
        aria-hidden
        data-testid="group-back-sheet"
        style={lookVars}
        className={cn(sheetClass, '-rotate-[7deg]')}
      />
      <div
        aria-hidden
        data-testid="group-back-sheet"
        style={lookVars}
        className={cn(sheetClass, 'rotate-[4deg]')}
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
        style={lookVars}
        className={cn(
          'sd-card absolute inset-0 flex w-full flex-col gap-[7px] rounded-card border-[1.5px] border-border-strong bg-surface px-[10.5px] py-[9.5px] text-left',
          focusRing,
          hasFlowInside && 'ring-1 ring-primary ring-offset-2 ring-offset-canvas',
          selected && 'selected',
          showFill && 'bg-(--card-fill)',
          showStroke && 'border-(--card-stroke)',
        )}
      >
        {hasFlowInside && <span data-testid="collapsed-flow-ring" className="sr-only" />}
        {currentFlowInside && <FlowInsideDot />}
        <span className="flex h-6 shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-(--card-chip,var(--color-surface-2)) text-(--card-ink,var(--color-ink-secondary))"
          >
            <Layers strokeWidth={2} className="size-3.5" />
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-caption font-medium',
              textRoleClass ?? 'text-ink-secondary',
            )}
          >
            Group
          </span>
          <span
            aria-hidden
            className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ink text-[13px] leading-none font-bold text-surface"
          >
            {data.nodeCount}
          </span>
        </span>
        <span
          className={cn(
            'truncate text-[14px] leading-[1.28] font-semibold',
            textRoleClass ?? 'text-ink',
            titleEdit !== null && 'invisible',
          )}
        >
          {data.title}
        </span>
        <span aria-hidden className="flex shrink-0 gap-1">
          {shown.map((kind, index) => (
            <MemberTile key={index} kind={kind} />
          ))}
          {extra > 0 && (
            <span
              data-testid="member-more"
              className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[7px] border-[1.5px] border-border-strong px-1 text-[10.5px] font-semibold text-ink-secondary"
            >
              +{extra}
            </span>
          )}
        </span>
      </button>
      {titleEdit !== null && (
        // Over the name line; a field can't sit inside the card's button.
        <div className="absolute top-[43px] right-3 left-3">
          <CardTitleInput
            edit={titleEdit}
            title={data.title}
            className={cn('text-[14px] font-semibold', textRoleClass ?? 'text-ink')}
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
