import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { isSchemaGroupId } from '@sododeck/model';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { Layers, Lock } from 'lucide-react';
import { memo, useEffect, type CSSProperties } from 'react';

import { isFlowMode, useUiStore } from '../state/ui-store';
import type { CollapsedFlowNode } from './deck-to-flow';
import { CardTitleInput } from './quick-edit/card-title-input';
import { iconProp } from './card-icon';
import { TypeGlyph } from './shapes/type-glyph';
import { StepSticker } from './step-sticker';
import { TouchChipBadge } from './touch-chip';
import { describeChannel } from './style/card-style';

/** Member tiles per hand, the last slot becoming "+n" when there are more. */
const MAX_TILES = 5;

function MemberTile({ kind, icon }: { kind: string; icon: string | undefined }) {
  return (
    <span
      data-testid="member-tile"
      className="flex size-[22px] items-center justify-center rounded-[7px] border-[1.5px] border-border-strong text-ink-secondary"
    >
      <TypeGlyph kind={kind} size={12} {...iconProp(icon)} />
    </span>
  );
}

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

  const kinds = data.members;
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
        aria-label={`${data.title}, collapsed group, ${String(data.nodeCount)} nodes, ${String(data.edgeCount)} edges${hasFlowInside ? ', flow step inside' : ''}${data.touchChip === undefined ? '' : `, current step ${data.touchChip.text}`}${data.locked === true ? ', locked' : ''}`}
        aria-description={colourDescription === '' ? undefined : colourDescription}
        aria-expanded="false"
        {...(data.dimmed ? { 'aria-hidden': true, inert: true } : {})}
        {...(showStroke ? { 'data-stroke': '' } : {})}
        {...(customText === undefined ? {} : { 'data-text': customText })}
        tabIndex={data.focused ? 0 : -1}
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
        {data.flowInside !== undefined && (
          <StepSticker state={data.flowInside} number={data.flowNumber ?? null} />
        )}
        {data.touchChip !== undefined && <TouchChipBadge chip={data.touchChip} />}
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
          {data.locked === true && (
            <Lock
              aria-hidden
              data-testid="group-lock"
              strokeWidth={ICON_STROKE_WIDTH}
              className="size-3.5 shrink-0 text-ink-secondary"
            />
          )}
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
        {isSchemaGroupId(data.groupId) ? (
          <span className="truncate text-[11.5px] leading-none font-medium text-ink-secondary">
            {countLabel(data.nodeCount, 'table')} · {countLabel(data.edgeCount, 'relationship')}
          </span>
        ) : (
          <span aria-hidden className="flex shrink-0 gap-1">
            {shown.map((member, index) => (
              <MemberTile key={index} kind={member.kind} icon={member.icon} />
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
        )}
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
