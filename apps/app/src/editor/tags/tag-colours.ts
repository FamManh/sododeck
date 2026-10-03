/**
 * The chip, ink and dot of a tag (033): from its stored colour, or slate when it has none. Cards
 * and tags share one mapping so a card colour and a tag colour of the same name look the same.
 */
import { readableText } from '@sododeck/ui/lib/contrast';
import type { ColorRef } from '@sododeck/schema';

import { isNamedColor } from '../style/card-style';

export interface TagColours {
  chip: string;
  ink: string;
  dot: string;
}

/** Chip, ink and dot for a colour: tokens for a named one, the hex and a readable ink for a custom one. */
export function chipColours(color: ColorRef): TagColours {
  return isNamedColor(color)
    ? {
        chip: `var(--color-card-${color}-chip)`,
        ink: `var(--color-card-${color}-ink)`,
        dot: `var(--color-card-${color}-dot)`,
      }
    : { chip: color, ink: `var(--color-card-text-${readableText(color).text})`, dot: color };
}

/** A tag's colours; `undefined` (no colour chosen) is slate. */
export function tagColours(color: ColorRef | undefined): TagColours {
  return chipColours(color ?? 'slate');
}
