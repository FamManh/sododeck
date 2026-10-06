import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import type { NodeProps } from '@xyflow/react';
import { CornerDownLeft, Layers, TriangleAlert } from 'lucide-react';
import { memo, useMemo, type CSSProperties } from 'react';

import { LockBadge, NodeNotes, ResizeControls, SideHandles } from '../component-node-parts';
import type { DeckFlowNode, HandleSide } from '../deck-to-flow';
import { deckStateClasses } from '../deck-states';
import { oneStep } from '../fields/one-step';
import { CardTitleInput } from '../quick-edit/card-title-input';
import { DetailsButton } from '../quick-edit/details-button';
import { StepSticker } from '../step-sticker';
import { describeChannel } from '../style/card-style';
import { typeName } from '../type-label';
import { shownShapeTitle } from '../placeholder-title';
import { useComponentNodeState } from '../use-component-node-state';
import { outlinePoint, SHAPE_TITLE_LINE, shapePath, titleBox } from './shape-geometry';
import { RotateHandle, TURN_VAR } from './rotate-handle';
import { Ring } from './shape-ring';

/**
 * A component drawn as a shape (031 research R3; DESIGN.md "Card system (Deck)", Shape column of
 * the States table; frames 120, 122, 123). One SVG holds the lip, the filled 1.5 px outline and
 * the state rings; the title is HTML in the shape's title box. Handles sit on the outline
 * (`outlinePoint`), so React Flow hands connectors the outline points with no routing change.
 * Fields and tags stay in the drawer. Tilt and lift are CSS on `.sd-shape-art`, paint-only.
 */
export const ShapeNode = memo(function ShapeNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<DeckFlowNode>) {
  const {
    editor,
    announce,
    openConnectPopover,
    connecting,
    role,
    hotSide,
    resizable,
    titleEdit,
    target,
    refusal,
  } = useComponentNodeState(id, selected, data.locked === true);
  const geometry = data.geometry ?? 'rect';
  const layout = data.layout;
  const w = width ?? layout.width;
  const h = height ?? layout.height;
  const box = useMemo(() => ({ x: 0, y: 0, width: w, height: h }), [w, h]);
  const paths = useMemo(() => shapePath(geometry, box), [geometry, box]);
  const title = useMemo(() => titleBox(geometry, box), [geometry, box]);
  const isText = geometry === 'none';
  // A text in title edit is only its words: a thin focus outline replaces the selection ring,
  // the handles and the resize controls (founder feedback, 2026-10-06).
  const editingText = isText && titleEdit !== null;
  const rotation = data.rotation ?? 0;
  // Shapes with no closed outline (actor, text) take their rings around the box.
  const ringBase = useMemo(
    () =>
      geometry === 'actor' || geometry === 'none'
        ? shapePath('rounded-rect', box).outline
        : paths.outline,
    [geometry, box, paths.outline],
  );
  const maskId = `sd-ring-${id.replace(/[^\w-]/g, '_')}`;
  const isLandscape = data.level === 'landscape';

  // The text shape shows words only, in the default ink: no colour (FR-003).
  const look = isText ? undefined : data.look;
  const hasFlowStep = data.currentStep === true;
  const hasConnectTarget = target === 'ok';
  const hasProblem = data.problems !== undefined && target !== 'ok';
  const customText = look !== undefined && look.text !== 'default' ? look.text : undefined;
  const textClass =
    customText === 'light'
      ? 'text-card-text-light'
      : customText === 'dark'
        ? 'text-card-text-dark'
        : 'text-ink';
  // Actor: the title sits below the figure, on the canvas, not on the fill.
  const titleOnCanvas = geometry === 'actor';

  const shapeName = typeName(data.kind).toLowerCase();
  const name = [
    `${data.title}, ${shapeName}`,
    data.viewDimmed === true ? 'dimmed in this view' : null,
    data.pinned === true ? 'pinned' : null,
    data.problems?.label ?? null,
  ]
    .filter(Boolean)
    .join(', ');
  const colourDescription = [
    look?.fillRef !== undefined ? describeChannel('fill', look.fillRef) : null,
    look?.strokeRef !== undefined ? describeChannel('stroke', look.strokeRef) : null,
  ].filter((part): part is string => part !== null);
  const description = [
    selected ? 'Selected' : null,
    hasProblem ? (data.problems?.titles ?? null) : null,
    ...colourDescription,
  ]
    .filter(Boolean)
    .join(', ');
  const tabIndex = data.focused ? 0 : -1;
  const stateClasses = deckStateClasses({
    selected,
    hasProblem,
    connectTarget: hasConnectTarget,
    connectRefused: refusal !== null,
    currentStep: hasFlowStep,
  });

  const placeAt = (side: HandleSide): CSSProperties => {
    // React Flow's side classes pin right / bottom handles with `right` / `bottom` and a +50 %
    // shift; a handle on the outline is centred on its point whatever the side.
    const point = outlinePoint(geometry, box, side);
    return {
      left: point.x,
      top: point.y,
      right: 'auto',
      bottom: 'auto',
      transform: 'translate(-50%, -50%)',
    };
  };

  const titleStyle: CSSProperties = {
    left: title.x,
    top: title.y,
    width: title.width,
    height: title.height,
  };
  const titleClasses = cn(
    'text-[13px] leading-[16px] font-semibold break-words text-center',
    titleOnCanvas ? 'text-ink' : textClass,
  );
  const clamp: CSSProperties = {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: layout.titleLines,
    overflow: 'hidden',
  };
  const titleText = (
    <span data-testid="shape-title" className={titleClasses} style={clamp}>
      {shownShapeTitle({ type: data.kind, title: data.title }, geometry)}
    </span>
  );

  return (
    <div
      data-testid="shape-node"
      data-node-id={id}
      data-geometry={geometry}
      role="group"
      aria-roledescription="shape"
      aria-label={name}
      aria-selected={selected}
      aria-description={description === '' ? undefined : description}
      aria-current={hasFlowStep ? 'step' : undefined}
      data-step-state={data.step?.state}
      {...(data.dimmed ? { 'aria-hidden': true, inert: true } : {})}
      {...(customText === undefined ? {} : { 'data-text': customText })}
      {...(hasProblem ? { 'data-problem': '' } : {})}
      {...(look?.stroke === undefined ? {} : { 'data-stroke': '' })}
      {...(editingText ? { 'data-editing': '' } : {})}
      tabIndex={tabIndex}
      style={{
        width: w,
        height: h,
        ...(look?.fill === undefined ? {} : { '--card-fill': look.fill }),
        ...(look?.stroke === undefined ? {} : { '--card-stroke': look.stroke }),
        ...(rotation === 0 ? {} : { [TURN_VAR]: `${String(rotation)}deg` }),
      }}
      onDoubleClickCapture={(event) => {
        // A handle double-click resets the size (017 T030), not the title edit underneath it.
        if (!resizable) return;
        const element = event.target as HTMLElement;
        if (element.closest('.sd-resize-handle') === null) return;
        event.stopPropagation();
        oneStep(editor, () => {
          editor.setCardSize(id, null);
        });
        announce('Size reset');
      }}
      className={cn(
        'sd-shape group/node relative rounded-[4px]',
        isText && 'sd-shape-text',
        focusRing,
        ...stateClasses,
        data.flowStart !== undefined && 'flow-start',
      )}
    >
      <svg
        aria-hidden
        className="sd-shape-art sd-shape-turn pointer-events-none absolute inset-0 overflow-visible"
        width={w}
        height={h}
        viewBox={`0 0 ${String(w)} ${String(h)}`}
      >
        {hasFlowStep && paths.outline !== '' && (
          <path data-testid="shape-halo" className="sd-shape-halo" d={paths.outline} />
        )}
        {/* The lip is the outline moved down by the lip token (CSS), so it follows hover, the
            current step and the no-lip zoom like a card's. */}
        {paths.lip !== null && (
          <path data-testid="shape-lip" className="sd-shape-lip" d={paths.outline} />
        )}
        {paths.outline !== '' && (
          <path data-testid="shape-outline" className="sd-shape-outline" d={paths.outline} />
        )}
        {paths.extra !== undefined && (
          <path data-testid="shape-extra" className="sd-shape-extra" d={paths.extra} />
        )}
        {((selected && !editingText) || data.flowStart !== undefined) && (
          <Ring
            kind="selected"
            d={ringBase}
            maskId={maskId}
            box={box}
            className="sd-shape-ring"
            testId="shape-selected-ring"
          />
        )}
        {hasProblem && (
          <Ring
            kind="problem"
            d={ringBase}
            maskId={maskId}
            box={box}
            className="sd-shape-problem"
            testId="problem-outline"
          />
        )}
      </svg>

      {data.step !== undefined && <StepSticker state={data.step.state} number={data.step.number} />}

      {/* Landscape (frame 123): the geometry only, no title. */}
      {(!isLandscape || titleEdit !== null) && (
        <div
          className="sd-shape-turn pointer-events-none absolute flex items-center justify-center"
          style={titleStyle}
        >
          {editingText ? (
            // The inline-edit focus look (DESIGN.md `inline-edit`): a 1px primary outline.
            <div
              data-testid="text-edit-frame"
              className="pointer-events-auto w-full rounded-[4px] outline-1 outline-offset-2 outline-primary outline-solid"
            >
              <CardTitleInput
                edit={titleEdit}
                title={data.title}
                className={cn(titleClasses, 'w-full')}
                style={{ maxHeight: layout.titleLines * SHAPE_TITLE_LINE }}
                removeWhenEmpty
              />
            </div>
          ) : titleEdit !== null ? (
            <CardTitleInput
              edit={titleEdit}
              title={data.title}
              className={cn(titleClasses, 'pointer-events-auto w-full')}
              style={{ maxHeight: layout.titleLines * SHAPE_TITLE_LINE }}
            />
          ) : layout.titleCut ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="pointer-events-auto">{titleText}</span>
              </TooltipTrigger>
              <TooltipContent>{data.title}</TooltipContent>
            </Tooltip>
          ) : (
            titleText
          )}
        </div>
      )}

      {hasProblem && data.problems !== undefined && (
        <span
          aria-hidden
          title={data.problems.titles}
          data-testid="problem-glyph"
          className="absolute -top-3 -right-3 z-10 flex h-5 items-center gap-1 rounded-full bg-clay-soft px-2 text-[11px] leading-none font-semibold text-clay-ink"
        >
          <TriangleAlert strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
          {data.problems.count}
        </span>
      )}
      {data.childCount > 0 && (
        // Below the shape (DESIGN.md States, "Has child components"): the box never grows.
        <span
          role="img"
          aria-label={`${String(data.childCount)} components inside, press Enter to open`}
          className="absolute top-full left-1/2 mt-2 flex h-6 w-max -translate-x-1/2 items-center gap-1.5 rounded-row bg-surface-2 px-2 text-caption text-ink-secondary"
        >
          <Layers aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
          <span>{data.childCount} inside</span>
          <CornerDownLeft aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
        </span>
      )}

      {resizable && !editingText && <ResizeControls id={id} level={data.level} />}
      {isText && resizable && !editingText && (
        <RotateHandle id={id} rotation={rotation} tabIndex={tabIndex} />
      )}
      {data.locked === true && (
        // A shape has no header: the lock sits on its top-right corner (043 R11).
        <LockBadge
          id={id}
          title={data.title}
          focused={data.focused}
          className="absolute -top-2.5 -right-2.5 bg-surface shadow-rest"
        />
      )}
      <SideHandles
        title={data.title}
        tabIndex={tabIndex}
        role={role}
        hotSide={hotSide}
        connecting={connecting}
        showOnHover={!isLandscape}
        onActivate={() => {
          openConnectPopover(id);
        }}
        placeAt={placeAt}
      />

      {titleEdit === null && !data.dimmed && (
        <DetailsButton id={id} title={data.title} focused={data.focused} />
      )}
      <NodeNotes nodeId={id} data={data} target={target} refusal={refusal} />
    </div>
  );
});
