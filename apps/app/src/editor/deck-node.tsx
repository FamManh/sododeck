import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { IconGlyph } from '@sododeck/ui/components/icon-glyph';
import { nodeIcon } from '@sododeck/ui/icon-sets';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { type NodeProps } from '@xyflow/react';
import { CornerDownLeft, Layers, Pin, Table, TriangleAlert } from 'lucide-react';
import { memo, type CSSProperties } from 'react';

import { CardFieldsBlock, HeaderStatus } from './card-fields-block';
import { fieldBlock } from './card-fields';
import { MAX_CARD_TAGS } from './card-tags';
import { LockBadge, NodeNotes, ResizeControls, SideHandles } from './component-node-parts';
import { useComponentNodeState } from './use-component-node-state';
import { oneStep } from './fields/one-step';
import { typeName } from './type-label';
import { CardTitleInput } from './quick-edit/card-title-input';
import { DetailsButton } from './quick-edit/details-button';
import { describeChannel } from './style/card-style';
import type { DeckFlowNode } from './deck-to-flow';
import { deckStateClasses } from './deck-states';
import { StepSticker } from './step-sticker';
import { useUiStore } from '../state/ui-store';
import { TableBody } from './table/table-body';
import { TableCompact } from './table/table-compact';
import { TableDetailToggle } from './table/table-detail-toggle';
import { TableFilter } from './table/table-filter';

/** The title's line height in em (DESIGN.md `--sd-deck-title`), so an edited title shows as many lines as the card. */
const TITLE_LINE_EM = 1.28;

/** Canvas card in the Deck look (029; DESIGN.md "Card system (Deck)", frames 117–121, 125). */
export const DeckNode = memo(function DeckNode({
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
  const locked = data.locked === true;
  // The column filter (048) replaces the header's type name while it is open on this table.
  const filtering = useUiStore((state) => state.tableFilter?.tableId === id);

  // A table card (041): the same frame, header and states, with a column list for a body.
  const table = data.layout.table;
  // Dimmed and pinned are said in the name too, never shown by opacity or a glyph alone (011).
  const name = [
    table === undefined
      ? `${typeName(data.kind)}: ${data.title}`
      : `Table ${data.title}, ${String(table.columnCount)} columns`,
    data.viewDimmed === true ? 'dimmed in this view' : null,
    data.pinned === true ? 'pinned' : null,
    locked ? 'locked' : null,
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
  const tags = table === undefined ? data.tagLooks.slice(0, MAX_CARD_TAGS) : [];
  // Typed fields (032): measured by the same `fieldBlock` the layout reserved room with. Tables
  // draw columns instead (041).
  const fields = data.fields;
  const block = fieldBlock(fields, layout.width);
  const headerStatus = isLandscape ? undefined : fields.header;
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
  const { icon: cardIcon } = nodeIcon({ icon: data.icon, type: data.kind });
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
      aria-roledescription={table === undefined ? 'component' : 'table'}
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
        // A table with columns ends 8 below its body, not 12 (DESIGN.md "Database tokens").
        table?.hasBody === true && !isLandscape && 'pb-[6.5px]',
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
          <IconGlyph
            icon={cardIcon}
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
              <IconGlyph icon={cardIcon} size={14} strokeWidth={2} />
            </span>
            {isContainer && table !== undefined && filtering ? (
              <TableFilter nodeId={id} title={data.title} layout={table} />
            ) : isContainer ? (
              <span
                data-text={subtitleDataText}
                className={cn('min-w-0 flex-1 truncate text-caption font-medium', subtitleClass)}
              >
                {table?.typeName ?? typeName(data.kind)}
              </span>
            ) : (
              // System: the tile alone (§g-58); the slot keeps the badges on the right.
              <span aria-hidden className="min-w-0 flex-1" />
            )}
            {headerStatus !== undefined && (
              // System level: the icon alone, like a narrow card (§g-58 keeps the header).
              <HeaderStatus chip={headerStatus} narrow={box.width < 150 || !isContainer} />
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
            {/* A locked card's badge takes the detail toggle's place (043 R11). */}
            {locked && isContainer && (
              <LockBadge
                id={id}
                title={data.title}
                focused={data.focused}
                className={textRoleClass ?? undefined}
              />
            )}
            {table !== undefined && isContainer && !locked && (
              <TableDetailToggle
                nodeId={id}
                own={table.ownDetail}
                focused={data.focused}
                textClass={textRoleClass}
              />
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
          {table !== undefined && isContainer && table.noteLines.length > 0 && (
            <span
              data-testid="table-note"
              data-text={subtitleDataText}
              className={cn(
                'shrink-0 text-[12px] leading-[17px] break-words',
                textRoleClass ?? 'text-ink-secondary',
              )}
              style={clampStyle(table.noteLines.length)}
            >
              {table.noteLines.join(' ')}
            </span>
          )}
          {table !== undefined &&
            (isContainer ? (
              <TableBody
                nodeId={id}
                layout={table}
                focused={data.focused}
                locked={data.locked === true}
                tinted={look?.namedFill === true || customText !== undefined}
              />
            ) : (
              <TableCompact layout={table} textClass={textRoleClass} />
            ))}
          {table === undefined &&
            isContainer &&
            data.subtitle?.trim() &&
            layout.descriptionLines > 0 && (
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
          {table === undefined && block.height > 0 && (
            <CardFieldsBlock
              nodeId={id}
              view={fields}
              block={block}
              dots={!isContainer}
              textClass={textRoleClass}
              focused={data.focused}
            />
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
      {data.childCount > 0 && table === undefined && (
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

      {resizable && <ResizeControls id={id} level={data.level} />}
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
      />

      {titleEdit === null && !data.dimmed && (
        <DetailsButton id={id} title={data.title} focused={data.focused} />
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
      <NodeNotes nodeId={id} data={data} target={target} refusal={refusal} />
    </div>
  );
});
