/**
 * The controls of the Line style popover and the drawer's Line section (022 US1, frame 128):
 * Type, Dash, Weight, Colour and Animate direction for one or several connectors. A pick writes
 * only its key to every selected connector, as one undo step. Sections whose value differs across
 * the selection say "Mixed" and the values in use carry a dashed ring.
 */
import type { Dash, Width } from '@sododeck/model';
import type { ColorRef, Edge, EdgeShape } from '@sododeck/schema';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { SwatchGrid, type SwatchOption } from '@sododeck/ui/components/swatch-grid';
import { Switch } from '@sododeck/ui/components/switch';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

import { useId, type ReactNode } from 'react';

import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { applyLineType, LINE_TYPES, lineTypeLabel } from '../fields/line-type';
import { CARD_COLORS, colourName } from '../style/card-style';
import { applyLineStyle } from './apply-line-style';
import { DASHES, DEFAULT_WIDTH, WIDTHS, widthText } from './line-style-options';
import { lineStyleView, type KeyView } from './line-style-view';

const NO_COLOUR = 'none';

/** Dashed ring on an option some selected connector has while the selection is mixed. */
const usedRing =
  'data-[used]:outline data-[used]:outline-1 data-[used]:outline-dashed data-[used]:outline-border-strong';

function Section({
  label,
  id,
  value,
  mixed,
  children,
}: {
  label: string;
  id: string;
  value: string;
  mixed: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span id={id} className="text-caption font-medium text-ink">
          {label}
        </span>
        <span
          className={cn(
            'text-caption text-ink-secondary',
            mixed && 'rounded-full border border-dashed border-border-strong px-1.5',
          )}
        >
          {mixed ? 'Mixed' : value}
        </span>
      </div>
      {children}
    </div>
  );
}

const sharedValue = <T,>(view: KeyView<T>): T | null =>
  view.shared.mixed ? null : view.shared.value;

/** Slider with the five weight stops. Keys: ← → one stop, Home / End thinnest / thickest. */
function WeightSlider({
  labelledBy,
  value,
  used,
  disabled,
  onPick,
}: {
  labelledBy: string;
  value: Width | null;
  used: readonly Width[];
  disabled: boolean;
  onPick: (width: Width) => void;
}) {
  const index = value === null ? -1 : WIDTHS.indexOf(value);
  const move = (to: number) => {
    const next = WIDTHS[Math.max(0, Math.min(WIDTHS.length - 1, to))];
    if (next !== undefined && next !== value) onPick(next);
  };
  const current = value ?? DEFAULT_WIDTH;
  return (
    <div className="px-2 pb-4 pt-1">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelledBy}
        aria-valuemin={WIDTHS[0]}
        aria-valuemax={WIDTHS[WIDTHS.length - 1]}
        aria-valuenow={current}
        aria-valuetext={
          value === null
            ? 'Mixed'
            : `${widthText(value)}${value === DEFAULT_WIDTH ? ', default' : ''}`
        }
        aria-disabled={disabled || undefined}
        onKeyDown={(event) => {
          if (disabled) return;
          const from = index < 0 ? WIDTHS.indexOf(DEFAULT_WIDTH) : index;
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') move(from + 1);
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') move(from - 1);
          else if (event.key === 'Home') move(0);
          else if (event.key === 'End') move(WIDTHS.length - 1);
          else return;
          event.preventDefault();
        }}
        className={cn('relative flex h-6 items-center rounded-full', focusRing)}
      >
        <div aria-hidden className="absolute inset-x-1 h-0.5 rounded-full bg-surface-3" />
        {WIDTHS.map((stop, i) => (
          <button
            key={stop}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-hidden
            data-used={used.length > 1 && used.includes(stop) ? '' : undefined}
            onClick={() => {
              onPick(stop);
            }}
            className="relative flex flex-1 flex-col items-center"
          >
            <span
              className={cn(
                'size-2 rounded-full bg-surface-3 ring-1 ring-border-strong',
                i === index && 'size-4 bg-surface ring-2 ring-primary',
                used.length > 1 &&
                  used.includes(stop) &&
                  i !== index &&
                  'ring-dashed outline-dashed',
              )}
            />
            <span className="absolute top-5 text-caption text-ink-secondary">{stop}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function LineStyleControls({
  edges,
  deckColours,
}: {
  edges: readonly Edge[];
  deckColours?: readonly string[];
}) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const editable = useUiStore((s) => !isFlowMode(s) && s.flowSession === null);
  const ids = edges.map((edge) => edge.id);
  const view = lineStyleView(edges);
  const base = useId();
  const swatches = deckColours ?? deck.swatches ?? [];

  const shape = sharedValue(view.shape);
  const dash = sharedValue(view.dash);
  const width = sharedValue(view.width);
  const color = view.color.shared.mixed ? undefined : view.color.shared.value;
  const animated = sharedValue(view.animated);
  const mixedGroup = (v: KeyView<unknown>) => v.shared.mixed;

  const options: SwatchOption[] = [
    { value: NO_COLOUR, label: 'No colour', swatch: 'var(--color-border)' },
    ...CARD_COLORS.map((name) => ({
      value: name,
      label: colourName(name),
      swatch: `var(--color-card-${name}-stroke)`,
    })),
  ];
  const deckOptions: SwatchOption[] = swatches.map((hex) => ({
    value: hex,
    label: hex,
    swatch: hex,
  }));
  const checkedColour = color === undefined ? null : color === null ? NO_COLOUR : color;
  const colourLabel =
    color === undefined
      ? ''
      : color === null
        ? 'No colour'
        : CARD_COLORS.includes(color as never)
          ? colourName(color)
          : color;
  const pickColour = (value: string) => {
    const next: ColorRef | null = value === NO_COLOUR ? null : value;
    applyLineStyle(
      editor,
      ids,
      { color: next },
      next === null ? 'Line colour cleared' : `Line colour ${colourLabel === '' ? value : value}`,
    );
  };

  return (
    <div className="flex flex-col gap-3" aria-disabled={!editable || undefined}>
      <Section
        label="Type"
        id={`${base}-type`}
        value={shape === null ? '' : lineTypeLabel(shape)}
        mixed={mixedGroup(view.shape)}
      >
        <SegmentedControl
          aria-labelledby={`${base}-type`}
          value={shape ?? ''}
          disabled={!editable}
          onValueChange={(value) => {
            if (value !== '') applyLineType(editor, ids, value as EdgeShape);
          }}
          className="h-auto w-full"
        >
          {LINE_TYPES.map(({ value, label, icon: Icon }) => (
            <SegmentedControlItem
              key={value}
              value={value}
              data-used={
                view.shape.shared.mixed && view.shape.used.includes(value) ? '' : undefined
              }
              className={cn('h-12 flex-1 flex-col gap-0.5', usedRing)}
            >
              <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} />
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Section>
      <Section
        label="Dash"
        id={`${base}-dash`}
        value={DASHES.find((d) => d.value === dash)?.label ?? ''}
        mixed={mixedGroup(view.dash)}
      >
        <SegmentedControl
          aria-labelledby={`${base}-dash`}
          value={dash ?? ''}
          disabled={!editable}
          onValueChange={(value) => {
            if (value === '') return;
            applyLineStyle(editor, ids, { dash: value as Dash }, `Dash set to ${value}`);
          }}
          className="h-auto w-full"
        >
          {DASHES.map(({ value, label }) => (
            <SegmentedControlItem
              key={value}
              value={value}
              data-used={view.dash.shared.mixed && view.dash.used.includes(value) ? '' : undefined}
              className={cn('h-10 flex-1', usedRing)}
            >
              {label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Section>
      <Section
        label="Weight"
        id={`${base}-weight`}
        value={width === null ? '' : widthText(width)}
        mixed={mixedGroup(view.width)}
      >
        <WeightSlider
          labelledBy={`${base}-weight`}
          value={width}
          used={view.width.used}
          disabled={!editable}
          onPick={(next) => {
            applyLineStyle(editor, ids, { width: next }, `Weight set to ${widthText(next)}`);
          }}
        />
      </Section>
      <Section
        label="Colour"
        id={`${base}-colour`}
        value={colourLabel}
        mixed={mixedGroup(view.color)}
      >
        <div className="flex flex-col gap-2">
          <SwatchGrid
            label="Colour"
            options={options}
            value={deckOptions.some((o) => o.value === checkedColour) ? null : checkedColour}
            columns={7}
            onSelect={pickColour}
          />
          {deckOptions.length > 0 ? (
            <SwatchGrid
              label="Deck colours"
              options={deckOptions}
              value={deckOptions.some((o) => o.value === checkedColour) ? checkedColour : null}
              columns={7}
              onSelect={pickColour}
            />
          ) : null}
        </div>
      </Section>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Switch
            id={`${base}-animate`}
            checked={animated === true}
            disabled={!editable}
            aria-describedby={`${base}-animate-help`}
            onCheckedChange={(next) => {
              applyLineStyle(
                editor,
                ids,
                { animated: next },
                `Animate direction, ${next ? 'on' : 'off'}`,
              );
            }}
          />
          <label htmlFor={`${base}-animate`} className="text-body-sm font-medium text-ink">
            Animate direction
          </label>
          {mixedGroup(view.animated) ? (
            <span className="ml-auto rounded-full border border-dashed border-border-strong px-1.5 text-caption text-ink-secondary">
              Mixed
            </span>
          ) : null}
        </div>
        <p id={`${base}-animate-help`} className="pl-10 text-caption text-ink-secondary">
          Dashes run toward the arrow. Still with reduced motion and in exports.
        </p>
      </div>
    </div>
  );
}
