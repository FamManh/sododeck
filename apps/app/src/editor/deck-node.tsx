import { KindTile } from '@sododeck/ui/components/kind-tile';
import { TagChip } from '@sododeck/ui/components/tag-chip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Handle, Position, type NodeProps } from '@xyflow/react';
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
import { memo, useEffect } from 'react';

import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { connectionCheck, REFUSAL_TEXT, type ConnectionCheck } from './connection-rules';
import { NODE_SIZE, type DeckFlowNode } from './deck-to-flow';
import { kindLabel } from './kind-label';
import { CardTitleInput } from './quick-edit/card-title-input';
import { DetailsButton } from './quick-edit/details-button';
import { describeChannel } from './style/card-style';
import { useConnecting, useConnectionRole } from './use-connection-role';

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

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
  // Only this card re-renders when its title edit starts or ends (the others select `null`).
  const titleEdit = useUiStore((s) =>
    s.titleEdit?.target === 'node' && s.titleEdit.id === id ? s.titleEdit : null,
  );
  const titleInput =
    titleEdit === null ? null : <CardTitleInput edit={titleEdit} title={data.title} />;

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
  const isContainer = data.level === 'container';
  const isComponent = data.level === 'component';

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
      tabIndex={tabIndex}
      title={data.title}
      style={{
        width: width ?? NODE_SIZE.width,
        height: height ?? NODE_SIZE.height,
        ...(look?.fill === undefined ? {} : { '--card-fill': look.fill }),
        ...(look?.stroke === undefined ? {} : { '--card-stroke': look.stroke }),
      }}
      className={cn(
        // Hover lifts the card (019 US4); a static shadow, so nothing moves under reduced motion.
        'group/node relative rounded-node border border-border bg-surface shadow-rest hover:shadow-hover',
        isLandscape
          ? 'flex items-center justify-center'
          : isComponent
            ? 'flex flex-col items-start gap-2 px-3 py-2'
            : 'flex items-center gap-[9px] px-2.5',
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
        // Colour (020 R5): fill and stroke, unless the flow-step/connect-target border owns it.
        showFill && 'bg-(--card-fill)',
        showStroke && 'border-[1.5px] border-(--card-stroke)',
      )}
    >
      {isLandscape ? (
        (titleInput ?? <KindTile kind={data.kind} size={40} decorative />)
      ) : isComponent ? (
        <>
          <div className="flex w-full items-start gap-2">
            <KindTile kind={data.kind} size={30} decorative />
            <span className="min-w-0 flex-1">
              {titleInput ?? (
                <span
                  className={cn(
                    'block truncate text-body-sm font-medium',
                    textRoleClass ?? 'text-ink',
                  )}
                >
                  {data.title}
                </span>
              )}
              {data.subtitle && (
                <span
                  data-text={subtitleDataText}
                  className={cn('block truncate font-mono text-node-sub', subtitleClass)}
                >
                  {data.subtitle}
                </span>
              )}
            </span>
            {data.hasRules && (
              <Table
                role="img"
                aria-label="Has rules"
                strokeWidth={ICON_STROKE_WIDTH}
                className={cn('size-3.5 shrink-0', textRoleClass ?? 'text-primary-ink')}
              />
            )}
          </div>
          <div className="flex w-full items-center justify-between gap-2">
            <span className={cn('truncate text-caption', textRoleClass ?? 'text-ink-secondary')}>
              {data.owner ?? 'No owner'}
            </span>
          </div>
          {data.tags.length > 0 && (
            <div className="flex w-full flex-wrap gap-1">
              {data.tags.slice(0, 2).map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {!isSystem && <KindTile kind={data.kind} size={30} decorative />}
          <span className="flex min-w-0 flex-1 flex-col">
            {titleInput ?? (
              <span
                className={cn('truncate text-body-sm font-medium', textRoleClass ?? 'text-ink')}
              >
                {data.title}
              </span>
            )}
            {isContainer && data.subtitle && (
              <span
                data-text={subtitleDataText}
                className={cn('truncate font-mono text-node-sub', subtitleClass)}
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

      {SIDES.map(({ id: side, position }) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={position}
          role="button"
          aria-label={`Connect from ${data.title}`}
          tabIndex={tabIndex}
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
          )}
        />
      ))}
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
      {/* Problems (015 FR-022): top-right, unless the connect "+" uses that corner. */}
      {data.problems !== undefined && target !== 'ok' && (
        <span
          aria-hidden
          title={data.problems.titles}
          data-testid="problem-glyph"
          className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full border border-amber-ink bg-amber-soft text-amber-ink shadow-rest"
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
