import { KindTile } from '@sododeck/ui/components/kind-tile';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
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
import { nodeSize } from './canvas-geometry';
import { textLines } from './card-text';
import { connectionCheck, REFUSAL_TEXT, type ConnectionCheck } from './connection-rules';
import {
  applyCardResize,
  endCardResize,
  startCardResize,
  type CardResizeSession,
} from './editing/card-resize';
import { oneStep } from './fields/one-step';
import { kindLabel } from './kind-label';
import type { Handle as ResizeHandleName } from './editing/resize-limits';
import { CardTitleInput } from './quick-edit/card-title-input';
import { DetailsButton } from './quick-edit/details-button';
import { describeChannel } from './style/card-style';
import { useConnecting, useConnectionRole } from './use-connection-role';
import type { DeckFlowNode } from './deck-to-flow';
import { cardTags, tagBlockHeight } from './card-tags';

/** theme.css's --text-body-sm line height, so an edited title shows as many lines as the card. */
const TITLE_LINE_EM = 1.45;

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

/** Canvas node, 164×50 (DESIGN.md "node", design 02 and 53–55). */
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
    `${kindLabel(data.kind)}: ${data.title}`,
    data.viewDimmed === true ? 'dimmed in this view' : null,
    data.pinned === true ? 'pinned' : null,
    data.problems?.label ?? null,
  ]
    .filter(Boolean)
    .join(', ');
  const tabIndex = data.focused ? 0 : -1;
  const isLandscape = data.level === 'landscape';
  const isSystem = data.level === 'system';
  // Component (zoomed in) reads like Container, at the same size (§g-58).
  const isContainer = data.level === 'container' || data.level === 'component';
  // Clamp to what the resized card can actually show (017 R11, FR-008); the full title always
  // stays in the `title` attribute above, so a hover still reveals the rest.
  const defaultSize = nodeSize(data.level);
  const box = { width: width ?? defaultSize.width, height: height ?? defaultSize.height };
  // Tags (2026-10-03): up to ten chips under the title; `cardSize` already made room for them.
  const tags = cardTags(data.tags);
  const tagBlock = tagBlockHeight(data.tags, box.width);
  const lines = textLines({ width: box.width, height: box.height - tagBlock });
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
  // The title edits in place, in its own type and over the same lines (founder, 2026-10-02).
  const titleInput =
    titleEdit === null ? null : (
      <CardTitleInput
        edit={titleEdit}
        title={data.title}
        className={cn(
          'break-words text-body-sm font-medium',
          isLandscape && 'text-center',
          textRoleClass ?? 'text-ink',
        )}
        style={{ maxHeight: `${String(lines.title * TITLE_LINE_EM)}em` }}
      />
    );
  const subtitleClass =
    textRoleClass ?? (look?.namedFill === true ? 'text-ink-secondary' : 'text-ink-muted');
  const subtitleDataText = customText ?? (look?.namedFill === true ? 'secondary' : undefined);
  const colourDescription = [
    look?.fillRef !== undefined ? describeChannel('fill', look.fillRef) : null,
    look?.strokeRef !== undefined ? describeChannel('stroke', look.strokeRef) : null,
  ].filter((part): part is string => part !== null);
  const description = [selected ? 'Selected' : null, ...colourDescription]
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
      {...(data.dimmed ? { 'aria-hidden': true, inert: true } : {})}
      {...(customText === undefined ? {} : { 'data-text': customText })}
      {...(showStroke ? { 'data-stroke': '' } : {})}
      {...(data.problems !== undefined && target !== 'ok' ? { 'data-problem': '' } : {})}
      tabIndex={tabIndex}
      title={data.title}
      style={{
        width: box.width,
        height: box.height,
        ...(look?.fill === undefined ? {} : { '--card-fill': look.fill }),
        ...(look?.stroke === undefined ? {} : { '--card-stroke': look.stroke }),
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
        // Hover lifts the card (019 US4); a static shadow, so nothing moves under reduced motion.
        'group/node relative rounded-node border border-border bg-surface shadow-rest hover:shadow-hover',
        'flex flex-col',
        focusRing,
        // Selected (018, designs 86–116): a 2 px frame 2 px outside the card, which reads on any
        // fill; a shape cue, so it is never color-only (plus aria-selected).
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-canvas',
        // From or to of the current flow step (007 FR-005): the selection ring and halo.
        data.currentStep === true && 'border-primary shadow-selection ring-1 ring-primary',
        target === 'ok' && 'outline-2 outline-offset-4 outline-primary outline-dashed',
        refusal && 'outline-2 outline-offset-4 outline-clay-ink outline-dashed',
        // Where the next flow step must start (006 FR-009): a ring plus the tag text.
        data.flowStart !== undefined && 'ring-2 ring-primary ring-offset-2 ring-offset-canvas',
        // Problem (015, 020 design 107): a 3 px dashed clay ring 3 px outside the card, so it
        // reads on any fill; unless the connect "+" owns the corner.
        data.problems !== undefined &&
          target !== 'ok' &&
          'outline-[3px] outline-offset-[3px] outline-clay-ink outline-dashed',
        // Colour (020 R5): fill and stroke, unless the flow-step/connect-target border owns it.
        showFill && 'bg-(--card-fill)',
        showStroke && 'border-[1.5px] border-(--card-stroke)',
      )}
    >
      {/* The title row keeps the card's own height; tags wrap below it (2026-10-03). */}
      <div
        className={cn(
          'flex min-h-0 flex-1 items-center',
          isLandscape ? 'justify-center' : 'gap-[9px] px-2.5',
        )}
      >
        {isLandscape ? (
          (titleInput ?? <KindTile kind={data.kind} size={40} decorative />)
        ) : (
          <>
            {!isSystem && <KindTile kind={data.kind} size={30} decorative />}
            <span className="flex min-w-0 flex-1 flex-col">
              {titleInput ?? (
                <span
                  className={cn(
                    'break-words text-body-sm font-medium',
                    textRoleClass ?? 'text-ink',
                  )}
                  style={clampStyle(lines.title)}
                >
                  {data.title}
                </span>
              )}
              {isContainer && data.subtitle && lines.subtitle > 0 && (
                <span
                  data-text={subtitleDataText}
                  className={cn('break-words font-mono text-node-sub', subtitleClass)}
                  style={clampStyle(lines.subtitle)}
                >
                  {data.subtitle}
                </span>
              )}
            </span>
            {data.hasRules && isContainer && (
              <Table
                role="img"
                aria-label="Has rules"
                strokeWidth={ICON_STROKE_WIDTH}
                className={cn('size-3.5 shrink-0', textRoleClass ?? 'text-primary-ink')}
              />
            )}
          </>
        )}
        {data.childCount > 0 && (
          <span
            role="img"
            aria-label={`${String(data.childCount)} components inside, press Enter to open`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-caption text-ink-secondary"
          >
            <Layers aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
            <span>{data.childCount}</span>
          </span>
        )}
      </div>
      {tags.length > 0 && !isLandscape && (
        <ul
          aria-label="Tags"
          className="flex shrink-0 flex-wrap content-start gap-1 overflow-hidden px-2.5 pb-2"
          style={{ height: tagBlock }}
        >
          {tags.map((tag) => (
            <li
              key={tag}
              title={tag}
              className={cn(
                'h-5 max-w-full truncate rounded-full px-2 text-caption leading-5',
                look?.namedFill === true || customText !== undefined
                  ? 'bg-surface/70 text-ink-secondary'
                  : 'bg-surface-2 text-ink-secondary',
              )}
            >
              {tag}
            </li>
          ))}
        </ul>
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
              'sd-handle opacity-0 group-hover/node:opacity-100 group-focus-within/node:opacity-100',
              focusRing,
              role !== null && 'opacity-100',
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
      {data.pinned === true && !isLandscape && (
        <span className="pointer-events-none absolute -top-2.5 -left-2.5 flex size-5 items-center justify-center rounded-full border border-primary bg-surface text-primary-ink shadow-rest">
          <Pin role="img" aria-label="Pinned" strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
        </span>
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
      {/* Problems (015 FR-022): top-right, unless the connect "+" uses that corner. A surface
          disc (020 design 107) so the alert glyph reads on any fill. */}
      {data.problems !== undefined && target !== 'ok' && (
        <span
          aria-hidden
          title={data.problems.titles}
          data-testid="problem-glyph"
          className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full border border-clay-ink bg-surface text-clay-ink shadow-rest"
        >
          <TriangleAlert strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
        </span>
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
