import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH, typeStyle } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Handle,
  NodeResizeControl,
  Position,
  useReactFlow,
  type NodeProps,
  type ResizeDragEvent,
} from '@xyflow/react';
import {
  Ban,
  CornerDownLeft,
  CornerDownRight,
  EyeOff,
  Layers,
  Pin,
  Plus,
  Table,
  TriangleAlert,
} from 'lucide-react';
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';

import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../state/ui-store';
import { MAX_CARD_TAGS } from './card-tags';
import { connectionCheck, REFUSAL_TEXT, type ConnectionCheck } from './connection-rules';
import {
  applyCardResize,
  endCardResize,
  startCardResize,
  type CardResizeSession,
} from './editing/card-resize';
import { oneStep } from './fields/one-step';
import { typeName } from './type-label';
import type { Handle as ResizeHandleName } from './editing/resize-limits';
import { CardTitleInput } from './quick-edit/card-title-input';
import { DetailsButton } from './quick-edit/details-button';
import { describeChannel } from './style/card-style';
import { useConnecting, useConnectionRole } from './use-connection-role';
import type { DeckFlowNode } from './deck-to-flow';
import { deckStateClasses } from './deck-states';
import { StepSticker } from './step-sticker';

/** The title's line height in em (DESIGN.md `--sd-deck-title`), so an edited title shows as many lines as the card. */
const TITLE_LINE_EM = 1.28;

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

const RESIZE_HANDLES: readonly ResizeHandleName[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
];

const modsOf = (event: ResizeDragEvent) => {
  const source = event.sourceEvent as Partial<MouseEvent> | null | undefined;
  return {
    shift: source?.shiftKey === true,
    alt: source?.altKey === true,
    mod: source?.metaKey === true || source?.ctrlKey === true,
  };
};

/** Canvas card in the Deck look (029; DESIGN.md "Card system (Deck)", frames 117–121, 125). */
export const DeckNode = memo(function DeckNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<DeckFlowNode>) {
  const editor = useEditor();
  const openConnectPopover = useUiStore((s) => s.openConnectPopover);
  const announce = useUiStore((s) => s.announce);
  const connecting = useConnecting();
  const role = useConnectionRole(id);
  // Reconnect drag (017 R12): while dragging an endpoint, this card's four side targets show as
  // rings when the pointer is over it, with the nearest side "hot" (filled and larger).
  // A primitive per card: selecting the whole gesture re-rendered every card on each pan / zoom.
  const hotSide = useUiStore((s) =>
    s.canvasGesture === 'endpoint' && s.endpointHover?.nodeId === id ? s.endpointHover.side : null,
  );
  const isEndpointTarget = hotSide !== null;
  const { getZoom } = useReactFlow();
  const resize = useRef<CardResizeSession | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandleName | null>(null);
  // Resizing (017 R4): pointer only, and only the single selected card, never in flow mode,
  // recording, view-only or inside a collapsed group (those never render a DeckNode at all).
  const resizable = useUiStore(
    (s) =>
      selected &&
      !isFlowMode(s) &&
      s.flowSession === null &&
      s.selection.nodes.length === 1 &&
      s.selection.edges.length === 0 &&
      s.selection.groups.length === 0 &&
      s.selection.stickies.length === 0,
  );
  // Only this card re-renders when its title edit starts or ends (the others select `null`).
  const titleEdit = useUiStore((s) =>
    s.titleEdit?.target === 'node' && s.titleEdit.id === id ? s.titleEdit : null,
  );

  let target: ConnectionCheck | null = null;
  if (role?.startsWith('target:')) {
    target = connectionCheck(readDeck(editor.doc), role.slice('target:'.length), id);
  }
  const refusal = target === null || target === 'ok' ? null : REFUSAL_TEXT[target];

  useEffect(() => {
    if (refusal) announce(refusal);
  }, [refusal, announce]);

  // Dimmed and pinned are said in the name too, never shown by opacity or a glyph alone (011).
  const name = [
    `${typeName(data.kind)}: ${data.title}`,
    data.viewDimmed === true ? 'dimmed in this view' : null,
    data.pinned === true ? 'pinned' : null,
    data.problems?.label ?? null,
  ]
    .filter(Boolean)
    .join(', ');
  const tabIndex = data.focused ? 0 : -1;
  const isLandscape = data.level === 'landscape';
  // Component (zoomed in) reads like Container, at the same size (§g-58). The description and the
  // rules mark wait for Container; US4 refines what each level paints.
  const isContainer = data.level === 'container' || data.level === 'component';
  // The box and the lines each text gets come from one pure `cardLayout` (029 R7), already
  // clamped to a stored size; the full title stays reachable in a tooltip when it is cut.
  const layout = data.layout;
  const box = { width: width ?? layout.width, height: height ?? layout.height };
  // `toFlowNodes` already keeps ten; the card never draws more than its layout reserved room for.
  const tags = data.tagLooks.slice(0, MAX_CARD_TAGS);
  const clampStyle = (n: number): CSSProperties => ({
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: n,
    overflow: 'hidden',
  });

  // Colour (020 R5): the current-step and connect-target cues take the border, so the stroke
  // class steps aside while either is active (both use `border-*`/`outline-*` of their own).
  const look = data.look;
  const hasFlowStep = data.currentStep === true;
  const hasConnectTarget = target === 'ok';
  const showFill = look?.fill !== undefined;
  const showStroke = look?.stroke !== undefined && !hasFlowStep && !hasConnectTarget;
  const customText = look !== undefined && look.text !== 'default' ? look.text : undefined;
  const textRoleClass =
    customText === 'light'
      ? 'text-card-text-light'
      : customText === 'dark'
        ? 'text-card-text-dark'
        : null;
  const titleText = (
    <span
      className={cn(
        'text-[14px] leading-[1.28] font-semibold break-words',
        textRoleClass ?? 'text-ink',
      )}
      style={clampStyle(layout.titleLines)}
    >
      {data.title}
    </span>
  );
  // The title edits in place, in its own type and over the same lines (founder, 2026-10-02).
  const titleInput =
    titleEdit === null ? null : (
      <CardTitleInput
        edit={titleEdit}
        title={data.title}
        className={cn(
          'text-[14px] leading-[1.28] font-semibold break-words',
          isLandscape && 'text-center',
          textRoleClass ?? 'text-ink',
        )}
        style={{ maxHeight: `${String(layout.titleLines * TITLE_LINE_EM)}em` }}
      />
    );
  const TypeIcon = typeStyle(data.kind).icon;
  const subtitleClass =
    textRoleClass ?? (look?.namedFill === true ? 'text-ink-secondary' : 'text-ink-muted');
  const subtitleDataText = customText ?? (look?.namedFill === true ? 'secondary' : undefined);
  const colourDescription = [
    look?.fillRef !== undefined ? describeChannel('fill', look.fillRef) : null,
    look?.strokeRef !== undefined ? describeChannel('stroke', look.strokeRef) : null,
  ].filter((part): part is string => part !== null);
  const hasProblem = data.problems !== undefined && target !== 'ok';
  const stateClasses = deckStateClasses({
    selected,
    hasProblem,
    connectTarget: hasConnectTarget,
    connectRefused: refusal !== null,
    currentStep: hasFlowStep,
  });
  const description = [
    selected ? 'Selected' : null,
    hasProblem ? (data.problems?.titles ?? null) : null,
    ...colourDescription,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      data-testid="deck-node"
      data-node-id={id}
      role="group"
      aria-roledescription="component"
      aria-label={name}
      aria-selected={selected}
      aria-description={description === '' ? undefined : description}
      aria-current={data.currentStep === true ? 'step' : undefined}
      data-step-state={data.step?.state}
      {...(data.dimmed ? { 'aria-hidden': true, inert: true } : {})}
      {...(customText === undefined ? {} : { 'data-text': customText })}
      {...(showStroke ? { 'data-stroke': '' } : {})}
      {...(data.problems !== undefined && target !== 'ok' ? { 'data-problem': '' } : {})}
      tabIndex={tabIndex}
      style={{
        width: box.width,
        height: box.height,
        ...(look?.fill === undefined ? {} : { '--card-fill': look.fill }),
        ...(look?.stroke === undefined ? {} : { '--card-stroke': look.stroke }),
        // The tile and field chip colours follow the card colour (029); none leaves the neutral
        // fallbacks in the classes below. Tag pills do not: each takes its own tag's colour.
        ...(look === undefined
          ? {}
          : { '--card-chip': look.chip, '--card-ink': look.ink, '--card-dot': look.dot }),
      }}
      onDoubleClickCapture={(event) => {
        // A handle double-click resets the size (T030), not the title edit underneath it.
        if (!resizable) return;
        const target = event.target as HTMLElement;
        if (target.closest('.sd-resize-handle') === null) return;
        event.stopPropagation();
        oneStep(editor, () => {
          editor.setCardSize(id, null);
        });
        announce('Size reset');
      }}
      className={cn(
        // The thick-paper card (029): a 1.5 px border and the lip from `.sd-card` (index.css). Its
        // padding is 12 / 13 less the border, so the text area matches what `cardLayout` measured.
        'sd-card group/node relative rounded-card border-[1.5px] bg-surface',
        'flex flex-col gap-2 px-[11.5px] py-[10.5px]',
        isLandscape && 'items-center justify-center',
        focusRing,
        // The state classes (deck-states.ts) are styled in index.css: selected is a 2 px frame 2 px
        // outside the card (a shape cue, plus aria-selected), the problem ring is its own layer
        // below, so both draw together.
        ...stateClasses,
        // Where the next flow step must start (006 FR-009): a ring plus the tag text.
        data.flowStart !== undefined && 'ring-2 ring-primary ring-offset-2 ring-offset-canvas',
        // Colour (020 R5): fill and stroke, unless the flow-step/connect-target border owns it.
        showFill && 'bg-(--card-fill)',
        hasFlowStep
          ? 'border-primary'
          : showStroke
            ? 'border-(--card-stroke)'
            : 'border-border-strong',
      )}
    >
      {data.step !== undefined && <StepSticker state={data.step.state} number={data.step.number} />}
      {isLandscape ? (
        // The plate (frame 123): the type icon on the card fill, no text.
        (titleInput ?? (
          <TypeIcon
            aria-hidden
            data-testid="card-plate-icon"
            size={30}
            strokeWidth={2}
            className="text-(--card-ink,var(--color-ink-secondary))"
          />
        ))
      ) : (
        <>
          {/* Header (frame 120): the type tile, the type name, then the badge slot. */}
          <div data-testid="card-header" className="flex h-6 shrink-0 items-center gap-2">
            <span
              aria-hidden
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-(--card-chip,var(--color-surface-2)) text-(--card-ink,var(--color-ink-secondary))"
            >
              <TypeIcon aria-hidden size={14} strokeWidth={2} />
            </span>
            {isContainer ? (
              <span
                data-text={subtitleDataText}
                className={cn('min-w-0 flex-1 truncate text-caption font-medium', subtitleClass)}
              >
                {typeName(data.kind)}
              </span>
            ) : (
              // System: the tile alone (§g-58); the slot keeps the badges on the right.
              <span aria-hidden className="min-w-0 flex-1" />
            )}
            {data.problems !== undefined && hasProblem && (
              <span
                aria-hidden
                title={data.problems.titles}
                data-testid="problem-glyph"
                className="flex h-5 shrink-0 items-center gap-1 rounded-full bg-clay-soft px-2 text-[11px] leading-none font-semibold text-clay-ink"
              >
                <TriangleAlert strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
                {data.problems.count}
              </span>
            )}
            {((data.hasRules && isContainer) || data.pinned === true) && (
              <span className="flex shrink-0 items-center gap-1.5">
                {data.hasRules && isContainer && (
                  <Table
                    role="img"
                    aria-label="Has rules"
                    strokeWidth={ICON_STROKE_WIDTH}
                    className={cn('size-3.5', textRoleClass ?? 'text-primary-ink')}
                  />
                )}
                {data.pinned === true && (
                  <Pin
                    role="img"
                    aria-label="Pinned"
                    strokeWidth={ICON_STROKE_WIDTH}
                    className={cn('size-3', textRoleClass ?? 'text-primary-ink')}
                  />
                )}
              </span>
            )}
          </div>
          {titleInput ??
            (layout.titleCut ? (
              <Tooltip>
                <TooltipTrigger asChild>{titleText}</TooltipTrigger>
                <TooltipContent>{data.title}</TooltipContent>
              </Tooltip>
            ) : (
              titleText
            ))}
          {isContainer && data.subtitle?.trim() && layout.descriptionLines > 0 && (
            <span
              data-testid="card-description"
              data-text={subtitleDataText}
              className={cn(
                'text-[12px] leading-[1.4] break-words',
                textRoleClass ?? 'text-ink-secondary',
              )}
              style={clampStyle(layout.descriptionLines)}
            >
              {data.subtitle.trim()}
            </span>
          )}
          {tags.length > 0 && (
            <ul
              aria-label="Tags"
              className="flex shrink-0 flex-wrap content-start gap-1 overflow-hidden"
              style={{ height: layout.tagRows * 18 + (layout.tagRows - 1) * 4 }}
            >
              {tags.map((tag, index) => {
                // Each tag takes its own colour (033), slate when it has none; the card colour
                // only reaches the tile and the field chips.
                const style = {
                  '--tag-chip': tag.chip,
                  '--tag-ink': tag.ink,
                  '--tag-dot': tag.dot,
                } as CSSProperties;
                // A card may hold two spellings of one tag, so the text alone is not a key.
                const key = `${String(index)}:${tag.text}`;
                return isContainer ? (
                  <li
                    key={key}
                    title={tag.text}
                    style={style}
                    className="h-[18px] max-w-full truncate rounded-full bg-(--tag-chip) px-1.5 text-[10.5px] leading-[18px] font-medium text-(--tag-ink)"
                  >
                    {tag.text}
                  </li>
                ) : (
                  // System: a 6 px dot in the same block (§g-63), named for assistive tech.
                  <li
                    key={key}
                    aria-label={tag.text}
                    title={tag.text}
                    style={style}
                    className="m-[6px] size-1.5 rounded-full bg-(--tag-dot)"
                  />
                );
              })}
            </ul>
          )}
        </>
      )}
      {data.childCount > 0 && (
        <span
          role="img"
          aria-label={`${String(data.childCount)} components inside, press Enter to open`}
          className="flex h-6 shrink-0 items-center gap-1.5 rounded-row bg-surface-2 px-2 text-caption text-ink-secondary"
        >
          <Layers aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
          <span className="flex-1">{data.childCount} inside</span>
          <CornerDownLeft aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
        </span>
      )}

      {resizable &&
        RESIZE_HANDLES.map((handle) => (
          <NodeResizeControl
            key={handle}
            nodeId={id}
            position={handle}
            className="sd-resize-handle"
            {...(activeHandle === handle ? { 'data-active': '' } : {})}
            onResizeStart={() => {
              setActiveHandle(handle);
              resize.current = startCardResize(editor, id, handle, data.level);
            }}
            onResize={(event, params) => {
              if (resize.current !== null)
                applyCardResize(editor, resize.current, params, modsOf(event), getZoom());
            }}
            onResizeEnd={() => {
              if (resize.current !== null) endCardResize(editor, resize.current);
              resize.current = null;
              setActiveHandle(null);
            }}
          />
        ))}
      {SIDES.map(({ id: side, position }) => {
        const hot = hotSide === side;
        return (
          <Handle
            key={side}
            id={side}
            type="source"
            position={position}
            role="button"
            aria-label={`Connect from ${data.title}`}
            tabIndex={tabIndex}
            {...(isEndpointTarget ? { 'data-endpoint-target': '' } : {})}
            {...(hot ? { 'data-endpoint-hot': '' } : {})}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                openConnectPopover(id);
              }
            }}
            className={cn(
              'sd-handle opacity-0',
              // Landscape draws no handles (R8): the dense board stays clean.
              !isLandscape && 'group-hover/node:opacity-100 group-focus-within/node:opacity-100',
              focusRing,
              role !== null && 'opacity-100',
              hot && 'is-active',
              isEndpointTarget && 'opacity-100',
            )}
          />
        );
      })}
      {/* While a connection is drawn, the whole node is a drop target, not only its handles. */}
      {connecting && role !== 'source' && (
        <Handle
          id="body"
          type="target"
          position={Position.Top}
          isConnectableStart={false}
          aria-hidden
          className="sd-body-handle"
        />
      )}

      {titleEdit === null && !data.dimmed && (
        <DetailsButton id={id} title={data.title} focused={data.focused} />
      )}
      {data.hiddenInView === true && (
        <span
          role="note"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 flex w-max items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-secondary shadow-rest"
        >
          <EyeOff aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
          Hidden in this view
        </span>
      )}
      {/* Problem ring (frame 122): 1.5 px dashed Clay, 4 px outside the card. Its own layer, so the
          selection outline (on the card) and this one draw together; hidden from assistive tech,
          the count is in the badge and the card's name. */}
      {hasProblem && (
        <span
          aria-hidden
          data-testid="problem-outline"
          className="pointer-events-none absolute -inset-[5.5px] rounded-[20px] border-[1.5px] border-dashed border-clay-ink"
        />
      )}
      {target === 'ok' && (
        <span
          aria-hidden
          className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-on-primary shadow-rest"
        >
          <Plus strokeWidth={2} className="size-3.5" />
        </span>
      )}
      {data.flowStart !== undefined && (
        <span
          role="note"
          className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 flex w-max -translate-x-1/2 items-center gap-1 rounded-full bg-inverse px-2 py-0.5 text-caption text-on-inverse shadow-rest"
        >
          <CornerDownRight aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
          {data.flowStart}
        </span>
      )}
      {refusal && (
        <span
          role="note"
          className="absolute top-full left-0 z-10 mt-2 flex w-max items-center gap-1.5 rounded-row border border-clay-ink bg-surface px-2 py-1 text-caption text-clay-ink shadow-hover"
        >
          <Ban aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          {refusal}
        </span>
      )}
    </div>
  );
});
