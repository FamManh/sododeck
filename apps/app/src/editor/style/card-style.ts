/**
 * A card or group's resolved colour look (020, R6/R9): pure, derived from `Style` plus an
 * optional live preview. `deck-to-flow.ts` computes it per node/group and caches the result.
 */
import { readableText } from '@sododeck/ui/lib/contrast';
import type { CardColor, ColorRef, Style } from '@sododeck/schema';

/** The 13 named card colours, in DESIGN.md order (also the `SwatchGrid` order). */
export const CARD_COLORS: readonly CardColor[] = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
  'slate',
];

const NAMED_COLORS: ReadonlySet<string> = new Set(CARD_COLORS);

export function isNamedColor(value: ColorRef): value is CardColor {
  return NAMED_COLORS.has(value);
}

/** A channel resolved to a token (named) or kept as a literal hex (custom). */
interface ResolvedChannel {
  token: string;
  named: boolean;
}

function resolveChannel(channel: 'fill' | 'stroke', value: ColorRef): ResolvedChannel {
  return isNamedColor(value)
    ? { token: `var(--color-card-${value}-${channel})`, named: true }
    : { token: value, named: false };
}

/** Resolved look of one card or group; derived in `deck-to-flow.ts`, cached per object. */
export interface CardLook {
  fill?: string;
  stroke?: string;
  /** 'default' = theme ink; 'dark' / 'light' only on a custom (non-named) fill. */
  text: 'default' | 'dark' | 'light';
  /** Whether the fill is a named colour: the subtitle switches muted → secondary. */
  namedFill: boolean;
}

/** A live, unsaved edit (R9): overrides one channel for the objects it previews on. */
export interface StylePreview {
  channel: 'fill' | 'stroke';
  value: ColorRef;
}

/**
 * Resolves a card/group's look from its stored `Style` and an optional live preview, which
 * overrides only its own channel. Returns `undefined` when there is no colour on either channel,
 * so plain cards keep their existing (undecorated) data.
 */
export function resolveLook(
  style: Style | undefined,
  preview?: StylePreview,
): CardLook | undefined {
  const fillValue = preview?.channel === 'fill' ? preview.value : style?.fill;
  const strokeValue = preview?.channel === 'stroke' ? preview.value : style?.stroke;
  if (fillValue === undefined && strokeValue === undefined) return undefined;

  const fill = fillValue === undefined ? undefined : resolveChannel('fill', fillValue);
  const stroke = strokeValue === undefined ? undefined : resolveChannel('stroke', strokeValue);

  const text: CardLook['text'] =
    fill !== undefined && !fill.named ? readableText(fillValue as string).text : 'default';

  return {
    fill: fill?.token,
    stroke: stroke?.token,
    text,
    namedFill: fill?.named ?? false,
  };
}

/** A named colour's display label ("Green"), or the hex value as-is. */
export function colourName(ref: ColorRef): string {
  return isNamedColor(ref) ? ref.charAt(0).toUpperCase() + ref.slice(1) : ref;
}
